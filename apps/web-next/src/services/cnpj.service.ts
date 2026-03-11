export interface CNPJResponse {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  telefone: string
  status: string
}

export interface CNPJData {
  name: string
  fantasyName: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  phone: string
  active: boolean
}

export class CNPJServiceError extends Error {
  constructor(message: string, public code: 'INVALID_FORMAT' | 'NOT_FOUND' | 'API_ERROR' | 'INACTIVE') {
    super(message)
    this.name = 'CNPJServiceError'
  }
}

export const cnpjService = {
  /**
   * Validates CNPJ format (14 digits)
   */
  validateFormat(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/\D/g, '')
    return /^\d{14}$/.test(cleanCNPJ)
  },

  /**
   * Formats CNPJ to display format (00.000.000/0000-00)
   */
  formatCNPJ(cnpj: string): string {
    const cleanCNPJ = cnpj.replace(/\D/g, '')
    if (cleanCNPJ.length !== 14) return cnpj
    return `${cleanCNPJ.slice(0, 2)}.${cleanCNPJ.slice(2, 5)}.${cleanCNPJ.slice(5, 8)}/${cleanCNPJ.slice(8, 12)}-${cleanCNPJ.slice(12)}`
  },

  /**
   * Removes formatting from CNPJ (14 digits only)
   */
  cleanCNPJ(cnpj: string): string {
    return cnpj.replace(/\D/g, '')
  },

  /**
   * Fetches company data from BrasilAPI (primary) with ReceitaWS as fallback
   */
  async fetchDataByCNPJ(cnpj: string): Promise<CNPJData> {
    const cleanCNPJ = this.cleanCNPJ(cnpj)
    if (!this.validateFormat(cleanCNPJ)) {
      throw new CNPJServiceError('CNPJ deve conter 14 dígitos', 'INVALID_FORMAT')
    }

    // Try BrasilAPI first (more reliable)
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`)
      
      if (response.ok) {
        const data = await response.json()
        
        const isActive = data.descricao_situacao_cadastral?.toLowerCase().includes('ativa')
        
        return {
          name: data.nome_fantasia || data.razao_social,
          fantasyName: data.nome_fantasia,
          street: data.logradouro,
          number: data.numero,
          complement: data.complemento,
          neighborhood: data.bairro,
          city: data.municipio,
          state: data.uf,
          zipCode: data.cep?.replace(/\D/g, '') || '',
          phone: data.ddd_telefone_1 || '',
          active: isActive,
        }
      }
    } catch (error) {
      console.warn('BrasilAPI failed, trying ReceitaWS...', error)
    }

    // Fallback to ReceitaWS
    try {
      const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCNPJ}`)
      
      if (!response.ok) {
        throw new CNPJServiceError('Erro ao buscar CNPJ', 'API_ERROR')
      }

      const data: CNPJResponse = await response.json()

      if (data.status === 'ERROR') {
        throw new CNPJServiceError('CNPJ não encontrado', 'NOT_FOUND')
      }

      const isActive = data.status === 'ATIVA'
      if (!isActive) {
        throw new CNPJServiceError('CNPJ encontrado mas empresa está inativa', 'INACTIVE')
      }

      return {
        name: data.nome_fantasia || data.razao_social,
        fantasyName: data.nome_fantasia,
        street: data.logradouro,
        number: data.numero,
        complement: data.complemento,
        neighborhood: data.bairro,
        city: data.municipio,
        state: data.uf,
        zipCode: data.cep.replace(/\D/g, ''),
        phone: data.telefone,
        active: isActive,
      }
    } catch (error) {
      if (error instanceof CNPJServiceError) {
        throw error
      }
      throw new CNPJServiceError('Erro ao buscar CNPJ. Verifique sua conexão ou tente novamente.', 'API_ERROR')
    }
  },
}
