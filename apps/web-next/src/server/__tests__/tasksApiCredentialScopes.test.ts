import { describe, expect, it } from 'vitest'
import { createTasksApiHandler, type DispatchArgs } from '../tasksApiService'
import { credentialUpdateSchema } from '@/lib/tasksApiContracts'

const actor = '11111111-1111-4111-8111-111111111111'
const keyId = '22222222-2222-4222-8222-222222222222'
const createdAt = '2026-10-04T10:00:00.000001+00:00'
const key = { id: keyId, name: 'GrokBot', audience: 'mcp', scopes: ['tasks:delete', 'tasks:read'], createdAt, expiresAt: null, revokedAt: null, lastUsedAt: null }
const apiKey = 'omnia_api_' + 'A'.repeat(43)

function harness(result: { status: number; data?: unknown; error?: { code: string; message: string } } = { status: 200, data: key }) {
  const calls: DispatchArgs[] = []
  const handle = createTasksApiHandler({
    verifyBrowser: async token => token === 'browser.jwt.token' ? actor : null,
    dispatch: async args => { calls.push(args); return result },
    config: () => ({ readEnabled: true, writeEnabled: true }),
  })
  const patch = (body: unknown, { id = keyId, token = 'browser.jwt.token', method = 'PATCH' } = {}) => handle(new Request(`https://omnia.test/api/v1/integration-keys/${id}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), 'credentials.update', id)
  return { patch, calls }
}

describe('credential permission edit contract', () => {
  it('accepts only a non-empty, unique list of known permissions', () => {
    expect(credentialUpdateSchema.parse({ scopes: ['tasks:read', 'tasks:delete'] })).toEqual({ scopes: ['tasks:read', 'tasks:delete'] })
    expect(credentialUpdateSchema.safeParse({ scopes: [] }).success).toBe(false)
    expect(credentialUpdateSchema.safeParse({ scopes: ['tasks:read', 'tasks:read'] }).success).toBe(false)
    expect(credentialUpdateSchema.safeParse({ scopes: ['tasks:admin'] }).success).toBe(false)
  })
  it.each(['name', 'audience', 'expiresAt', 'revokedAt', 'tokenDigest'])('never lets %s change', field => {
    expect(credentialUpdateSchema.safeParse({ scopes: ['tasks:read'], [field]: 'x' }).success).toBe(false)
  })
})

describe('official credential permission edit service', () => {
  it('dispatches credentials.update with the key id and the new permissions only', async () => {
    const h = harness()
    const res = await h.patch({ scopes: ['tasks:read', 'tasks:delete'] })
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ id: keyId, revokedAt: null })
    expect(h.calls).toEqual([expect.objectContaining({ p_operation: 'credentials.update', p_payload: { id: keyId, scopes: ['tasks:read', 'tasks:delete'] }, p_auth_user_id: actor, p_token_digest: null })])
  })
  it('never returns a secret', async () => {
    const res = await harness().patch({ scopes: ['tasks:read'] })
    expect(JSON.stringify(await res.json())).not.toMatch(/omnia_(api|mcp)_|token/i)
  })
  it('is browser-only: an integration key cannot edit permissions, not even its own', async () => {
    const h = harness()
    const res = await h.patch({ scopes: ['tasks:read', 'tasks:create', 'tasks:update', 'tasks:comment', 'tasks:delete'] }, { token: apiKey })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('INVALID_AUDIENCE')
    expect(h.calls).toHaveLength(0)
  })
  it('rejects invalid input and other methods before dispatch', async () => {
    const h = harness()
    expect((await h.patch({ scopes: [] })).status).toBe(400)
    expect((await h.patch({ scopes: ['tasks:read'], name: 'renamed' })).status).toBe(400)
    expect((await h.patch({ scopes: ['tasks:read'] }, { id: 'not-a-uuid' })).status).toBe(400)
    expect((await h.patch({ scopes: ['tasks:read'] }, { method: 'POST' })).status).toBe(405)
    expect(h.calls).toHaveLength(0)
  })
  it('passes a missing or revoked key through as NOT_FOUND', async () => {
    const res = await harness({ status: 404, error: { code: 'NOT_FOUND', message: 'Credential not found' } }).patch({ scopes: ['tasks:read'] })
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT_FOUND')
  })
})
