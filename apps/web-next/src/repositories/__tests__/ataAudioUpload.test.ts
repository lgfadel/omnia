import { afterEach, describe, expect, it, vi } from 'vitest'
import { ataTranscriptionsRepoSupabase } from '../ataTranscriptionsRepo.supabase'

vi.mock('@/integrations/supabase/client', async () => {
  const { createClient } = await vi.importActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js')
  return { supabase: createClient('https://supabase.test', 'test-anon-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) }
})

afterEach(() => vi.unstubAllGlobals())
const selection = () => ['z-primeiro.mp3', 'a-segundo.m4a', 'm-terceiro.wav'].map((name, index) => ({ file: new File(['audio'], name, { type: ['audio/mpeg', 'audio/mp4', 'audio/wav'][index] }), durationSeconds: 60 }))
function transport(failSecond = false, failCompletionOnce = false) {
  const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = []
  let failedComplete = false
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const body = init.method === 'POST' ? JSON.parse(String(init.body)) : undefined
    calls.push({ method: init.method ?? 'GET', path: url.pathname, body })
    if (url.hostname === 'r2.example') return new Response(null, { status: failSecond && url.pathname === '/2' ? 500 : 200, headers: { ETag: 'etag' } })
    let response: unknown = { workerAvailable: true }
    if (body?.action === 'create') response = { jobId: 'job-1', uploads: [1, 2, 3].map(position => ({ fileId: `file-${position}`, uploadId: `upload-${position}`, partSize: 20, parts: [{ partNumber: 1, url: `https://r2.example/${position}` }] })) }
    if (body?.action === 'complete' && failCompletionOnce && !failedComplete) { failedComplete = true; throw new Error('response lost') }
    return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } })
  }))
  return calls
}

describe('ordered assembly audio upload', () => {
  it('uploads every file in selection order and completes the set only afterward', async () => {
    const calls = transport()
    const progress = vi.fn()
    const result = await ataTranscriptionsRepoSupabase.upload('ata-1', selection(), 'Pauta.', 'old-job', progress)
    expect(result).toEqual({ jobId: 'job-1', workerAvailable: true })
    expect(calls.map(c => c.body?.action ?? c.path)).toEqual(['create', '/1', '/2', '/3', 'complete'])
    expect(calls[0].body).toMatchObject({ files: [
      { fileName: 'z-primeiro.mp3', mimeType: 'audio/mpeg', sizeBytes: 5, durationSeconds: 60 },
      { fileName: 'a-segundo.m4a', mimeType: 'audio/mp4', sizeBytes: 5, durationSeconds: 60 },
      { fileName: 'm-terceiro.wav', mimeType: 'audio/wav', sizeBytes: 5, durationSeconds: 60 },
    ], expectedJobId: 'old-job', contextText: 'Pauta.' })
    expect(calls.at(-1)?.body).toEqual({ action: 'complete', jobId: 'job-1', files: [1,2,3].map(position => ({ fileId: `file-${position}`, uploadId: `upload-${position}`, parts: [{ partNumber: 1, etag: 'etag' }] })) })
    expect(progress.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]])
  })
  it('cancels the whole job if a part cannot upload and never uploads later files', async () => {
    const calls = transport(true)
    await expect(ataTranscriptionsRepoSupabase.upload('ata-1', selection())).rejects.toThrow(/HTTP 500/)
    expect(calls.some(c => c.path === '/3')).toBe(false)
    expect(calls.some(c => c.body?.action === 'complete')).toBe(false)
    expect(calls.at(-1)?.body).toEqual({ action: 'cancel', jobId: 'job-1' })
  })
  it('retries a lost completion response without reuploading or cancelling a queued job', async () => {
    const calls = transport(false, true)
    await ataTranscriptionsRepoSupabase.upload('ata-1', selection())
    expect(calls.filter(c => c.method === 'PUT')).toHaveLength(3)
    expect(calls.filter(c => c.body?.action === 'complete')).toHaveLength(2)
    expect(calls.some(c => c.body?.action === 'cancel')).toBe(false)
  })
})
