import { supabase } from '@/integrations/supabase/client';

export interface CrmComment {
  id: string
  lead_id: string
  body: string
  created_by?: string
  author_id: string
  created_at: string
  updated_at?: string
  author_user?: {
    id: string
    name: string
    roles: string[]
    avatar_url?: string
    color?: string
  }
}

export interface CreateCrmComment {
  lead_id: string
  body: string
  author_id?: string // Will be set automatically in the repository
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

  async create(comment: CreateCrmComment): Promise<CrmComment> {
    // Get current user from omnia_users
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      throw new Error('No authenticated user')
    }

    const { data: omniaUser } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', user.user.id)
      .single()

    if (!omniaUser) {
      throw new Error('Omnia user not found')
    }

    const { data, error } = await supabase
      .from('omnia_crm_comments')
      .insert({
        lead_id: comment.lead_id,
        author_id: omniaUser.id,
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
      throw error
    }

    return data
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