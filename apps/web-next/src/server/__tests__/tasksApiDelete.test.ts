import { describe, expect, it } from 'vitest'
import { createTasksApiHandler, type DispatchArgs, type TasksApiConfig, type TasksApiDependencies } from '../tasksApiService'
import { credentialCreateSchema, taskScopeSchema } from '@/lib/tasksApiContracts'
import { attachmentPathsFromUrls } from '../tasksApiRuntime'

const actor = '11111111-1111-4111-8111-111111111111'
const taskId = '22222222-2222-4222-8222-222222222222'
const updatedAt = '2026-10-04T10:20:30.123456+00:00'
const task = { id: taskId, ticketId: 42, ticketOcta: null, title: 'Task', description: null, priority: 'NORMAL', dueDate: null, statusId: actor, assignedToId: null, createdById: actor, tags: [], isPrivate: false, oportunidadeId: null, commentCount: 0, attachmentCount: 0, recurrenceId: null, recurrenceOccurrence: null, createdAt: updatedAt, updatedAt, assignedTo: null, createdBy: null, recurrence: null }
const apiKey = 'omnia_api_' + 'A'.repeat(43)

function harness(config: Partial<TasksApiConfig> = {}, dispatchResult: { status: number; data?: unknown; error?: { code: string; message: string }; removedFiles?: unknown } = { status: 200, data: task }, removeStoredFiles?: (urls: string[]) => Promise<void>) {
  const calls: DispatchArgs[] = []
  const deps: TasksApiDependencies = {
    verifyBrowser: async token => token === 'browser.jwt.token' ? actor : null,
    dispatch: async args => {
      calls.push(args)
      return dispatchResult
    },
    config: () => ({ readEnabled: true, writeEnabled: true, exchangeSecret: 'backend-secret', ...config }),
    removeStoredFiles,
  }
  return { handle: createTasksApiHandler(deps), calls }
}
function request(path: string, method = 'DELETE', token = 'browser.jwt.token') {
  return new Request('https://omnia.test/api/v1/' + path, { method, headers: { Authorization: `Bearer ${token}` } })
}
async function body(response: Response) { return response.json() }

describe('task delete contracts', () => {
  it('adds the delete scope without widening the rest', () => {
    expect(taskScopeSchema.safeParse('tasks:delete').success).toBe(true)
    expect(credentialCreateSchema.safeParse({ name: 'key', audience: 'api', scopes: ['tasks:read', 'tasks:create', 'tasks:update', 'tasks:comment', 'tasks:delete'] }).success).toBe(true)
    expect(credentialCreateSchema.safeParse({ name: 'key', audience: 'api', scopes: ['tasks:remove'] }).success).toBe(false)
  })
})

describe('official task delete HTTP service', () => {
  it('dispatches tasks.delete with only the validated id and returns the deleted task without a version', async () => {
    const h = harness()
    const res = await h.handle(request(`tasks/${taskId}`), 'tasks.delete', taskId)
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBeNull()
    expect(await body(res)).toMatchObject({ data: { id: taskId }, requestId: expect.any(String) })
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({ p_operation: 'tasks.delete', p_payload: { id: taskId }, p_auth_user_id: actor, p_token_digest: null, p_idempotency_key: null })
  })

  it('uses the same write gate for integration keys as the other writes', async () => {
    const h = harness({ writeEnabled: false })
    const res = await h.handle(request(`tasks/${taskId}`, 'DELETE', apiKey), 'tasks.delete', taskId)
    expect(res.status).toBe(503)
    expect((await body(res)).error.code).toBe('INTEGRATIONS_DISABLED')
    expect(h.calls).toHaveLength(0)
  })

  it('rejects a malformed id and any non-DELETE method before dispatch', async () => {
    const h = harness()
    const badId = await h.handle(request('tasks/not-a-uuid'), 'tasks.delete', 'not-a-uuid')
    expect(badId.status).toBe(400)
    const wrongMethod = await h.handle(request(`tasks/${taskId}`, 'GET'), 'tasks.delete', taskId)
    expect(wrongMethod.status).toBe(405)
    expect(wrongMethod.headers.get('allow')).toBe('DELETE')
    expect(h.calls).toHaveLength(0)
  })

  it('passes the dispatcher denial and repeated-delete NOT_FOUND through as typed errors', async () => {
    const forbidden = harness({}, { status: 403, error: { code: 'FORBIDDEN', message: 'Access denied' } })
    const denied = await forbidden.handle(request(`tasks/${taskId}`), 'tasks.delete', taskId)
    expect(denied.status).toBe(403)
    expect((await body(denied)).error.code).toBe('FORBIDDEN')

    const gone = harness({}, { status: 404, error: { code: 'NOT_FOUND', message: 'Task not found' } })
    const missing = await gone.handle(request(`tasks/${taskId}`), 'tasks.delete', taskId)
    expect(missing.status).toBe(404)
    expect((await body(missing)).error.code).toBe('NOT_FOUND')
  })

  it('refuses a dispatcher result whose status does not match the typed error', async () => {
    const h = harness({}, { status: 403, error: { code: 'NOT_FOUND', message: 'Task not found' } })
    const res = await h.handle(request(`tasks/${taskId}`), 'tasks.delete', taskId)
    expect(res.status).toBe(500)
    expect((await body(res)).error.code).toBe('INTERNAL_ERROR')
  })
})

describe('stored file cleanup after a task delete', () => {
  const urls = ['https://x.supabase.co/storage/v1/object/public/attachments/a/one.pdf', 42, 'https://x.supabase.co/storage/v1/object/public/attachments/b/two.png']
  it('hands the string URLs to the cleanup hook once, and never exposes them in the response', async () => {
    const seen: string[][] = []
    const h = harness({}, { status: 200, data: task, removedFiles: urls }, async value => { seen.push(value) })
    const res = await h.handle(request(`tasks/${taskId}`), 'tasks.delete', taskId)
    expect(res.status).toBe(200)
    expect(seen).toEqual([[urls[0], urls[2]]])
    expect(JSON.stringify(await body(res))).not.toContain('supabase.co')
  })
  it('still answers 200 when the cleanup rejects', async () => {
    const h = harness({}, { status: 200, data: task, removedFiles: urls }, async () => { throw new Error('storage down') })
    const res = await h.handle(request(`tasks/${taskId}`), 'tasks.delete', taskId)
    expect(res.status).toBe(200)
  })
  it('does not run the cleanup for a failed delete or another operation', async () => {
    const seen: string[][] = []
    const denied = harness({}, { status: 403, error: { code: 'FORBIDDEN', message: 'Access denied' }, removedFiles: urls }, async value => { seen.push(value) })
    expect((await denied.handle(request(`tasks/${taskId}`), 'tasks.delete', taskId)).status).toBe(403)
    const get = harness({}, { status: 200, data: task, removedFiles: urls }, async value => { seen.push(value) })
    expect((await get.handle(request(`tasks/${taskId}`, 'GET'), 'tasks.get', taskId)).status).toBe(200)
    expect(seen).toEqual([])
  })
})

describe('attachmentPathsFromUrls', () => {
  const origin = 'https://x.supabase.co'
  const base = origin + '/storage/v1/object/public/attachments/'
  it('keeps only the project attachments bucket, decoded and deduplicated', () => {
    expect(attachmentPathsFromUrls([base + 'a/one%20file.pdf', base + 'a/one%20file.pdf', base + 'b/two.png'], origin)).toEqual(['a/one file.pdf', 'b/two.png'])
  })
  it('ignores other hosts, buckets, malformed values and traversal', () => {
    expect(attachmentPathsFromUrls([
      'https://evil.test/storage/v1/object/public/attachments/a.pdf',
      origin + '/storage/v1/object/public/admissoes/a.pdf',
      origin + '/storage/v1/object/sign/attachments/a.pdf',
      base + '../admissoes/a.pdf',
      base + 'a//b.pdf',
      base + '%2Fetc/passwd',
      'not a url',
      '',
    ], origin)).toEqual([])
  })
  it('keeps a dot-segment URL inside the bucket because the URL parser resolves it first', () => {
    expect(attachmentPathsFromUrls([base + 'a/%2e%2e/b.pdf'], origin)).toEqual(['b.pdf'])
  })
  it('returns nothing when the project URL is invalid', () => {
    expect(attachmentPathsFromUrls([base + 'a.pdf'], 'nope')).toEqual([])
  })
})
