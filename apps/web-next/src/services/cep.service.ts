export interface ViaCEPResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export interface AddressData {
  street: string
  neighborhood: string
  city: string
  state: string
}

export class CEPServiceError extends Error {
  constructor(message: string, public code: 'INVALID_FORMAT' | 'NOT_FOUND' | 'API_ERROR') {
    super(message)
    this.name = 'CEPServiceError'
  }
}

export const cepService = {
  /**
   * Validates CEP format (8 digits)
   */
  validateFormat(cep: string): boolean {
    const cleanCEP = cep.replace(/\D/g, '')
    return /^\d{8}$/.test(cleanCEP)
  },

  /**
   * Formats CEP to display format (12345-678)
   */
  formatCEP(cep: string): string {
    const cleanCEP = cep.replace(/\D/g, '')
    if (cleanCEP.length !== 8) return cep
    return `${cleanCEP.slice(0, 5)}-${cleanCEP.slice(5)}`
  },

  /**
   * Removes formatting from CEP (12345678)
   */
  cleanCEP(cep: string): string {
    return cep.replace(/\D/g, '')
  },

  /**
   * Fetches address data from ViaCEP API
   */
  async fetchAddressByCEP(cep: string): Promise<AddressData> {
    // Validate format
    const cleanCEP = this.cleanCEP(cep)
    if (!this.validateFormat(cleanCEP)) {
      throw new CEPServiceError('CEP deve conter 8 dígitos', 'INVALID_FORMAT')
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
      
      if (!response.ok) {
        throw new CEPServiceError('Erro ao buscar CEP', 'API_ERROR')
      }

      const data: ViaCEPResponse = await response.json()

      // Check if CEP was not found
      if (data.erro) {
        throw new CEPServiceError('CEP não encontrado', 'NOT_FOUND')
      }

      return {
        street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
      }
    } catch (error) {
      if (error instanceof CEPServiceError) {
        throw error
      }
      throw new CEPServiceError('Erro ao buscar CEP. Verifique sua conexão.', 'API_ERROR')
    }
  },
}
