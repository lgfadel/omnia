import { describe, expect, it } from 'vitest'
import { createTasksApiHandler, type DispatchArgs } from '../tasksApiService'
import { credentialCreateSchema, credentialSchema, mcpCapabilitySchema } from '@/lib/tasksApiContracts'

const actor = '11111111-1111-4111-8111-111111111111'
const createdAt = '2026-10-04T10:00:00.000001+00:00'
const key = { id: actor, name: 'key', audience: 'api', scopes: ['tasks:read'], createdAt, expiresAt: '2026-12-01T00:00:00+00:00', revokedAt: null, lastUsedAt: null }

function harness(data: unknown = key) {
  const calls: DispatchArgs[] = []
  const handle = createTasksApiHandler({
    verifyBrowser: async token => token === 'browser.jwt.token' ? actor : null,
    dispatch: async args => { calls.push(args); return { status: 201, data } },
    config: () => ({ readEnabled: true, writeEnabled: true }),
  })
  const create = (body: unknown) => handle(new Request('https://omnia.test/api/v1/integration-keys', { method: 'POST', headers: { Authorization: 'Bearer browser.jwt.token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), 'credentials.create')
  return { create, calls }
}

describe('key lifetime contract', () => {
  it('lets a key be created without expiry only through an explicit null', () => {
    expect(credentialCreateSchema.parse({ name: 'k', audience: 'api', scopes: ['tasks:read'], expiresAt: null }).expiresAt).toBeNull()
    expect(credentialCreateSchema.parse({ name: 'k', audience: 'api', scopes: ['tasks:read'] })).not.toHaveProperty('expiresAt')
    expect(credentialCreateSchema.safeParse({ name: 'k', audience: 'api', scopes: ['tasks:read'], expiresAt: 'never' }).success).toBe(false)
    expect(credentialCreateSchema.safeParse({ name: 'k', audience: 'api', scopes: ['tasks:read'], expiresAt: 0 }).success).toBe(false)
  })
  it('reports a missing expiry as null on a key but never on an MCP capability', () => {
    expect(credentialSchema.parse({ ...key, expiresAt: null }).expiresAt).toBeNull()
    expect(credentialSchema.safeParse({ ...key, expiresAt: undefined }).success).toBe(false)
    expect(mcpCapabilitySchema.safeParse({ id: actor, audience: 'api', scopes: ['tasks:read'], expiresAt: null }).success).toBe(false)
  })
  it('forwards an explicit null to the database and keeps an omitted expiry omitted', async () => {
    const h = harness({ ...key, expiresAt: null })
    const never = await h.create({ name: 'k', audience: 'api', scopes: ['tasks:read'], expiresAt: null })
    expect(never.status).toBe(201)
    expect((await never.json()).data.expiresAt).toBeNull()
    expect(h.calls[0].p_payload).toHaveProperty('expiresAt', null)
    await h.create({ name: 'k', audience: 'api', scopes: ['tasks:read'] })
    expect(h.calls[1].p_payload).not.toHaveProperty('expiresAt')
  })
  it('still validates a finite expiry as an offset timestamp', async () => {
    const h = harness()
    expect((await h.create({ name: 'k', audience: 'api', scopes: ['tasks:read'], expiresAt: '2026-12-01' })).status).toBe(400)
    expect(h.calls).toHaveLength(0)
  })
})
