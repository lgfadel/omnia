import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  documents: [] as Array<Record<string, unknown>>,
  storedFiles: new Map<string, { size: number; arrayBuffer: () => Promise<ArrayBuffer> }>(),
  signedPaths: [] as string[],
  downloadedPaths: [] as string[],
  removedPaths: [] as string[],
  changedTables: [] as string[],
  encodedPaths: [] as string[],
  uploads: [] as Array<{ path: string; bytes: Uint8Array; options: Record<string, unknown> }>,
  roles: ['ADMIN'] as string[],
  responsibleId: null as string | null,
  validAuth: true,
  insertFailure: null as 'before' | 'after' | 'conflict' | null,
  insertAttempted: false,
  cleanupLookupError: false,
  storageReadError: false,
  racingUpload: null as Uint8Array | null,
  legacyMissingObjectError: false,
  legacyMissingObjectBody: null as Record<string, string> | null,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.validAuth ? { id: 'auth-1' } : null }, error: null }) },
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let operation = 'select'
      let value: Record<string, unknown> = {}
      const result = () => {
        if (operation !== 'select') state.changedTables.push(table)
        if (table === 'omnia_users') return { id: 'user-1', roles: state.roles }
        if (table === 'omnia_atas') return { id: 'ata-1', title: 'Assembleia', responsible_id: state.responsibleId, condominium_id: null, meeting_date: null }
        if (table === 'omnia_ata_minuta_settings') return { model: 'test-model', reasoning_effort: 'high', system_prompt: 'Secretário.' }
        if (table === 'omnia_ata_transcription_jobs') return { id: 'job-1', context_text: null }
        if (table === 'omnia_ata_transcriptions') return { id: 'transcription-1', raw_text: 'Assembleia transcrita.', revised_text: null }
        if (table === 'omnia_ata_minuta_documents') {
          if (operation === 'insert') {
            state.insertAttempted = true
            if (state.insertFailure === 'before') return null
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
        single: async () => {
          const data = result()
          const error = table === 'omnia_ata_minuta_documents' && operation === 'insert' && state.insertFailure ? { message: 'Falha ao salvar documento.', code: state.insertFailure === 'conflict' ? '23505' : 'XX000' } : null
          return { data: error ? null : data, error }
        },
        maybeSingle: async () => {
          if (table === 'omnia_ata_minuta_documents' && state.insertAttempted && state.cleanupLookupError) return { data: null, error: { message: 'Consulta indisponível.' } }
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
          if (state.storageReadError) return { data: null, error: { statusCode: '500', message: 'Storage indisponível.' } }
          const data = state.storedFiles.get(path) ?? null
          if (!data && state.legacyMissingObjectError) return { data: null, error: { name: 'StorageUnknownError', message: '{}', originalError: new Response(JSON.stringify(state.legacyMissingObjectBody ?? { statusCode: '404', error: 'not_found', message: 'Object not found', code: 'NoSuchKey' }), { status: 400 }) } }
          return { data, error: data ? null : { statusCode: '404', message: 'Object not found' } }
        },
        upload: async (path: string, bytes: Uint8Array, options: Record<string, unknown>) => {
          state.uploads.push({ path, bytes: bytes.slice(), options })
          const stored = state.racingUpload ?? bytes
          state.storedFiles.set(path, { size: stored.byteLength, arrayBuffer: async () => stored.slice().buffer as ArrayBuffer })
          return state.racingUpload ? { data: null, error: { statusCode: '409', message: 'The resource already exists' } } : { data: { path }, error: null }
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

const { createMinutaDocumentUpload, confirmMinutaDocumentUpload, uploadMinutaDocument, streamMinutaTurn } = await import('../ataMinutaService')
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
    state.uploads = []
    state.roles = ['ADMIN']
    state.responsibleId = null
    state.validAuth = true
    state.insertFailure = null
    state.insertAttempted = false
    state.cleanupLookupError = false
    state.storageReadError = false
    state.racingUpload = null
    state.legacyMissingObjectError = false
    state.legacyMissingObjectBody = null
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

  const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255])
  const recovery = () => ({ fileName: 'apuracao.pdf', kind: 'apuracao' as const, bytes: pdfBytes, storagePath: path })

  it('recovers exact PDF bytes at the original signed path with private PDF metadata', async () => {
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).resolves.toMatchObject({ original_filename: 'apuracao.pdf', kind: 'apuracao', size_bytes: 11 })
    expect(state.uploads).toEqual([{ path, bytes: pdfBytes, options: { contentType: 'application/pdf', upsert: false } }])
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0]).toMatchObject({ storage_path: path, created_by: 'user-1' })
  })

  it('preserves a Unicode original filename while using its owned sanitized path', async () => {
    await expect(uploadMinutaDocument(auth, 'ata-1', { ...recovery(), fileName: 'Convocação.pdf', storagePath: 'ata-1/user-1/file-Convocac_a_o.pdf' })).resolves.toMatchObject({ original_filename: 'Convocação.pdf' })
  })

  it('recognizes the production SDK missing-object response nested in StorageUnknownError', async () => {
    state.legacyMissingObjectError = true
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).resolves.toMatchObject({ size_bytes: 11 })
    expect(state.uploads).toHaveLength(1)
    expect(state.documents).toHaveLength(1)
  })

  it.each([
    { code: 'NoSuchBucket', statusCode: '404', error: 'not_found' },
    { code: 'NoSuchKey', statusCode: '500', error: 'internal_error' },
    { code: 'AccessDenied', statusCode: '403', error: 'access_denied' },
  ])('does not misclassify a different nested Storage response as an absent object: %j', async (body) => {
    state.legacyMissingObjectError = true
    state.legacyMissingObjectBody = body
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('{}')
    expect(state.uploads).toEqual([])
  })

  it('reuses an already received identical PDF without overwriting it', async () => {
    state.storedFiles.set(path, { size: pdfBytes.byteLength, arrayBuffer: async () => pdfBytes.slice().buffer })
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).resolves.toMatchObject({ size_bytes: 11 })
    expect(state.uploads).toEqual([])
    expect(state.documents).toHaveLength(1)
  })

  it('refuses different bytes at the same path instead of overwriting or linking them', async () => {
    state.storedFiles.set(path, { size: pdfBytes.byteLength, arrayBuffer: async () => new Uint8Array(11).buffer })
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('não corresponde')
    expect(state.uploads).toEqual([])
    expect(state.documents).toEqual([])
    expect(state.removedPaths).toEqual([])
  })

  it('confirms a matching direct upload that races the recovery upload', async () => {
    state.racingUpload = pdfBytes
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).resolves.toMatchObject({ size_bytes: 11 })
    expect(state.documents).toHaveLength(1)
  })

  it('keeps repeated recovery idempotent even at the aggregate budget boundary', async () => {
    state.documents = [existingDocument(47_185_909), { ...existingDocument(11, path), kind: 'apuracao', original_filename: 'apuracao.pdf' }]
    state.storedFiles.set(path, { size: pdfBytes.byteLength, arrayBuffer: async () => pdfBytes.slice().buffer })
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).resolves.toMatchObject({ id: 'document-existing' })
    expect(state.documents).toHaveLength(2)
    expect(state.uploads).toEqual([])
  })

  it.each(['ata-other/user-1/file-apuracao.pdf', 'ata-1/user-other/file-apuracao.pdf', 'ata-1/user-1/folder/file-apuracao.pdf', 'ata-1/user-1/file-other.pdf'])('refuses an unowned or mismatched recovery path %s before storage access', async (storagePath) => {
    await expect(uploadMinutaDocument(auth, 'ata-1', { ...recovery(), storagePath })).rejects.toThrow('caminho')
    expect(state.uploads).toEqual([])
    expect(state.downloadedPaths).toEqual([])
  })

  it.each([
    'ata-1/user-1/..\\..\\ata-other\\user-other\\file-apuracao.pdf',
    'ata-1/user-1/%2e%2e%2f%2e%2e%2fata-other%2fuser-other%2ffile-apuracao.pdf',
    'ata-1/user-1/file%5capuracao-apuracao.pdf',
    'ata-1/user-1/file?other-apuracao.pdf',
    'ata-1/user-1/file#other-apuracao.pdf',
  ])('refuses URL-sensitive storage path %s in confirmation and recovery before storage access', async (storagePath) => {
    await expect(confirmMinutaDocumentUpload(auth, 'ata-1', { fileName: 'apuracao.pdf', kind: 'apuracao', sizeBytes: 11, storagePath })).rejects.toThrow('caminho')
    await expect(uploadMinutaDocument(auth, 'ata-1', { ...recovery(), storagePath })).rejects.toThrow('caminho')
    expect(state.downloadedPaths).toEqual([])
    expect(state.uploads).toEqual([])
    expect(state.removedPaths).toEqual([])
  })

  it.each([null, 'invalid'])('refuses missing authentication %s before storage access', async (header) => {
    await expect(uploadMinutaDocument(header, 'ata-1', recovery())).rejects.toThrow('não autenticado')
    expect(state.downloadedPaths).toEqual([])
  })

  it('refuses an invalid session before storage access', async () => {
    state.validAuth = false
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('Sessão inválida')
    expect(state.downloadedPaths).toEqual([])
  })

  it('refuses a user who is neither admin nor responsible for the ata', async () => {
    state.roles = ['USER']
    state.responsibleId = 'user-other'
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('permissão')
    expect(state.downloadedPaths).toEqual([])
  })

  it('allows the responsible user to recover their ata PDF', async () => {
    state.roles = ['USER']
    state.responsibleId = 'user-1'
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).resolves.toMatchObject({ size_bytes: 11 })
  })

  it('rejects a recovery above 4 MiB before storage access while leaving the direct limit unchanged', async () => {
    await expect(uploadMinutaDocument(auth, 'ata-1', { ...recovery(), bytes: new Uint8Array(4_194_305) })).rejects.toThrow('4 MB')
    expect(state.downloadedPaths).toEqual([])
    await expect(createMinutaDocumentUpload(auth, 'ata-1', { fileName: 'apuracao.pdf', sizeBytes: 47_185_920 })).resolves.toMatchObject({ token: 'upload-token' })
  })

  it('allows an exact 4 MiB recovery', async () => {
    await expect(uploadMinutaDocument(auth, 'ata-1', { ...recovery(), bytes: new Uint8Array(4_194_304) })).resolves.toMatchObject({ size_bytes: 4_194_304 })
  })

  it('rejects an empty PDF, non-PDF filename or invalid kind before storage access', async () => {
    await expect(uploadMinutaDocument(auth, 'ata-1', { ...recovery(), bytes: new Uint8Array() })).rejects.toThrow('vazio')
    await expect(uploadMinutaDocument(auth, 'ata-1', { ...recovery(), fileName: 'apuracao.txt' })).rejects.toThrow('PDF')
    await expect(uploadMinutaDocument(auth, 'ata-1', { ...recovery(), kind: 'invalid' as 'apuracao' })).rejects.toThrow('Tipo de documento')
    expect(state.downloadedPaths).toEqual([])
  })

  it('rejects a new recovery exceeding the aggregate budget before storage access', async () => {
    state.documents = [existingDocument(47_185_915)]
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('limite total')
    expect(state.downloadedPaths).toEqual([])
    expect(state.uploads).toEqual([])
  })

  it('does not attempt an upload when storage existence cannot be checked', async () => {
    state.storageReadError = true
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('Storage indisponível')
    expect(state.uploads).toEqual([])
  })

  it('keeps a verified PDF retryable when confirmation fails without risking concurrent links', async () => {
    state.insertFailure = 'before'
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('Falha ao salvar')
    expect(state.documents).toEqual([])
    expect(state.storedFiles.has(path)).toBe(true)
    expect(state.removedPaths).toEqual([])
    state.insertFailure = null
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).resolves.toMatchObject({ size_bytes: 11 })
    expect(state.documents).toHaveLength(1)
    expect(state.uploads).toHaveLength(1)
  })

  it('reuses a document link inserted by a concurrent confirmation', async () => {
    state.insertFailure = 'conflict'
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).resolves.toMatchObject({ size_bytes: 11 })
    expect(state.documents).toHaveLength(1)
    expect(state.storedFiles.has(path)).toBe(true)
    expect(state.removedPaths).toEqual([])
  })

  it('preserves storage if a failed confirmation response still committed its document link', async () => {
    state.insertFailure = 'after'
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('Falha ao salvar')
    expect(state.documents).toHaveLength(1)
    expect(state.storedFiles.has(path)).toBe(true)
    expect(state.removedPaths).toEqual([])
  })

  it('preserves storage when it cannot determine whether confirmation committed', async () => {
    state.insertFailure = 'before'
    state.cleanupLookupError = true
    await expect(uploadMinutaDocument(auth, 'ata-1', recovery())).rejects.toThrow('Falha ao salvar')
    expect(state.storedFiles.has(path)).toBe(true)
    expect(state.removedPaths).toEqual([])
  })
})
