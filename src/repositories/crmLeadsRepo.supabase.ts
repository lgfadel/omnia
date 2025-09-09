import { supabase } from '@/integrations/supabase/client'

export interface CrmLead {
  id: string
  cliente: string
  numero_unidades?: number
  numero_funcionarios_proprios?: number
  numero_funcionarios_terceirizados?: number
  administradora_atual?: string
  observacoes?: string
  status: 'novo' | 'qualificado' | 'proposta_enviada' | 'em_negociacao' | 'on_hold' | 'ganho' | 'perdido'
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
      .from('omnia_crm_leads' as any)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as any) || []
  }

  async getById(id: string): Promise<CrmLead | null> {
    const { data, error } = await supabase
      .from('omnia_crm_leads' as any)
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as any
  }

  async create(lead: Partial<CrmLead>): Promise<CrmLead> {
    // Get current user
    const { data: userData } = await supabase
      .from('omnia_users' as any)
      .select('id')
      .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
      .single()

    const { data, error } = await supabase
      .from('omnia_crm_leads' as any)
      .insert({
        ...lead,
        created_by: (userData as any)?.id
      })
      .select()
      .single()

    if (error) throw error
    return data as any
  }

  async update(id: string, updates: Partial<CrmLead>): Promise<CrmLead> {
    const { data, error } = await supabase
      .from('omnia_crm_leads' as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as any
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('omnia_crm_leads' as any)
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getComments(leadId: string): Promise<CrmComment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_comments' as any)
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as any) || []
  }

  async createComment(comment: Partial<CrmComment>): Promise<CrmComment> {
    // Get current user
    const { data: userData } = await supabase
      .from('omnia_users' as any)
      .select('id')
      .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
      .single()

    const { data, error } = await supabase
      .from('omnia_crm_comments' as any)
      .insert({
        ...comment,
        author_id: (userData as any)?.id,
        created_by: (userData as any)?.id
      })
      .select()
      .single()

    if (error) throw error
    return data as any
  }

  async getAttachments(leadId: string): Promise<CrmAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_attachments' as any)
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as any) || []
  }

  async searchByCep(cep: string): Promise<ViaCepResponse | null> {
    const cleanCep = cep.replace(/\D/g, '')
    
    if (cleanCep.length !== 8) {
      throw new Error('CEP deve ter 8 dígitos')
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      
      if (data.erro) {
        throw new Error('CEP não encontrado')
      }
      
      return data
    } catch (error) {
      console.error('Erro ao buscar CEP:', error)
      throw error
    }
  }

  async filterByStatus(status: CrmLead['status']): Promise<CrmLead[]> {
    const { data, error } = await supabase
      .from('omnia_crm_leads' as any)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as any) || []
  }

  async filterByAssignedUser(userId: string): Promise<CrmLead[]> {
    const { data, error } = await supabase
      .from('omnia_crm_leads' as any)
      .select('*')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as any) || []
  }

  async searchByCompany(searchTerm: string): Promise<CrmLead[]> {
    const { data, error } = await supabase
      .from('omnia_crm_leads' as any)
      .select('*')
      .ilike('cliente', `%${searchTerm}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as any) || []
  }
}

export const crmLeadsRepo = new CrmLeadsRepository()