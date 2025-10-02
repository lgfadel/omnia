import { supabase } from '@/integrations/supabase/client'

export interface CrmLead {
  id: string
  cliente: string
  numero_unidades?: number
  numero_funcionarios_proprios?: number
  numero_funcionarios_terceirizados?: number
  administradora_atual?: string
  observacoes?: string
  status: string
  origem_id?: string
  origem?: {
    id: string
    name: string
    color: string
    isDefault: boolean
  }
  responsavel_negociacao?: string | {
    id: string
    name: string
    avatar_url?: string
    color?: string
  }
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  sindico_nome?: string
  sindico_telefone?: string
  sindico_email?: string
  sindico_whatsapp?: string
  valor_proposta?: number
  created_at: string
  updated_at: string
  created_by?: string
  assigned_to?: string
  comment_count: number
}

export interface CrmComment {
  id: string
  lead_id: string
  author_id: string
  created_by?: string
  body: string
  created_at: string
  updated_at: string
}

export interface CrmAttachment {
  id: string
  lead_id?: string
  comment_id?: string
  name: string
  url: string
  mime_type?: string
  size_kb?: number
  uploaded_by?: string
  created_at: string
}

export interface ViaCepResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

class CrmLeadsRepository {
  async getAll(): Promise<CrmLead[]> {
    const { data, error } = await supabase
      .from('omnia_crm_leads')
      .select(`
        *,
        responsavel_user:omnia_users!responsavel_negociacao(id, name, avatar_url, color),
        origem:omnia_crm_origens!origem_id(id, name, color, is_default)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    // Transform the data to match the interface
    const rawData = data as unknown as Record<string, unknown>[];
    const transformedData = rawData?.map((lead: Record<string, unknown>) => ({
      ...lead,
      responsavel_negociacao: lead.responsavel_user || lead.responsavel_negociacao,
      origem: lead.origem ? {
        id: (lead.origem as Record<string, unknown>).id,
        name: (lead.origem as Record<string, unknown>).name,
        color: (lead.origem as Record<string, unknown>).color,
        isDefault: (lead.origem as Record<string, unknown>).is_default
      } : null
    })) || []
    
    return transformedData as CrmLead[]
  }

  async getById(id: string): Promise<CrmLead | null> {
    const { data, error } = await supabase
      .from('omnia_crm_leads')
      .select(`
        *,
        responsavel_user:omnia_users!responsavel_negociacao(id, name, avatar_url, color),
        origem:omnia_crm_origens!origem_id(id, name, color, is_default)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    // Transform the data to match the interface with explicit typing
    const leadData = data as unknown as Record<string, unknown>;
    return {
      ...leadData,
      responsavel_negociacao: leadData.responsavel_user || leadData.responsavel_negociacao,
      origem: leadData.origem ? {
        id: (leadData.origem as Record<string, unknown>).id,
        name: (leadData.origem as Record<string, unknown>).name,
        color: (leadData.origem as Record<string, unknown>).color,
        isDefault: (leadData.origem as Record<string, unknown>).is_default
      } : null
    } as CrmLead
  }

  async create(lead: Partial<CrmLead>): Promise<CrmLead> {
    // Get current user
    const { data: userData } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
      .single()

    const { data, error } = await supabase
      .from('omnia_crm_leads')
      .insert({
        ...lead,
        created_by: userData?.id
      } as never)
      .select()
      .single()

    if (error) throw error
    return data as unknown as CrmLead
  }

  async update(id: string, updates: Partial<CrmLead>): Promise<CrmLead> {
    const { data, error } = await supabase
      .from('omnia_crm_leads')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as unknown as CrmLead
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('omnia_crm_leads')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getComments(leadId: string): Promise<CrmComment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_comments')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as unknown as CrmComment[]) || []
  }

  async createComment(comment: Partial<CrmComment>): Promise<CrmComment> {
    // Get current user
    const { data: userData } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
      .single()

    const { data, error } = await supabase
      .from('omnia_crm_comments')
      .insert({
        ...comment,
        author_id: userData?.id,
        created_by: userData?.id
      } as never)
      .select()
      .single()

    if (error) throw error
    return data as unknown as CrmComment
  }

  async getAttachments(leadId: string): Promise<CrmAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_attachments')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false})

    if (error) throw error
    return (data as unknown as CrmAttachment[]) || []
  }

  async searchByCep(cep: string): Promise<ViaCepResponse | null> {
    const cleanCep = cep.replace(/\D/g, '')
    
    if (!cleanCep) {
      throw new Error('Por favor, informe um CEP válido')
    }
    
    if (cleanCep.length !== 8) {
      throw new Error('CEP deve conter exatamente 8 dígitos. Formato: 00000-000')
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      
      if (!response.ok) {
        throw new Error('Serviço de CEP temporariamente indisponível. Tente novamente em alguns instantes.')
      }
      
      const data = await response.json()
      
      if (data.erro) {
        throw new Error(`CEP ${cep} não foi encontrado. Verifique se o CEP está correto e tente novamente.`)
      }
      
      return data
    } catch (error) {
      console.error('Erro ao buscar CEP:', error)
      
      if (error instanceof Error) {
        throw error
      }
      
      throw new Error('Erro de conexão. Verifique sua internet e tente novamente.')
    }
  }

  async filterByStatus(status: CrmLead['status']): Promise<CrmLead[]> {
    const { data, error } = await supabase
      .from('omnia_crm_leads')
      .select(`
        *,
        responsavel_user:omnia_users!responsavel_negociacao(id, name, avatar_url, color)
      `)
      .eq('status', status as never)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    // Transformar os dados para corresponder à interface CrmLead
    const rawData = data as unknown as Record<string, unknown>[];
    const transformedData = rawData?.map((lead: Record<string, unknown>) => ({
      ...lead,
      responsavel_negociacao: lead.responsavel_user || lead.responsavel_negociacao
    })) || []

    return transformedData as CrmLead[]
  }

  async filterByAssignedUser(userId: string): Promise<CrmLead[]> {
    const { data, error } = await supabase
      .from('omnia_crm_leads')
      .select(`
        *,
        responsavel_user:omnia_users!responsavel_negociacao(id, name, avatar_url, color)
      `)
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    // Transformar os dados para corresponder à interface CrmLead
    const rawData = data as unknown as Record<string, unknown>[];
    const transformedData = rawData?.map((lead: Record<string, unknown>) => ({
      ...lead,
      responsavel_negociacao: lead.responsavel_user || lead.responsavel_negociacao
    })) || []

    return transformedData as CrmLead[]
  }

  async searchByCompany(searchTerm: string): Promise<CrmLead[]> {
    const { data, error } = await supabase
      .from('omnia_crm_leads')
      .select(`
        *,
        responsavel_user:omnia_users!responsavel_negociacao(id, name, avatar_url, color)
      `)
      .ilike('cliente', `%${searchTerm}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    // Transformar os dados para corresponder à interface CrmLead
    const rawData = data as unknown as Record<string, unknown>[];
    const transformedData = rawData?.map((lead: Record<string, unknown>) => ({
      ...lead,
      responsavel_negociacao: lead.responsavel_user || lead.responsavel_negociacao
    })) || []

    return transformedData as CrmLead[]
  }
}

export const crmLeadsRepo = new CrmLeadsRepository()
