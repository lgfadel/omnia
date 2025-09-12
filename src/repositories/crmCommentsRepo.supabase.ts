import { supabase } from '@/integrations/supabase/client';

export interface CrmComment {
  id: string
  lead_id: string
  body: string
  created_by?: string
  author_id: string
  created_at: string
  updated_at: string
  author_user?: {
    id: string
    name: string
    roles: string[]
    avatar_url?: string
    color?: string
  }
}

export const crmCommentsRepoSupabase = {
  async list(): Promise<CrmComment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_comments')
      .select(`
        id,
        lead_id,
        author_id,
        body,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar comentários:', error)
      return []
    }

    return (data as CrmComment[]) || []
  },

  async getByLeadId(leadId: string): Promise<CrmComment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_comments')
      .select(`
        id,
        lead_id,
        author_id,
        body,
        created_at
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar comentários:', error)
      return []
    }

    return (data as CrmComment[]) || []
  },

  async create(comment: Omit<CrmComment, 'id' | 'created_at' | 'updated_at'>): Promise<CrmComment | null> {
    const { data, error } = await supabase
      .from('omnia_crm_comments')
      .insert({
        lead_id: comment.lead_id,
        author_id: comment.author_id,
        body: comment.body
      })
      .select(`
        id,
        lead_id,
        author_id,
        body,
        created_at
      `)
      .single()

    if (error) {
      console.error('Erro ao criar comentário:', error)
      return null
    }

    return data as CrmComment
  },

  async update(id: string, updates: Partial<Pick<CrmComment, 'body'>>): Promise<CrmComment | null> {
    const { data, error } = await supabase
      .from('omnia_crm_comments')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        lead_id,
        author_id,
        body,
        created_at
      `)
      .single()

    if (error) {
      console.error('Erro ao atualizar comentário:', error)
      return null
    }

    return data as CrmComment
  },

  async remove(id: string): Promise<boolean> {
    console.log('Removing CRM comment:', id)
    
    const { error } = await supabase
      .from('omnia_crm_comments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error removing CRM comment:', error)
      throw error
    }

    return true
  }
}