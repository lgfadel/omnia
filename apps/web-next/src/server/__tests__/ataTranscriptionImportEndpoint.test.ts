import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

let handler: (request: Request) => Promise<Response>
let authorized: boolean
let activationError: boolean
let rawText: string | null
let job: Record<string, unknown> | null
let removed: boolean
let completeLost: boolean
let cancelLost: boolean
let externalRequests: string[]
const authUser = { id: 'auth-1', aud: 'authenticated', role: 'authenticated', email: 'admin@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-10-23T12:00:00Z' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function externalHttp(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  externalRequests.push(`${init?.method ?? 'GET'} ${url.hostname}${url.pathname}`)
  if (url.hostname.endsWith('.r2.cloudflarestorage.com')) {
    return new Response('', { status: 200, headers: { 'Content-Length': '500' } })
  }
  if (url.pathname === '/auth/v1/user') return json(authUser)
  if (url.pathname === '/rest/v1/omnia_users') return json({ id: 'profile-1', roles: authorized ? ['ADMIN'] : ['USUARIO'] })
  if (url.pathname === '/rest/v1/omnia_atas') return json({ id: 'ata-1', responsible_id: 'another-profile' })
  if (url.pathname === '/rest/v1/omnia_ata_transcription_jobs') {
    if (init?.method === 'POST') { job = JSON.parse(String(init.body)); return json(null, 201) }
    if (init?.method === 'DELETE') { removed = true; job = null; return json(null) }
    if (init?.method === 'PATCH' && completeLost) return json({ code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object', details: 'The result contains 0 rows' }, 406)
    if (url.searchParams.get('id') === 'eq.previous-job') return json({ storage_path: 'prior.mp3', storage_provider: 'r2' })
    return json(job)
  }
  if (url.pathname === '/rest/v1/rpc/omnia_cancel_ata_transcription_upload') {
    return cancelLost ? json({ code: '55000', message: 'O áudio já foi enfileirado.' }, 409) : json(null)
  }
  if (url.pathname === '/rest/v1/rpc/omnia_activate_ata_transcription') {
    if (activationError) return json({ code: '40001', message: 'A transcrição atual mudou.' }, 409)
    const body = JSON.parse(String(init?.body))
    expect(body.p_job_id).toBe(job?.id)
    expect(body.p_expected_job_id).toBeNull()
    rawText = body.p_raw_text
    return json({ previousJob: null })
  }
  throw new Error(`Unexpected external request: ${url.pathname}`)
}

const denoRuntime = {
    env: { get: (key: string) => ({ SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key', R2_ACCOUNT_ID: 'test-account', R2_BUCKET: 'test-bucket', R2_ACCESS_KEY_ID: 'test-access', R2_SECRET_ACCESS_KEY: 'test-secret' })[key as 'SUPABASE_URL'] },
    serve: (fn: typeof handler) => { handler = fn },
}

beforeAll(async () => {
  vi.stubGlobal('Deno', denoRuntime)
  vi.stubGlobal('crypto', webcrypto)
  const edgePath = new URL('../../../../../supabase/functions/ata-transcriptions/index.ts', import.meta.url).pathname
  await import(edgePath)
})

beforeEach(() => {
  vi.stubGlobal('Deno', denoRuntime)
  vi.stubGlobal('crypto', webcrypto)
  authorized = true
  activationError = false
  rawText = null
  job = null
  removed = false
  completeLost = false
  cancelLost = false
  externalRequests = []
  vi.stubGlobal('fetch', vi.fn(externalHttp))
})

afterEach(() => { vi.unstubAllGlobals() })

async function importFile(overrides: Record<string, unknown> = {}) {
  return handler(new Request('https://supabase.test/functions/v1/ata-transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'import', ataId: 'ata-1', fileName: 'zoom.vtt', content: 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nMaria: Contas aprovadas.', expectedJobId: null, ...overrides }),
  }))
}

describe('transcription import Edge Function', () => {
  it('extracts Zoom speech and saves it as a completed text source without audio services', async () => {
    const response = await importFile()
    expect(response.status).toBe(201)
    expect(rawText).toBe('Maria: Contas aprovadas.')
    expect(job).toMatchObject({ source_type: 'text_import', status: 'completed', storage_path: null, storage_provider: null, model: null, original_filename: 'zoom.vtt' })
    expect(await response.json()).toMatchObject({ jobId: job?.id })
  })

  it('denies importing into an ata outside the user team', async () => {
    authorized = false
    expect((await importFile()).status).toBe(403)
    expect(job).toBeNull()
    expect(rawText).toBeNull()
  })

  it('rejects malformed VTT instead of saving incomplete speech', async () => {
    expect((await importFile({ content: 'WEBVTT\n\n1\ninvalid timing\nMaria: Olá.' })).status).toBe(400)
    expect(job).toBeNull()
  })

  it('removes the inactive candidate when the current source changed concurrently', async () => {
    activationError = true
    const response = await importFile()
    expect(response.status).toBe(409)
    expect(removed).toBe(true)
    expect(rawText).toBeNull()
  })

  it('does not delete the previous audio if cancellation won before queueing', async () => {
    job = { id: 'job-1', ata_id: 'ata-1', source_type: 'audio', replaces_job_id: 'previous-job', status: 'uploading', storage_path: 'new.mp3', storage_provider: 'r2', size_bytes: 500 }
    completeLost = true
    const response = await importFile({ action: 'complete', jobId: 'job-1', uploadId: 'upload-1', parts: [{ partNumber: 1, etag: 'etag-1' }] })
    expect(response.status).toBe(409)
    expect(externalRequests.some(request => request.startsWith('DELETE '))).toBe(false)
  })

  it('does not delete an audio object when queueing won before cancellation', async () => {
    job = { id: 'job-1', ata_id: 'ata-1', source_type: 'audio', status: 'uploading', storage_path: 'new.mp3', storage_provider: 'r2' }
    cancelLost = true
    const response = await importFile({ action: 'cancel', jobId: 'job-1', uploadId: 'upload-1' })
    expect(response.status).toBe(409)
    expect(externalRequests.some(request => request.includes('r2.cloudflarestorage.com'))).toBe(false)
  })
})
