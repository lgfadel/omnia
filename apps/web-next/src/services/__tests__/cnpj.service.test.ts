import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/integrations/supabase/client'
import { cnpjService } from '../cnpj.service'

const company = {
  name: 'CONDOMINIO TESTE',
  fantasyName: '',
  street: 'RUA TESTE',
  number: '100',
  complement: '',
  neighborhood: 'CENTRO',
  city: 'LONDRINA',
  state: 'PR',
  zipCode: '86000000',
  phone: '',
  active: true,
}

describe('cnpjService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(supabase.auth.getSession).mockReset()
  })

  it('consulta o servidor do Omnia com o CNPJ sem máscara e a sessão do usuário', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      if (url !== '/api/cnpj/68009455000101' || init?.headers?.Authorization !== 'Bearer test-token') {
        throw new TypeError('A consulta deve usar o servidor do Omnia')
      }
      return Response.json(company)
    })

    await expect(cnpjService.fetchDataByCNPJ('68.009.455/0001-01')).resolves.toEqual(company)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preserva o erro de CNPJ não encontrado retornado pelo servidor', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'CNPJ não encontrado', code: 'NOT_FOUND' }, { status: 404 }))

    await expect(cnpjService.fetchDataByCNPJ('68009455000101')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('recusa uma consulta sem sessão autenticada', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })

    await expect(cnpjService.fetchDataByCNPJ('68009455000101')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('recusa CNPJ incompleto sem fazer requisições', async () => {
    await expect(cnpjService.fetchDataByCNPJ('123')).rejects.toMatchObject({ code: 'INVALID_FORMAT' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('trata falha de rede sem perder o tipo do erro', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(cnpjService.fetchDataByCNPJ('68009455000101')).rejects.toMatchObject({ code: 'API_ERROR' })
  })

  it('trata respostas de erro que não contêm JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }))

    await expect(cnpjService.fetchDataByCNPJ('68009455000101')).rejects.toMatchObject({ code: 'API_ERROR' })
  })
})
