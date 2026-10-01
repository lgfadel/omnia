import { supabase } from '@/integrations/supabase/client'
import { CNPJServiceError, type CNPJData, type CNPJErrorCode } from '@/lib/cnpj'

export { CNPJServiceError, type CNPJData } from '@/lib/cnpj'

export const cnpjService = {
  /** Validates CNPJ format (14 digits). */
  validateFormat(cnpj: string): boolean {
    return /^\d{14}$/.test(this.cleanCNPJ(cnpj))
  },

  /** Formats CNPJ for display (00.000.000/0000-00). */
  formatCNPJ(cnpj: string): string {
    const cleanCNPJ = this.cleanCNPJ(cnpj)
    if (cleanCNPJ.length !== 14) return cnpj
    return `${cleanCNPJ.slice(0, 2)}.${cleanCNPJ.slice(2, 5)}.${cleanCNPJ.slice(5, 8)}/${cleanCNPJ.slice(8, 12)}-${cleanCNPJ.slice(12)}`
  },

  cleanCNPJ(cnpj: string): string {
    return cnpj.replace(/\D/g, '')
  },

  /** Queries providers through Omnia's server to avoid browser CORS restrictions. */
  async fetchDataByCNPJ(cnpj: string): Promise<CNPJData> {
    const cleanCNPJ = this.cleanCNPJ(cnpj)
    if (!this.validateFormat(cleanCNPJ)) {
      throw new CNPJServiceError('CNPJ deve conter 14 dígitos', 'INVALID_FORMAT')
    }

    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        throw new CNPJServiceError('Sua sessão expirou. Entre novamente para consultar o CNPJ.', 'UNAUTHORIZED')
      }

      const response = await fetch(`/api/cnpj/${cleanCNPJ}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
      if (!response.ok) {
        const payload = await response.json() as { error?: string; code?: CNPJErrorCode }
        throw new CNPJServiceError(payload.error || 'Erro ao buscar CNPJ', payload.code || 'API_ERROR')
      }

      return await response.json() as CNPJData
    } catch (error) {
      if (error instanceof CNPJServiceError) throw error
      throw new CNPJServiceError('Erro ao buscar CNPJ. Tente novamente ou preencha os dados manualmente.', 'API_ERROR')
    }
  },
}
