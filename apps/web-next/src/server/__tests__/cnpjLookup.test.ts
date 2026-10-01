import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCNPJData } from '../cnpjLookup'

const CNPJ = '68009455000101'
const brasilAPIData = {
  cnpj: CNPJ,
  razao_social: 'CONDOMINIO EXEMPLO',
  nome_fantasia: 'EDIFICIO EXEMPLO',
  descricao_tipo_de_logradouro: 'RUA',
  logradouro: 'DAS FLORES',
  numero: '42',
  complemento: 'BLOCO A',
  bairro: 'CENTRO',
  municipio: 'SAO PAULO',
  uf: 'SP',
  cep: '01.234-567',
  ddd_telefone_1: '1133334444',
  situacao_cadastral: 2,
  descricao_situacao_cadastral: 'ATIVA',
}

const receitaWSData = {
  cnpj: '68.009.455/0001-01',
  nome: 'CONDOMINIO EXEMPLO',
  fantasia: 'EDIFICIO EXEMPLO',
  logradouro: 'RUA DAS FLORES',
  numero: '42',
  complemento: 'BLOCO A',
  bairro: 'CENTRO',
  municipio: 'SAO PAULO',
  uf: 'SP',
  cep: '01.234-567',
  telefone: '(11) 3333-4444',
  status: 'OK',
  situacao: 'ATIVA',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchCNPJData', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('normalizes BrasilAPI data and strips input formatting before querying', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(brasilAPIData))

    await expect(fetchCNPJData('68.009.455/0001-01')).resolves.toEqual({
      name: 'EDIFICIO EXEMPLO',
      fantasyName: 'EDIFICIO EXEMPLO',
      street: 'RUA DAS FLORES',
      number: '42',
      complement: 'BLOCO A',
      neighborhood: 'CENTRO',
      city: 'SAO PAULO',
      state: 'SP',
      zipCode: '01234567',
      phone: '1133334444',
      active: true,
    })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `https://brasilapi.com.br/api/cnpj/v1/${CNPJ}`,
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })

  it('returns empty strings for missing optional fields', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ razao_social: 'CONDOMINIO EXEMPLO', situacao_cadastral: 2 }))

    await expect(fetchCNPJData(CNPJ)).resolves.toEqual({
      name: 'CONDOMINIO EXEMPLO',
      fantasyName: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      active: true,
    })
  })

  it.each([
    [{ situacao_cadastral: 2 }, true],
    [{ descricao_situacao_cadastral: 'ATIVA' }, true],
    [{ descricao_situacao_cadastral: 'INATIVA' }, false],
    [{ situacao_cadastral: 3, descricao_situacao_cadastral: 'SUSPENSA' }, false],
  ])('determines BrasilAPI activity from the documented exact status: %j', async (statusFields, active) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ razao_social: 'CONDOMINIO EXEMPLO', ...statusFields }))

    await expect(fetchCNPJData(CNPJ)).resolves.toMatchObject({ active })
  })

  it('uses the ReceitaWS schema after BrasilAPI returns an upstream failure', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Request failed with status code 503' }, 500))
      .mockResolvedValueOnce(jsonResponse(receitaWSData))

    await expect(fetchCNPJData(CNPJ)).resolves.toEqual({
      name: 'EDIFICIO EXEMPLO',
      fantasyName: 'EDIFICIO EXEMPLO',
      street: 'RUA DAS FLORES',
      number: '42',
      complement: 'BLOCO A',
      neighborhood: 'CENTRO',
      city: 'SAO PAULO',
      state: 'SP',
      zipCode: '01234567',
      phone: '1133334444',
      active: true,
    })
    expect(fetchMock).toHaveBeenLastCalledWith(
      `https://receitaws.com.br/v1/cnpj/${CNPJ}`,
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })

  it.each(['BrasilAPI', 'ReceitaWS'])('selects the first phone number from a %s response containing multiple numbers', async (provider) => {
    const phones = '(11) 3333-4444 / (11) 99999-8888'
    if (provider === 'BrasilAPI') {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ...brasilAPIData, ddd_telefone_1: phones }))
    } else {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse({ ...receitaWSData, telefone: phones }))
    }

    await expect(fetchCNPJData(CNPJ)).resolves.toMatchObject({ phone: '1133334444' })
  })

  it('normalizes a formatted BrasilAPI mobile phone to at most eleven digits', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...brasilAPIData, ddd_telefone_1: '(11) 99999-8888 ramal 123' }))

    await expect(fetchCNPJData(CNPJ)).resolves.toMatchObject({ phone: '11999998888' })
  })

  it('returns inactive ReceitaWS records without falsely treating status OK as company activity', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ ...receitaWSData, situacao: 'BAIXADA' }))

    await expect(fetchCNPJData(CNPJ)).resolves.toMatchObject({ name: 'EDIFICIO EXEMPLO', active: false })
  })

  it('falls back when BrasilAPI times out instead of leaving the lookup pending', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockImplementationOnce((_url, options) => new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
      }))
      .mockResolvedValueOnce(jsonResponse(receitaWSData))

    const lookup = fetchCNPJData(CNPJ)
    await vi.advanceTimersByTimeAsync(8_000)

    await expect(lookup).resolves.toMatchObject({ name: 'EDIFICIO EXEMPLO', active: true })
  })

  it.each([
    ['malformed JSON', () => new Response('{invalid-json', { status: 200 })],
    ['missing company name', () => jsonResponse({ cnpj: CNPJ, descricao_situacao_cadastral: 'ATIVA' })],
    ['null payload', () => jsonResponse(null)],
  ])('falls back when BrasilAPI returns %s with HTTP 200', async (_description, response) => {
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(jsonResponse(receitaWSData))

    await expect(fetchCNPJData(CNPJ)).resolves.toMatchObject({ name: 'EDIFICIO EXEMPLO' })
  })

  it('does not accept a ReceitaWS success payload with no company name', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ status: 'OK', situacao: 'ATIVA' }))

    await expect(fetchCNPJData(CNPJ)).rejects.toMatchObject({ code: 'API_ERROR' })
  })

  it('rejects a CNPJ with fewer than fourteen digits before calling providers', async () => {
    await expect(fetchCNPJData('123')).rejects.toMatchObject({ code: 'INVALID_FORMAT' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports provider transport failures as API errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(fetchCNPJData(CNPJ)).rejects.toMatchObject({ code: 'API_ERROR' })
  })

  it('does not report a rate limit as a nonexistent CNPJ', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({}, 429))

    await expect(fetchCNPJData(CNPJ)).rejects.toMatchObject({ code: 'API_ERROR' })
  })

  it('reports NOT_FOUND when both providers reliably reject the CNPJ as nonexistent', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ status: 'ERROR', message: 'CNPJ não encontrado' }))

    await expect(fetchCNPJData(CNPJ)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('treats an unavailable ReceitaWS cache entry as an API error', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ status: 'ERROR', message: 'CNPJ não encontrado na base de dados em cache' }))

    await expect(fetchCNPJData(CNPJ)).rejects.toMatchObject({ code: 'API_ERROR' })
  })

  it('preserves ReceitaWS invalid-CNPJ errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 400))
      .mockResolvedValueOnce(jsonResponse({ status: 'ERROR', message: 'CNPJ inválido' }))

    await expect(fetchCNPJData(CNPJ)).rejects.toMatchObject({ code: 'INVALID_FORMAT' })
  })
})
