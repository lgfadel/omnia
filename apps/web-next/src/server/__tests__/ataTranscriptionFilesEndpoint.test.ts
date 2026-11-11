import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

type Row = Record<string, any>
let handler: (request: Request) => Promise<Response>
let jobs: Row[], files: Row[], events: string[], objects: Map<string, number>, uploads: Map<string, string>
let authorized: boolean, activationError: boolean, queueLost: boolean, cancelLost: boolean
let startFailure: number, completeFailure: string | null, fileInsertFailure: boolean
let queueWonElsewhere: boolean
let starts: number
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function selected(rows: Row[], url: URL) {
  return rows.filter(row => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3)))
}
async function externalHttp(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const method = init?.method ?? 'GET'
  if (url.hostname.endsWith('.r2.cloudflarestorage.com')) {
    const key = decodeURIComponent(url.pathname.replace('/test-bucket/', ''))
    const uploadId = url.searchParams.get('uploadId')
    events.push(`${method} ${key}${uploadId ? ` upload=${uploadId}` : ''}`)
    if (method === 'HEAD') return objects.has(key) ? new Response(null, { headers: { 'content-length': String(objects.get(key)) } }) : new Response(null, { status: 404 })
    if (method === 'POST' && url.searchParams.has('uploads')) {
      starts++
      if (starts === startFailure) return new Response(null, { status: 500 })
      const id = `upload-${starts}`; uploads.set(id, key)
      return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`)
    }
    if (method === 'POST' && uploadId) {
      if (!uploads.has(uploadId) || completeFailure === key) return new Response(null, { status: 500 })
      objects.set(key, Number(files.find(f => f.storage_path === key)?.size_bytes ?? jobs.find(j => j.storage_path === key)?.size_bytes)); uploads.delete(uploadId)
      return new Response('<CompleteMultipartUploadResult/>')
    }
    if (method === 'DELETE') { if (uploadId) uploads.delete(uploadId); else objects.delete(key); return new Response(null, { status: 204 }) }
  }
  if (url.pathname === '/auth/v1/user') return json({ id: 'auth-1', aud: 'authenticated', role: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-10-23T12:00:00Z' })
  if (url.pathname === '/rest/v1/omnia_users') return json({ id: 'profile-1', roles: authorized ? ['ADMIN'] : ['USUARIO'] })
  if (url.pathname === '/rest/v1/omnia_atas') return json({ id: 'ata-1', responsible_id: 'other' })
  if (url.pathname === '/rest/v1/omnia_ata_transcription_files') {
    if (method === 'POST') { if (fileInsertFailure) return json({ message: 'db failed' }, 500); const rows = JSON.parse(String(init?.body)); files.push(...(Array.isArray(rows) ? rows : [rows])); return json(null, 201) }
    if (method === 'PATCH') { selected(files, url).forEach(row => Object.assign(row, JSON.parse(String(init?.body)))); return json(null) }
    return json(selected(files, url).sort((a, b) => a.position - b.position))
  }
  if (url.pathname === '/rest/v1/omnia_ata_transcription_jobs') {
    if (method === 'POST') { jobs.push({ status: 'uploading', ...JSON.parse(String(init?.body)) }); return json(null, 201) }
    if (method === 'DELETE') { const removed = selected(jobs, url); jobs = jobs.filter(j => !removed.includes(j)); files = files.filter(f => !removed.some(j => j.id === f.job_id)); return json(null) }
    if (method === 'PATCH') {
      const patch = JSON.parse(String(init?.body)); events.push(`job ${patch.status ?? 'update'}`)
      if (queueLost && patch.status === 'queued') {
        if (queueWonElsewhere) Object.assign(selected(jobs, url)[0], { status: 'queued' })
        return json(null)
      }
      const rows = selected(jobs, url); rows.forEach(row => Object.assign(row, patch)); return json(rows[0] ?? null)
    }
    return json(selected(jobs, url)[0] ?? null)
  }
  if (url.pathname === '/rest/v1/rpc/omnia_activate_ata_transcription') {
    if (activationError) return json({ code: '40001', message: 'changed' }, 409)
    const body = JSON.parse(String(init?.body)); const current = jobs.find(j => j.is_current)
    if (current) current.is_current = false
    Object.assign(jobs.find(j => j.id === body.p_job_id)!, { is_current: true, replaces_job_id: current?.id ?? null })
    return json({ previousJob: current ?? null })
  }
  if (url.pathname === '/rest/v1/rpc/omnia_cancel_ata_transcription_upload') {
    events.push('cancel')
    if (cancelLost) return json({ code: '55000', message: 'queued' }, 409)
    const id = JSON.parse(String(init?.body)).p_job_id; const job = jobs.find(j => j.id === id)!
    const previous = jobs.find(j => j.id === job.replaces_job_id); if (previous) previous.is_current = true
    jobs = jobs.filter(j => j.id !== id); files = files.filter(f => f.job_id !== id)
    return json(null)
  }
  throw new Error(`Unexpected external request: ${method} ${url}`)
}
const runtime = { env: { get: (key: string) => ({ SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key', R2_ACCOUNT_ID: 'test-account', R2_BUCKET: 'test-bucket', R2_ACCESS_KEY_ID: 'test-access', R2_SECRET_ACCESS_KEY: 'test-secret' })[key] }, serve: (fn: typeof handler) => { handler = fn } }
beforeAll(async () => {
  vi.stubGlobal('Deno', runtime); vi.stubGlobal('crypto', webcrypto)
  await import(new URL('../../../../../supabase/functions/ata-transcriptions/index.ts', import.meta.url).pathname)
})
beforeEach(() => {
  vi.stubGlobal('Deno', runtime); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', vi.fn(externalHttp))
  jobs = []; files = []; events = []; objects = new Map(); uploads = new Map()
  queueWonElsewhere = false; authorized = true; activationError = queueLost = cancelLost = fileInsertFailure = false; startFailure = starts = 0; completeFailure = null
})
afterEach(() => vi.unstubAllGlobals())
const inputFile = (overrides: Row = {}) => ({ fileName: 'same.mp3', mimeType: 'audio/mpeg', sizeBytes: 500, durationSeconds: 30.2, ...overrides })
const call = (payload: Row) => handler(new Request('https://supabase.test/functions/v1/ata-transcriptions', { method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
const create = (list: unknown = [inputFile(), inputFile(), inputFile()]) => call({ action: 'create', ataId: 'ata-1', files: list })
function completion() { return files.map(f => ({ fileId: f.id, uploadId: f.upload_id, parts: [{ partNumber: 1, etag: 'etag-1' }] })) }
function previous() {
  jobs.push({ id: 'previous', ata_id: 'ata-1', status: 'completed', is_current: true, storage_path: 'previous/1.mp3', storage_provider: 'r2' })
  files.push(...[1, 2].map(position => ({ id: `prior-${position}`, job_id: 'previous', position, storage_path: `previous/${position}.mp3`, storage_provider: 'r2' })))
  objects.set('previous/1.mp3', 500); objects.set('previous/2.mp3', 500)
}

describe('ordered audio Edge Function', () => {
  it('creates three ordered unique paths and mirrors first source metadata', async () => {
    const response = await create(); expect(response.status).toBe(201)
    const body = await response.json(); expect(body.uploads).toHaveLength(3)
    expect(files.map(f => f.position)).toEqual([1, 2, 3]); expect(new Set(files.map(f => f.storage_path)).size).toBe(3)
    expect(jobs[0]).toMatchObject({ storage_path: files[0].storage_path, size_bytes: 500, duration_seconds: 31, is_current: true })
    expect(body.uploads.map((u: Row) => u.fileId)).toEqual(files.map(f => f.id))
    expect(body.uploads[0]).toMatchObject({ uploadId: 'upload-1', partSize: 20971520, parts: [{ partNumber: 1, url: expect.any(String) }] })
  })
  it.each([[], [inputFile(), inputFile(), inputFile(), inputFile()], null, {}, [null], [inputFile({ fileName: ' ' })], [inputFile({ fileName: 'x'.repeat(256) })], [inputFile({ sizeBytes: 1.5 })], [inputFile({ sizeBytes: 0 })], [inputFile({ sizeBytes: Number.MAX_SAFE_INTEGER + 1 })], [inputFile({ mimeType: 'text/plain' })], [inputFile({ durationSeconds: -1 })], [inputFile({ durationSeconds: '60' })], [inputFile({ sizeBytes: 600000000 }), inputFile({ sizeBytes: 600000000 })], [inputFile({ durationSeconds: 10800.1 }), inputFile({ durationSeconds: 10800 })]].map(list => [list]))('rejects invalid file list %# before setup', async list => {
    expect((await create(list)).status).toBe(400); expect(jobs).toEqual([]); expect(events).toEqual([])
  })
  it('accepts unknown duration and exact combined boundaries', async () => {
    expect((await create([inputFile({ sizeBytes: 536870912, durationSeconds: 21600 }), inputFile({ sizeBytes: 536870912, durationSeconds: null })])).status).toBe(201)
  })
  it('preserves legacy single-file creation and completion', async () => {
    const response = await call({ action: 'create', ataId: 'ata-1', ...inputFile() }); expect(response.status).toBe(201)
    const body = await response.json(); expect(body).toMatchObject({ uploadId: 'upload-1', parts: [{ partNumber: 1, url: expect.any(String) }] })
    expect((await call({ action: 'complete', jobId: body.jobId, uploadId: body.uploadId, parts: [{ partNumber: 1, etag: 'etag' }] })).status).toBe(200)
    expect(jobs[0].status).toBe('queued')
  })
  it('denies create before storage for unauthorized users', async () => {
    authorized = false; expect((await create()).status).toBe(403); expect(jobs).toEqual([]); expect(events).toEqual([])
  })
  it.each(['missing', 'duplicate', 'foreign', 'wrong-upload'])('rejects %s completion files without completing storage', async mode => {
    await create(); const list = completion()
    if (mode === 'missing') list.pop()
    if (mode === 'duplicate') list[1] = list[0]
    if (mode === 'foreign') list[0].fileId = 'foreign'
    if (mode === 'wrong-upload') list[0].uploadId = 'wrong'
    events = []; expect((await call({ action: 'complete', jobId: jobs[0].id, files: list })).status).toBe(400)
    expect(events).toEqual([]); expect(jobs[0].status).toBe('uploading')
  })
  it('queues only after verifying all files and retries partial completion idempotently', async () => {
    await create(); const list = completion(); completeFailure = files[1].storage_path
    expect((await call({ action: 'complete', jobId: jobs[0].id, files: list })).status).toBe(500)
    expect(jobs[0].status).toBe('uploading'); expect(objects.has(files[0].storage_path)).toBe(true)
    completeFailure = null; events = []
    expect((await call({ action: 'complete', jobId: jobs[0].id, files: list })).status).toBe(200)
    expect(events.some(e => e.startsWith(`POST ${files[0].storage_path}`))).toBe(false)
    expect(events.at(-1)).toBe('job queued'); expect(objects.size).toBe(3)
  })
  it.each(['queued', 'processing', 'completed'])('returns success for repeat complete in %s without modifying objects', async status => {
    await create(); const list = completion(); await call({ action: 'complete', jobId: jobs[0].id, files: list }); jobs[0].status = status; events = []
    const response = await call({ action: 'complete', jobId: jobs[0].id, files: list }); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ status: 'queued' }); expect(events).toEqual([])
  })
  it('acknowledges completion if another request won the same queue transition', async () => {
    await create(); const jobId = jobs[0].id; const list = completion()
    queueLost = true; queueWonElsewhere = true
    const response = await call({ action: 'complete', jobId, files: list })
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ status: 'queued' })
    expect(jobs[0].status).toBe('queued')
  })
  it('acknowledges overlapping completions when both initial object checks miss', async () => {
    await create()
    const jobId = jobs[0].id
    const list = completion()
    const firstPath = `/test-bucket/${files[0].storage_path}`
    let misses = 0
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      const response = await externalHttp(input, init)
      if (init?.method === 'HEAD' && url.pathname === firstPath && response.status === 404) {
        misses += 1
        if (misses === 2) release()
        await barrier
      }
      return response
    }))
    const responses = await Promise.all([call({ action: 'complete', jobId, files: list }), call({ action: 'complete', jobId, files: list })])
    expect(responses.map(response => response.status)).toEqual([200, 200])
    expect(jobs[0].status).toBe('queued')
    expect(objects.size).toBe(3)
  })
  it('preserves predecessor audio when the queue guard loses', async () => {
    previous(); await create(); const job = jobs.find(j => j.status === 'uploading')!; queueLost = true
    expect((await call({ action: 'complete', jobId: job.id, files: completion().filter(f => f.uploadId) })).status).toBe(409)
    expect(objects.has('previous/1.mp3')).toBe(true); expect(objects.has('previous/2.mp3')).toBe(true)
  })
  it('purges every predecessor source only after successful queueing', async () => {
    previous(); await create(); const job = jobs.find(j => j.status === 'uploading')!
    expect((await call({ action: 'complete', jobId: job.id, files: completion().filter(f => f.uploadId) })).status).toBe(200)
    expect(objects.has('previous/1.mp3')).toBe(false); expect(objects.has('previous/2.mp3')).toBe(false)
    expect(events.indexOf('job queued')).toBeLessThan(events.indexOf('DELETE previous/1.mp3'))
  })
  it('snapshots all files before cancel cascades and restores the predecessor', async () => {
    previous(); await create(); const job = jobs.find(j => j.status === 'uploading')!; const paths = files.filter(f => f.job_id === job.id).map(f => f.storage_path)
    paths.forEach(p => objects.set(p, 500)); events = []
    expect((await call({ action: 'cancel', jobId: job.id })).status).toBe(200)
    expect(uploads.size).toBe(0); expect(paths.every(p => !objects.has(p))).toBe(true); expect(jobs[0].is_current).toBe(true); expect(objects.size).toBe(2)
    expect(events[0]).toBe('cancel'); expect(events.filter(e => /^DELETE .* upload=/.test(e))).toHaveLength(3)
    expect(events.filter(e => e.startsWith('DELETE ') && !e.includes(' upload='))).toHaveLength(3)
  })
  it('does not remove objects or uploads if cancel loses', async () => {
    await create(); cancelLost = true; events = []
    expect((await call({ action: 'cancel', jobId: jobs[0].id })).status).toBe(409); expect(events).toEqual(['cancel']); expect(uploads.size).toBe(3)
  })
  it.each(['start', 'insert', 'activation'])('cleans all candidate uploads on %s failure', async mode => {
    previous(); startFailure = mode === 'start' ? 2 : 0; fileInsertFailure = mode === 'insert'; activationError = mode === 'activation'
    expect((await create()).status).toBe(mode === 'activation' ? 409 : 500)
    expect(jobs).toHaveLength(1); expect(jobs[0].is_current).toBe(true); expect(files.every(f => f.job_id === 'previous')).toBe(true); expect(uploads.size).toBe(0); expect(objects.size).toBe(2)
  })
  it('selects requested owned audio or first file and rejects unrelated file IDs', async () => {
    await create(); jobs[0].status = 'completed'
    const first = await call({ action: 'audio', jobId: jobs[0].id }); expect((await first.json()).url).toContain(files[0].storage_path)
    const second = await call({ action: 'audio', jobId: jobs[0].id, fileId: files[1].id }); expect((await second.json()).url).toContain(files[1].storage_path)
    expect((await call({ action: 'audio', jobId: jobs[0].id, fileId: 'unrelated' })).status).toBe(404)
  })
  it('plays and completes legacy jobs without source rows', async () => {
    jobs.push({ id: 'legacy', ata_id: 'ata-1', is_current: true, status: 'uploading', storage_path: 'legacy.mp3', storage_provider: 'r2', size_bytes: 500 })
    uploads.set('legacy-upload', 'legacy.mp3')
    const response = await call({ action: 'complete', jobId: 'legacy', uploadId: 'legacy-upload', parts: [{ partNumber: 1, etag: 'legacy-etag' }] })
    expect(response.status).toBe(200); expect(jobs[0].status).toBe('queued'); expect(objects.get('legacy.mp3')).toBe(500)
    const audio = await call({ action: 'audio', jobId: 'legacy' }); expect((await audio.json()).url).toContain('/legacy.mp3?')
  })
  it('purges all predecessor files when replacing audio with imported text', async () => {
    previous()
    const response = await call({ action: 'import', ataId: 'ata-1', fileName: 'meeting.txt', content: 'Contas aprovadas.', expectedJobId: 'previous' })
    expect(response.status).toBe(201); expect(objects.size).toBe(0)
    expect(jobs.find(j => j.source_type === 'text_import')).toMatchObject({ status: 'completed', is_current: true })
  })
  it('denies file playback and completion outside the authorized team', async () => {
    await create(); const jobId = jobs[0].id; const list = completion(); authorized = false; events = []
    expect((await call({ action: 'audio', jobId, fileId: files[0].id })).status).toBe(403)
    expect((await call({ action: 'complete', jobId, files: list })).status).toBe(403)
    expect(events).toEqual([]); expect(jobs[0].status).toBe('uploading')
  })
  it('does not finalize a multi-file job through a legacy single-file payload', async () => {
    await create(); events = []
    expect((await call({ action: 'complete', jobId: jobs[0].id, uploadId: 'upload-1', parts: [{ partNumber: 1, etag: 'etag' }] })).status).toBe(400)
    expect(events).toEqual([]); expect(jobs[0].status).toBe('uploading')
  })
  it('purges all sources on discard', async () => {
    await create(); jobs[0].status = 'completed'; files.forEach(f => objects.set(f.storage_path, 500))
    expect((await call({ action: 'discard', jobId: jobs[0].id })).status).toBe(200); expect(objects.size).toBe(0); expect(uploads.size).toBe(0)
  })
})
