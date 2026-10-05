import { describe, expect, it } from 'vitest'
import { createTasksApiHandler, type DispatchArgs, type TasksApiConfig, type TasksApiDependencies } from '../tasksApiService'
import { commentCreateSchema, commentSchema, commentUpdateSchema, credentialCreateSchema, taskScopeSchema } from '@/lib/tasksApiContracts'

const actor = '11111111-1111-4111-8111-111111111111'
const taskId = '22222222-2222-4222-8222-222222222222'
const commentId = '33333333-3333-4333-8333-333333333333'
const createdAt = '2026-10-04T10:20:30.123456+00:00'
const comment = { id: commentId, taskId, body: 'Texto', authorId: actor, author: { id: actor, name: 'Ana', email: 'ana@example.com', roles: ['USUARIO'], avatarUrl: null, color: null }, createdAt }
const apiKey = 'omnia_api_' + 'A'.repeat(43)

function harness(config: Partial<TasksApiConfig> = {}, data: unknown = comment) {
  const calls: DispatchArgs[] = []
  const deps: TasksApiDependencies = {
    verifyBrowser: async token => token === 'browser.jwt.token' ? actor : null,
    dispatch: async args => {
      calls.push(args)
      if (args.p_operation === 'comments.list') return { status: 200, data: { items: [comment], nextCursor: { createdAt, id: commentId } } }
      return { status: args.p_operation === 'comments.create' ? 201 : 200, data }
    },
    config: () => ({ readEnabled: true, writeEnabled: true, exchangeSecret: 'backend-secret', ...config }),
  }
  return { handle: createTasksApiHandler(deps), calls }
}
function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return new Request('https://omnia.test/api/v1/' + path, { method, headers: { Authorization: 'Bearer browser.jwt.token', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}
async function code(response: Response) { return (await response.json()).error?.code }

describe('comment contracts', () => {
  it('adds the comment scope without widening the existing ones', () => {
    expect(taskScopeSchema.safeParse('tasks:comment').success).toBe(true)
    expect(credentialCreateSchema.safeParse({ name: 'key', audience: 'api', scopes: ['tasks:read', 'tasks:create', 'tasks:update', 'tasks:comment'] }).success).toBe(true)
    expect(credentialCreateSchema.safeParse({ name: 'key', audience: 'api', scopes: ['tasks:comments'] }).success).toBe(false)
  })
  it('trims the body and bounds it', () => {
    expect(commentCreateSchema.parse({ body: '  olá  ' })).toEqual({ body: 'olá' })
    expect(commentUpdateSchema.parse({ body: '  olá  ' })).toEqual({ body: 'olá' })
    for (const schema of [commentCreateSchema, commentUpdateSchema]) {
      expect(schema.safeParse({ body: '   ' }).success).toBe(false)
      expect(schema.safeParse({ body: 'x'.repeat(10001) }).success).toBe(false)
      expect(schema.safeParse({ body: 'x'.repeat(10000) }).success).toBe(true)
      expect(schema.safeParse({}).success).toBe(false)
    }
  })
  it.each(['authorId', 'author_id', 'taskId', 'id', 'createdAt', 'createdBy', 'actor'])('rejects client-chosen field %s', field => {
    expect(commentCreateSchema.safeParse({ body: 'x', [field]: actor }).success).toBe(false)
    expect(commentUpdateSchema.safeParse({ body: 'x', [field]: actor }).success).toBe(false)
  })
  it('keeps the public comment DTO strict with a nullable author', () => {
    expect(commentSchema.parse({ ...comment, author: null }).author).toBeNull()
    expect(commentSchema.safeParse({ ...comment, created_by: actor }).success).toBe(false)
  })
})

describe('official task comment HTTP service', () => {
  it('lists comments of a task with a roundtripped opaque cursor', async () => {
    const h = harness()
    const res = await h.handle(request(`tasks/${taskId}/comments?limit=20`), 'comments.list', taskId)
    expect(res.status).toBe(200)
    expect(res.headers.get('ETag')).toBeNull()
    expect(h.calls[0]).toMatchObject({ p_operation: 'comments.list', p_auth_user_id: actor, p_payload: { taskId, limit: 20 } })
    const json = await res.json()
    expect(json.data.items[0].id).toBe(commentId)
    const next = await h.handle(request(`tasks/${taskId}/comments?cursor=${json.data.nextCursor}`), 'comments.list', taskId)
    expect(next.status).toBe(200)
    expect(h.calls[1].p_payload).toEqual({ taskId, limit: 50, cursor: { createdAt, id: commentId } })
  })
  it.each(['limit=0', 'limit=101', 'cursor=not-a-cursor', 'actor=x', 'limit=5&limit=6'])('rejects invalid list query %s before dispatch', async query => {
    const h = harness()
    expect(await code(await h.handle(request(`tasks/${taskId}/comments?${query}`), 'comments.list', taskId))).toBe('VALIDATION_ERROR')
    expect(h.calls).toHaveLength(0)
  })
  it('creates a comment with a required idempotency key and server-chosen author', async () => {
    const h = harness()
    expect((await h.handle(request(`tasks/${taskId}/comments`, 'POST', { body: 'Texto' }), 'comments.create', taskId)).status).toBe(400)
    expect(h.calls).toHaveLength(0)
    const res = await h.handle(request(`tasks/${taskId}/comments`, 'POST', { body: '  Texto  ' }, { 'Idempotency-Key': 'comment-1' }), 'comments.create', taskId)
    expect(res.status).toBe(201)
    expect(res.headers.get('ETag')).toBeNull()
    expect(h.calls[0]).toMatchObject({ p_operation: 'comments.create', p_idempotency_key: 'comment-1', p_payload: { taskId, body: 'Texto' } })
    expect((await res.json()).data.id).toBe(commentId)
  })
  it('updates a comment without a task version precondition', async () => {
    const h = harness()
    expect((await h.handle(request(`tasks/${taskId}/comments/${commentId}`, 'PATCH', { body: 'Novo' }), 'comments.update', taskId, commentId)).status).toBe(400)
    const res = await h.handle(request(`tasks/${taskId}/comments/${commentId}`, 'PATCH', { body: 'Novo' }, { 'Idempotency-Key': 'edit-1' }), 'comments.update', taskId, commentId)
    expect(res.status).toBe(200)
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({ p_operation: 'comments.update', p_idempotency_key: 'edit-1', p_payload: { taskId, id: commentId, body: 'Novo' } })
  })
  it('deletes a comment returning the removed representation, with no body or key', async () => {
    const h = harness()
    const res = await h.handle(request(`tasks/${taskId}/comments/${commentId}`, 'DELETE'), 'comments.delete', taskId, commentId)
    expect(res.status).toBe(200)
    expect(h.calls[0]).toMatchObject({ p_operation: 'comments.delete', p_idempotency_key: null, p_payload: { taskId, id: commentId } })
    expect((await res.json()).data.id).toBe(commentId)
  })
  it.each([
    ['comments.list', 'POST'], ['comments.create', 'GET'], ['comments.update', 'PUT'], ['comments.delete', 'PATCH'],
  ] as const)('rejects the wrong verb for %s', async (operation, method) => {
    const h = harness()
    const res = await h.handle(request(`tasks/${taskId}/comments/${commentId}`, method, method === 'GET' ? undefined : { body: 'x' }), operation, taskId, commentId)
    expect(res.status).toBe(405)
    expect(h.calls).toHaveLength(0)
  })
  it('validates both path identifiers as UUIDs', async () => {
    const h = harness()
    expect(await code(await h.handle(request('tasks/nope/comments'), 'comments.list', 'nope'))).toBe('VALIDATION_ERROR')
    expect(await code(await h.handle(request(`tasks/${taskId}/comments/nope`, 'DELETE'), 'comments.delete', taskId, 'nope'))).toBe('VALIDATION_ERROR')
    expect(await code(await h.handle(request(`tasks/${taskId}/comments/nope`, 'PATCH', { body: 'x' }, { 'Idempotency-Key': 'k' }), 'comments.update', taskId, 'nope'))).toBe('VALIDATION_ERROR')
    expect(h.calls).toHaveLength(0)
  })
  it('rejects unknown query parameters and bodies on writes', async () => {
    const h = harness()
    expect(await code(await h.handle(request(`tasks/${taskId}/comments?x=1`, 'POST', { body: 'x' }, { 'Idempotency-Key': 'k' }), 'comments.create', taskId))).toBe('VALIDATION_ERROR')
    expect(await code(await h.handle(request(`tasks/${taskId}/comments`, 'POST', { body: 'x', authorId: actor }, { 'Idempotency-Key': 'k' }), 'comments.create', taskId))).toBe('VALIDATION_ERROR')
    expect(await code(await h.handle(request(`tasks/${taskId}/comments`, 'POST', {}, { 'Idempotency-Key': 'k' }), 'comments.create', taskId))).toBe('VALIDATION_ERROR')
    expect(h.calls).toHaveLength(0)
  })
  it('gates integration reads and writes on their own switches while the browser stays independent', async () => {
    const readOnly = harness({ writeEnabled: false })
    const auth = { Authorization: 'Bearer ' + apiKey }
    expect((await readOnly.handle(request(`tasks/${taskId}/comments`, 'GET', undefined, auth), 'comments.list', taskId)).status).toBe(200)
    expect((await readOnly.handle(request(`tasks/${taskId}/comments`, 'POST', { body: 'x' }, { ...auth, 'Idempotency-Key': 'k' }), 'comments.create', taskId)).status).toBe(503)
    expect((await readOnly.handle(request(`tasks/${taskId}/comments/${commentId}`, 'PATCH', { body: 'x' }, { ...auth, 'Idempotency-Key': 'k' }), 'comments.update', taskId, commentId)).status).toBe(503)
    expect((await readOnly.handle(request(`tasks/${taskId}/comments/${commentId}`, 'DELETE', undefined, auth), 'comments.delete', taskId, commentId)).status).toBe(503)
    expect((await readOnly.handle(request(`tasks/${taskId}/comments`, 'POST', { body: 'x' }, { 'Idempotency-Key': 'k' }), 'comments.create', taskId)).status).toBe(201)
    const writeOnly = harness({ readEnabled: false })
    expect((await writeOnly.handle(request(`tasks/${taskId}/comments`, 'GET', undefined, auth), 'comments.list', taskId)).status).toBe(503)
    expect((await writeOnly.handle(request(`tasks/${taskId}/comments/${commentId}`, 'DELETE', undefined, auth), 'comments.delete', taskId, commentId)).status).toBe(200)
  })
  it('hashes integration credentials for comment operations', async () => {
    const h = harness()
    await h.handle(request(`tasks/${taskId}/comments`, 'POST', { body: 'x' }, { Authorization: 'Bearer ' + apiKey, 'Idempotency-Key': 'k' }), 'comments.create', taskId)
    expect(h.calls[0].p_auth_user_id).toBeNull()
    expect(h.calls[0].p_token_digest).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(h.calls)).not.toContain(apiKey)
  })
  it('rejects standard conditional headers on Vercel before dispatch', async () => {
    const h = harness({ isVercel: true })
    expect(await code(await h.handle(request(`tasks/${taskId}/comments/${commentId}`, 'DELETE', undefined, { 'If-Match': '"x"' }), 'comments.delete', taskId, commentId))).toBe('UNSUPPORTED_PRECONDITION_HEADER')
    expect(h.calls).toHaveLength(0)
  })
  it('maps typed database errors and refuses a malformed persistence response', async () => {
    const forbidden = createTasksApiHandler({
      verifyBrowser: async () => actor, config: () => ({ readEnabled: true, writeEnabled: true }),
      dispatch: async () => ({ status: 403, error: { code: 'FORBIDDEN', message: 'Only the author can edit this comment' } }),
    })
    expect(await code(await forbidden(request(`tasks/${taskId}/comments/${commentId}`, 'PATCH', { body: 'x' }, { 'Idempotency-Key': 'k' }), 'comments.update', taskId, commentId))).toBe('FORBIDDEN')
    const malformed = harness({}, { ...comment, authorId: 'not-a-uuid' })
    const res = await malformed.handle(request(`tasks/${taskId}/comments/${commentId}`, 'DELETE'), 'comments.delete', taskId, commentId)
    expect(res.status).toBe(500)
  })
})
