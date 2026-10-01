import { CNPJServiceError, type CNPJData } from '@/lib/cnpj'

const PROVIDER_TIMEOUT_MS = 8_000
const UNAVAILABLE_MESSAGE = 'Os serviços de consulta de CNPJ estão indisponíveis. Tente novamente ou preencha os dados manualmente.'

type ProviderData = Record<string, unknown>

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function fetchProvider(url: string): Promise<ProviderData> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })

  if (response.status === 404) {
    throw new CNPJServiceError('CNPJ não encontrado', 'NOT_FOUND')
  }
  if (!response.ok) {
    throw new CNPJServiceError(UNAVAILABLE_MESSAGE, 'API_ERROR')
  }

  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CNPJServiceError(UNAVAILABLE_MESSAGE, 'API_ERROR')
  }
  return data as ProviderData
}

function normalizeData(data: ProviderData, name: string, fantasyName: string, street: string, phone: string, active: boolean): CNPJData {
  if (!name) {
    throw new CNPJServiceError(UNAVAILABLE_MESSAGE, 'API_ERROR')
  }

  return {
    name,
    fantasyName,
    street,
    number: text(data.numero),
    complement: text(data.complemento),
    neighborhood: text(data.bairro),
    city: text(data.municipio),
    state: text(data.uf),
    zipCode: text(data.cep).replace(/\D/g, ''),
    phone: phone.split('/')[0].replace(/\D/g, '').slice(0, 11),
    active,
  }
}

async function fetchBrasilAPI(cnpj: string): Promise<CNPJData> {
  const data = await fetchProvider(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
  const fantasyName = text(data.nome_fantasia)
  const street = text(data.logradouro)
  const streetType = text(data.descricao_tipo_de_logradouro)

  return normalizeData(
    data,
    fantasyName || text(data.razao_social),
    fantasyName,
    street && streetType ? `${streetType} ${street}` : street,
    text(data.ddd_telefone_1),
    data.situacao_cadastral === 2 || text(data.descricao_situacao_cadastral).toUpperCase() === 'ATIVA',
  )
}

async function fetchReceitaWS(cnpj: string): Promise<CNPJData> {
  const data = await fetchProvider(`https://receitaws.com.br/v1/cnpj/${cnpj}`)
  if (data.status === 'ERROR') {
    const message = text(data.message).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (/cnpj.*invalido|invalido.*cnpj/.test(message)) {
      throw new CNPJServiceError('CNPJ inválido', 'INVALID_FORMAT')
    }
    // ReceitaWS only serves cached records. A cache miss does not establish
    // that the company does not exist in the official registry.
    const cacheMiss = /cache|base de dados|banco de dados/.test(message)
    if (!cacheMiss && /cnpj.*(?:nao encontrado|nao existe|inexistente)/.test(message)) {
      throw new CNPJServiceError('CNPJ não encontrado', 'NOT_FOUND')
    }
    throw new CNPJServiceError(UNAVAILABLE_MESSAGE, 'API_ERROR')
  }
  if (data.status !== 'OK') {
    throw new CNPJServiceError(UNAVAILABLE_MESSAGE, 'API_ERROR')
  }

  const fantasyName = text(data.fantasia)
  return normalizeData(
    data,
    fantasyName || text(data.nome),
    fantasyName,
    text(data.logradouro),
    text(data.telefone),
    text(data.situacao).toUpperCase() === 'ATIVA',
  )
}

/** Called by the API route so provider requests never run in the browser. */
export async function fetchCNPJData(cnpj: string): Promise<CNPJData> {
  const cleanCNPJ = cnpj.replace(/\D/g, '')
  if (!/^\d{14}$/.test(cleanCNPJ)) {
    throw new CNPJServiceError('CNPJ deve conter 14 dígitos', 'INVALID_FORMAT')
  }

  let allNotFound = true
  let invalidFormat: CNPJServiceError | undefined
  for (const provider of [fetchBrasilAPI, fetchReceitaWS]) {
    try {
      return await provider(cleanCNPJ)
    } catch (error) {
      if (!(error instanceof CNPJServiceError) || error.code !== 'NOT_FOUND') {
        allNotFound = false
      }
      if (error instanceof CNPJServiceError && error.code === 'INVALID_FORMAT') {
        invalidFormat = error
      }
    }
  }

  if (invalidFormat) throw invalidFormat
  if (allNotFound) throw new CNPJServiceError('CNPJ não encontrado', 'NOT_FOUND')
  throw new CNPJServiceError(UNAVAILABLE_MESSAGE, 'API_ERROR')
}
