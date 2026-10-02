import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/integrations/supabase/client'
import { ataMinutasRepoSupabase } from '../ataMinutasRepo.supabase'

// Exercise the real Storage SDK so a rejected browser fetch is wrapped exactly
// like the reported production failure. Only external HTTP and the session vary.
vi.mock('@/integrations/supabase/client', async () => {
  const { createClient } = await vi.importActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js')
  return {
    supabase: createClient('https://storage.example.test', 'test-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  }
})

const row = {
  id: 'document-1', ata_id: 'ata-1', kind: 'convocacao',
  original_filename: 'Convocação_20260929.pdf', size_bytes: 57_600,
  created_at: '2026-10-02T21:00:00Z',
}
const storagePath = 'ata-1/user-1/file-Convocac_a_o_20260929.pdf'
const calls: Array<{ url: string; init: RequestInit }> = []
let storageFailure: Error | Response | null
let recoveryResponse: Response
let confirmationResponse: Response

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

function pdf(size = 57_600) {
  const bytes = new Uint8Array(size).fill(32)
  bytes.set([37, 80, 68, 70, 45, 49, 46, 55])
  return new File([bytes], row.original_filename, { type: '' })
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

describe('minuta supporting PDF upload', () => {
  beforeEach(() => {
    calls.length = 0
    storageFailure = null
    recoveryResponse = json(row)
    confirmationResponse = json(row)
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'user-session' } }, error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>)
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.endsWith('/documents/upload-url')) return json({ path: storagePath, token: 'signed-upload-token' })
      if (url.startsWith('https://storage.example.test/storage/v1/object/upload/sign/')) {
        if (storageFailure instanceof Error) throw storageFailure
        if (storageFailure) return storageFailure
        return json({ Key: `ata-minuta-documents/${storagePath}` })
      }
      if (url.endsWith('/documents/upload')) return recoveryResponse
      if (url.endsWith('/documents')) return confirmationResponse
      throw new Error(`Unexpected HTTP request: ${url.split('?')[0]}`)
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('links a successful direct upload without sending a recovery request', async () => {
    const result = await ataMinutasRepoSupabase.uploadDocument('ata-1', pdf(), 'convocacao')
    expect(result).toMatchObject({ id: 'document-1', originalFilename: row.original_filename, sizeBytes: 57_600 })
    expect(calls.map(({ url }) => url.split('?')[0])).toEqual([
      '/api/atas/ata-1/minuta/documents/upload-url',
      `https://storage.example.test/storage/v1/object/upload/sign/ata-minuta-documents/${storagePath}`,
      '/api/atas/ata-1/minuta/documents',
    ])
    const form = calls[1].init.body as FormData
    expect((form.get('') as File).type).toBe('application/pdf')
  })

  it.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])(
    'recovers a small PDF after browser transport error: %s', async (message) => {
      const file = pdf()
      storageFailure = new TypeError(message)
      const result = await ataMinutasRepoSupabase.uploadDocument('ata-1', file, 'convocacao')
      expect(result).toMatchObject({ id: 'document-1', kind: 'convocacao', originalFilename: row.original_filename })
      expect(calls).toHaveLength(3)
      const recovery = calls[2]
      expect(recovery.url).toBe('/api/atas/ata-1/minuta/documents/upload')
      expect(recovery.init.headers).toEqual({ Authorization: 'Bearer user-session' })
      const form = recovery.init.body as FormData
      expect(form.get('kind')).toBe('convocacao')
      expect(form.get('storagePath')).toBe(storagePath)
      const recoveredFile = form.get('file') as File
      expect(recoveredFile.name).toBe(row.original_filename)
      expect(recoveredFile.type).toBe('application/pdf')
      expect(await readBytes(recoveredFile)).toEqual(await readBytes(file))
    },
  )

  it('does not proxy files above the server body limit', async () => {
    storageFailure = new TypeError('Failed to fetch')
    await expect(ataMinutasRepoSupabase.uploadDocument('ata-1', pdf(4_194_305), 'convocacao')).rejects.toThrow('Failed to fetch')
    expect(calls).toHaveLength(2)
  })

  it('recovers a file at the proxy boundary', async () => {
    storageFailure = new TypeError('Failed to fetch')
    await expect(ataMinutasRepoSupabase.uploadDocument('ata-1', pdf(4_194_304), 'convocacao')).resolves.toMatchObject({ id: 'document-1' })
    expect(calls[2].url).toBe('/api/atas/ata-1/minuta/documents/upload')
    expect(((calls[2].init.body as FormData).get('file') as File).size).toBe(4_194_304)
  })

  it('does not retry a Storage permission error through the server', async () => {
    storageFailure = json({ message: 'new row violates row-level security policy' }, 403)
    await expect(ataMinutasRepoSupabase.uploadDocument('ata-1', pdf(), 'convocacao')).rejects.toThrow('row-level security')
    expect(calls).toHaveLength(2)
  })

  it('does not recover an unrelated SDK exception', async () => {
    storageFailure = new TypeError('Invalid URL')
    await expect(ataMinutasRepoSupabase.uploadDocument('ata-1', pdf(), 'convocacao')).rejects.toThrow('Invalid URL')
    expect(calls).toHaveLength(2)
  })

  it('does not upload again when linking a successful direct upload fails', async () => {
    confirmationResponse = json({ error: 'Sem permissão para vincular.' }, 400)
    await expect(ataMinutasRepoSupabase.uploadDocument('ata-1', pdf(), 'convocacao')).rejects.toThrow('Sem permissão')
    expect(calls[2].url).toBe('/api/atas/ata-1/minuta/documents')
    expect(calls).toHaveLength(3)
  })

  it('reports the recovery endpoint error without confirming or retrying again', async () => {
    storageFailure = new TypeError('Failed to fetch')
    recoveryResponse = json({ error: 'O limite total de PDFs foi atingido.' }, 400)
    await expect(ataMinutasRepoSupabase.uploadDocument('ata-1', pdf(), 'convocacao')).rejects.toThrow('limite total')
    expect(calls).toHaveLength(3)
  })
})
