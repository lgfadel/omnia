import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CNPJServiceError } from '@/lib/cnpj'

const { getUser, fetchCNPJData } = vi.hoisted(() => ({
  getUser: vi.fn(),
  fetchCNPJData: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser } }),
}))
vi.mock('@/server/cnpjLookup', () => ({ fetchCNPJData }))

const { GET } = await import('../[cnpj]/route')
const context = { params: Promise.resolve({ cnpj: '68009455000101' }) }

function request(token = 'test-token') {
  return new Request('http://localhost/api/cnpj/68009455000101', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

describe('GET /api/cnpj/[cnpj]', () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    fetchCNPJData.mockReset()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('recusa requisições sem token antes de consultar os provedores', async () => {
    const response = await GET(request(''), context)

    expect(response.status).toBe(401)
    expect(getUser).not.toHaveBeenCalled()
    expect(fetchCNPJData).not.toHaveBeenCalled()
  })

  it('valida o token com o Supabase antes de consultar o CNPJ', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid JWT') })

    const response = await GET(request('invalid-token'), context)

    expect(response.status).toBe(401)
    expect(getUser).toHaveBeenCalledWith('invalid-token')
    expect(fetchCNPJData).not.toHaveBeenCalled()
  })

  it('recusa parâmetros inválidos sem consultar os provedores', async () => {
    const response = await GET(request(), { params: Promise.resolve({ cnpj: '123' }) })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_FORMAT' })
    expect(fetchCNPJData).not.toHaveBeenCalled()
  })

  it('retorna os dados normalizados para um usuário autenticado', async () => {
    fetchCNPJData.mockResolvedValue({ name: 'CONDOMINIO TESTE', active: true })

    const response = await GET(request(), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ name: 'CONDOMINIO TESTE', active: true })
    expect(getUser).toHaveBeenCalledWith('test-token')
    expect(fetchCNPJData).toHaveBeenCalledWith('68009455000101')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it.each([
    ['NOT_FOUND', 404],
    ['INVALID_FORMAT', 400],
    ['API_ERROR', 502],
  ] as const)('retorna HTTP apropriado para %s', async (code, status) => {
    fetchCNPJData.mockRejectedValue(new CNPJServiceError('Falha na consulta', code))

    const response = await GET(request(), context)

    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ error: 'Falha na consulta', code })
  })
})
