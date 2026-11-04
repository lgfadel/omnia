import { describe, expect, it } from 'vitest'
import { createTasksApiHandler, type DispatchArgs, type DispatchResult, type TaskOperation, type TasksApiConfig } from '../tasksApiService'
import { balancetePatchSchema, balanceteUpsertSchema, credentialCreateSchema, taskEtag } from '@/lib/tasksApiContracts'

const actor = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const condominiumId = '33333333-3333-4333-8333-333333333333'
const updatedAt = '2026-10-04T10:20:30.123456+00:00'
const balancete = { id, condominiumId, condominiumName: 'Edifício', euro: 'Londrina', balanceteDigital: true, competencia: '09/2026', receivedAt: '2026-10-04', digitalPreparedAt: updatedAt, volumes: 1, observations: null, status: 'recebido', sentAt: null, protocoloId: null, csvImportBatchId: null, createdById: actor, createdAt: updatedAt, updatedAt }
const upsertBody = { condominiumId, competencia: '09/2026', generatedAt: '2026-10-05T09:30:00-03:00' }
const apiKey = 'omnia_api_' + 'A'.repeat(43)

function harness(result: DispatchResult, config: Partial<TasksApiConfig> = {}) {
  const calls: DispatchArgs[] = []
  const handle = createTasksApiHandler({
    verifyBrowser: async token => token === 'browser.jwt.token' ? actor : null,
    dispatch: async args => { calls.push(args); return result },
    config: () => ({ readEnabled: true, writeEnabled: true, exchangeSecret: 'backend-secret', ...config }),
  })
  return { handle, calls }
}
function request(path: string, method: string, options: { body?: unknown; token?: string; headers?: Record<string, string> } = {}) {
  return new Request('https://omnia.test/api/v1/' + path, {
    method,
    headers: { Authorization: `Bearer ${options.token ?? 'browser.jwt.token'}`, ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
}

describe('balancete contracts', () => {
  it('accepts only MM/YYYY and an offset timestamp', () => {
    expect(balanceteUpsertSchema.safeParse(upsertBody).success).toBe(true)
    for (const competencia of ['2026-09', '13/2026', '00/2026', '9/2026']) expect(balanceteUpsertSchema.safeParse({ ...upsertBody, competencia }).success).toBe(false)
    expect(balanceteUpsertSchema.safeParse({ ...upsertBody, generatedAt: '2026-10-05' }).success).toBe(false)
    expect(balanceteUpsertSchema.safeParse({ ...upsertBody, volumes: 2 }).success).toBe(false)
  })
  it('patches only the form fields and never clears the received date', () => {
    expect(balancetePatchSchema.safeParse({}).success).toBe(false)
    expect(balancetePatchSchema.safeParse({ status: 'enviado' }).success).toBe(false)
    expect(balancetePatchSchema.safeParse({ sentAt: updatedAt }).success).toBe(false)
    expect(balancetePatchSchema.safeParse({ receivedAt: null }).success).toBe(false)
    expect(balancetePatchSchema.safeParse({ volumes: 0 }).success).toBe(false)
    expect(balancetePatchSchema.safeParse({ observations: null, volumes: 2, receivedAt: '2026-10-05' }).success).toBe(true)
  })
  it('lets one key hold all eight scopes', () => {
    const scopes = ['tasks:read', 'tasks:create', 'tasks:update', 'tasks:comment', 'tasks:delete', 'balancetes:read', 'balancetes:write', 'balancetes:delete']
    expect(credentialCreateSchema.safeParse({ name: 'key', audience: 'mcp', scopes }).success).toBe(true)
    expect(credentialCreateSchema.safeParse({ name: 'key', audience: 'mcp', scopes: ['balancetes:admin'] }).success).toBe(false)
  })
})

describe('balancete HTTP service', () => {
  it('passes the lookup filters as validated values', async () => {
    const h = harness({ status: 200, data: { items: [{ id: condominiumId, name: 'Edifício', euro: 'Londrina', balanceteDigital: true, active: true, aliases: [] }], hasMore: false } })
    const res = await h.handle(request('condominiums?query=sao&includeInactive=true&limit=500', 'GET'), 'condominiums.list')
    expect(res.status).toBe(200)
    expect(h.calls[0].p_payload).toEqual({ query: 'sao', includeInactive: true, limit: 500 })
  })
  it('bounds the lookup and refuses unknown filters', async () => {
    const h = harness({ status: 200, data: { items: [], hasMore: false } })
    expect((await h.handle(request('condominiums?limit=501', 'GET'), 'condominiums.list')).status).toBe(400)
    expect((await h.handle(request('condominiums?cpf=1', 'GET'), 'condominiums.list')).status).toBe(400)
    expect(h.calls).toHaveLength(0)
  })
  it('never lets the lookup carry a field outside the contract', async () => {
    const h = harness({ status: 200, data: { items: [{ id: condominiumId, name: 'Edifício', euro: 'Londrina', balanceteDigital: true, active: true, aliases: [], syndicCpf: '111' }], hasMore: false } })
    const res = await h.handle(request('condominiums', 'GET'), 'condominiums.list')
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('111')
  })
  it('encodes the list cursor and parses filters', async () => {
    const cursor = { createdAt: updatedAt, id }
    const h = harness({ status: 200, data: { items: [balancete], nextCursor: cursor } })
    const res = await h.handle(request(`balancetes?condominiumId=${condominiumId}&competencia=09%2F2026&euro=Campinas&awaitingPhysical=true&sent=false&limit=10`, 'GET'), 'balancetes.list')
    const { data } = await res.json()
    expect(typeof data.nextCursor).toBe('string')
    expect(h.calls[0].p_payload).toEqual({ condominiumId, competencia: '09/2026', euro: 'Campinas', awaitingPhysical: true, sent: false, limit: 10 })
    await h.handle(request(`balancetes?cursor=${data.nextCursor}`, 'GET'), 'balancetes.list')
    expect(h.calls[1].p_payload).toMatchObject({ cursor })
  })
  it('upserts with an idempotency key and returns the action and a version', async () => {
    const h = harness({ status: 200, data: { ...balancete, action: 'create' } })
    const res = await h.handle(request('balancetes', 'POST', { body: upsertBody, headers: { 'Idempotency-Key': 'k1' } }), 'balancetes.upsert')
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBe(taskEtag(updatedAt))
    expect((await res.json()).data.action).toBe('create')
    expect(h.calls[0]).toMatchObject({ p_operation: 'balancetes.upsert', p_payload: upsertBody, p_idempotency_key: 'k1', p_auth_user_id: actor })
  })
  it('requires the idempotency key on writes', async () => {
    const h = harness({ status: 200, data: { ...balancete, action: 'create' } })
    expect((await h.handle(request('balancetes', 'POST', { body: upsertBody }), 'balancetes.upsert')).status).toBe(400)
    expect(h.calls).toHaveLength(0)
  })
  it('updates with the version in the transport header and refuses a standard If-Match on Vercel', async () => {
    const etag = taskEtag(updatedAt)
    const h = harness({ status: 200, data: balancete }, { isVercel: true })
    const res = await h.handle(request(`balancetes/${id}`, 'PATCH', { body: { volumes: 2 }, headers: { 'Idempotency-Key': 'k2', 'X-Omnia-If-Match': etag } }), 'balancetes.update', id)
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBe(etag)
    expect(h.calls[0].p_payload).toEqual({ id, expectedUpdatedAt: updatedAt, patch: { volumes: 2 } })
    const refused = await h.handle(request(`balancetes/${id}`, 'PATCH', { body: { volumes: 2 }, headers: { 'Idempotency-Key': 'k2', 'If-Match': etag } }), 'balancetes.update', id)
    expect((await refused.json()).error.code).toBe('UNSUPPORTED_PRECONDITION_HEADER')
    expect(h.calls).toHaveLength(1)
  })
  it('requires a version to update', async () => {
    const h = harness({ status: 200, data: balancete })
    const res = await h.handle(request(`balancetes/${id}`, 'PATCH', { body: { volumes: 2 }, headers: { 'Idempotency-Key': 'k3' } }), 'balancetes.update', id)
    expect(res.status).toBe(428)
    expect(h.calls).toHaveLength(0)
  })
  it('deletes with only the validated id and no version', async () => {
    const h = harness({ status: 200, data: balancete })
    const res = await h.handle(request(`balancetes/${id}`, 'DELETE'), 'balancetes.delete', id)
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBeNull()
    expect(h.calls[0]).toMatchObject({ p_operation: 'balancetes.delete', p_payload: { id }, p_idempotency_key: null })
    expect((await h.handle(request('balancetes/x', 'DELETE'), 'balancetes.delete', 'x')).status).toBe(400)
  })
  it.each([
    ['BALANCETE_LOCKED', 409], ['BALANCETE_CHANGED', 412], ['CONDOMINIUM_INACTIVE', 409], ['AMBIGUOUS_BALANCETE', 409],
  ])('surfaces %s with status %i', async (code, status) => {
    const h = harness({ status, error: { code, message: 'x' } })
    const res = await h.handle(request(`balancetes/${id}`, 'DELETE'), 'balancetes.delete', id)
    expect(res.status).toBe(status)
    expect((await res.json()).error.code).toBe(code)
  })
  it.each<[TaskOperation, string, string, unknown]>([
    ['balancetes.upsert', 'balancetes', 'POST', upsertBody],
    ['balancetes.delete', `balancetes/${id}`, 'DELETE', undefined],
  ])('%s honours the write switch for integration keys', async (operation, path, method, body) => {
    const h = harness({ status: 200, data: balancete }, { writeEnabled: false })
    const res = await h.handle(request(path, method, { token: apiKey, body, headers: { 'Idempotency-Key': 'k4' } }), operation, operation === 'balancetes.delete' ? id : undefined)
    expect(res.status).toBe(503)
    expect(h.calls).toHaveLength(0)
  })
  it('reads honour the read switch for integration keys', async () => {
    const h = harness({ status: 200, data: { items: [], hasMore: false } }, { readEnabled: false })
    expect((await h.handle(request('condominiums', 'GET', { token: apiKey }), 'condominiums.list')).status).toBe(503)
    expect(h.calls).toHaveLength(0)
  })
})
