import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  documents: [] as Array<Record<string, unknown>>,
  storedFiles: new Map<string, { size: number; arrayBuffer: () => Promise<ArrayBuffer> }>(),
  signedPaths: [] as string[],
  downloadedPaths: [] as string[],
  removedPaths: [] as string[],
  changedTables: [] as string[],
  encodedPaths: [] as string[],
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'auth-1' } }, error: null }) },
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let operation = 'select'
      let value: Record<string, unknown> = {}
      const result = () => {
        if (operation !== 'select') state.changedTables.push(table)
        if (table === 'omnia_users') return { id: 'user-1', roles: ['ADMIN'] }
        if (table === 'omnia_atas') return { id: 'ata-1', title: 'Assembleia', responsible_id: null, condominium_id: null, meeting_date: null }
        if (table === 'omnia_ata_minuta_settings') return { model: 'test-model', reasoning_effort: 'high', system_prompt: 'Secretário.' }
        if (table === 'omnia_ata_transcription_jobs') return { id: 'job-1', context_text: null }
        if (table === 'omnia_ata_transcriptions') return { id: 'transcription-1', raw_text: 'Assembleia transcrita.', revised_text: null }
        if (table === 'omnia_ata_minuta_documents') {
          if (operation === 'insert') {
            const document = { id: 'document-new', created_at: '2026-10-02T12:00:00Z', ...value }
            state.documents.push(document)
            return document
          }
          return state.documents.filter((row) => Object.entries(filters).every(([key, expected]) => row[key] === expected))
        }
        return null
      }
      const query = {
        select: () => query,
        eq: (key: string, expected: unknown) => { filters[key] = expected; return query },
        order: () => query,
        limit: () => query,
        update: (row: Record<string, unknown>) => { operation = 'update'; value = row; return query },
        insert: (row: Record<string, unknown>) => { operation = 'insert'; value = row; return query },
        single: async () => ({ data: result(), error: null }),
        maybeSingle: async () => {
          const data = result()
          return { data: Array.isArray(data) ? data[0] ?? null : data, error: null }
        },
        then: (resolve: (response: { data: unknown; error: null }) => unknown) => Promise.resolve(resolve({ data: result(), error: null })),
      }
      return query
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => {
          state.signedPaths.push(path)
          return { data: { token: 'upload-token' }, error: null }
        },
        download: async (path: string) => {
          state.downloadedPaths.push(path)
          return { data: state.storedFiles.get(path) ?? null, error: null }
        },
        remove: async (paths: string[]) => {
          state.removedPaths.push(...paths)
          paths.forEach((path) => state.storedFiles.delete(path))
          return { data: [], error: null }
        },
      }),
    },
  }),
}))

const { createMinutaDocumentUpload, confirmMinutaDocumentUpload, streamMinutaTurn } = await import('../ataMinutaService')
const auth = 'Bearer test-token'
const path = 'ata-1/user-1/file-apuracao.pdf'

function existingDocument(sizeBytes: number, storagePath = 'ata-1/user-1/existing-convocacao.pdf') {
  return { id: 'document-existing', ata_id: 'ata-1', kind: 'convocacao', original_filename: 'convocacao.pdf', size_bytes: sizeBytes, storage_path: storagePath, created_by: 'user-1', created_at: '2026-10-01T12:00:00Z' }
}

function storedFile(storagePath: string, size: number) {
  state.storedFiles.set(storagePath, {
    size,
    arrayBuffer: async () => {
      state.encodedPaths.push(storagePath)
      return new Uint8Array([37, 80, 68, 70]).buffer
    },
  })
}

describe('support PDF upload and generation budget', () => {
  beforeEach(() => {
    state.documents = []
    state.storedFiles.clear()
    state.signedPaths = []
    state.downloadedPaths = []
    state.removedPaths = []
    state.changedTables = []
    state.encodedPaths = []
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('prepares a signed direct upload for a PDF larger than 25 MiB', async () => {
    await expect(createMinutaDocumentUpload(auth, 'ata-1', { fileName: 'apuracao.pdf', sizeBytes: 30_000_000 })).resolves.toMatchObject({ token: 'upload-token' })
  })

  it('rejects a combined size above 45 MiB before creating an upload token', async () => {
    state.documents = [existingDocument(25_000_000)]
    await expect(createMinutaDocumentUpload(auth, 'ata-1', { fileName: 'apuracao.pdf', sizeBytes: 22_185_921 })).rejects.toThrow('limite total de 45 MB')
    expect(state.signedPaths).toEqual([])
  })

  it('confirms a PDF when its size and combined budget are valid', async () => {
    state.documents = [existingDocument(1_000_000)]
    storedFile(path, 30_000_000)
    await expect(confirmMinutaDocumentUpload(auth, 'ata-1', { fileName: 'apuracao.pdf', kind: 'apuracao', sizeBytes: 30_000_000, storagePath: path })).resolves.toMatchObject({ size_bytes: 30_000_000 })
    expect(state.documents).toHaveLength(2)
  })

  it('checks the budget again at confirmation after another PDF was attached', async () => {
    state.documents = [existingDocument(25_000_000)]
    storedFile(path, 23_000_000)
    await expect(confirmMinutaDocumentUpload(auth, 'ata-1', { fileName: 'apuracao.pdf', kind: 'apuracao', sizeBytes: 23_000_000, storagePath: path })).rejects.toThrow('limite total de 45 MB')
    expect(state.documents).toHaveLength(1)
    expect(state.downloadedPaths).toEqual([])
  })

  it('preserves idempotent confirmation without counting the same PDF twice', async () => {
    state.documents = [existingDocument(30_000_000, path)]
    await expect(confirmMinutaDocumentUpload(auth, 'ata-1', { fileName: 'apuracao.pdf', kind: 'apuracao', sizeBytes: 30_000_000, storagePath: path })).resolves.toMatchObject({ id: 'document-existing' })
    expect(state.documents).toHaveLength(1)
    expect(state.downloadedPaths).toEqual([])
  })

  it('removes an uploaded PDF whose actual size differs from the declared size', async () => {
    storedFile(path, 2000)
    await expect(confirmMinutaDocumentUpload(auth, 'ata-1', { fileName: 'apuracao.pdf', kind: 'apuracao', sizeBytes: 1000, storagePath: path })).rejects.toThrow('não corresponde ao tamanho informado')
    expect(state.storedFiles.has(path)).toBe(false)
    expect(state.documents).toEqual([])
  })

  it('rejects an oversized existing PDF set before downloads or changing the current minuta', async () => {
    state.documents = [existingDocument(25_000_000), existingDocument(23_000_000, path)]
    await expect(streamMinutaTurn(auth, 'ata-1', undefined).next()).rejects.toThrow('limite total de 45 MB')
    expect(state.downloadedPaths).toEqual([])
    expect(state.changedTables).toEqual([])
  })

  it('rejects corrupt stored-size metadata before base64 encoding or changing the current minuta', async () => {
    state.documents = [existingDocument(1000, path)]
    storedFile(path, 2000)
    await expect(streamMinutaTurn(auth, 'ata-1', undefined).next()).rejects.toThrow('não corresponde ao tamanho informado')
    expect(state.encodedPaths).toEqual([])
    expect(state.changedTables).toEqual([])
  })
})
