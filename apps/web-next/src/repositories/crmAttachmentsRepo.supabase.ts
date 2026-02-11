import { supabase } from '@/integrations/supabase/client';

export interface CrmAttachment {
  id: string;
  lead_id?: string | null;
  comment_id?: string | null;
  name: string;
  url: string;
  mime_type: string | null;
  size_kb: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CreateCrmAttachment {
  lead_id?: string | null;
  comment_id?: string | null;
  name: string;
  url: string;
  mime_type?: string | null;
  size_kb?: number | null;
  uploaded_by?: string | null;
}

export const crmAttachmentsRepoSupabase = {
  async list(leadId: string): Promise<CrmAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_attachments')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as CrmAttachment[];
  },

  async listByComment(commentId: string): Promise<CrmAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_attachments')
      .select('*')
      .eq('comment_id', commentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as CrmAttachment[];
  },

  async listDirectLeadAttachments(leadId: string): Promise<CrmAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_crm_attachments')
      .select('*')
      .eq('lead_id', leadId)
      .is('comment_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as CrmAttachment[];
  },

  async create(attachment: CreateCrmAttachment): Promise<CrmAttachment> {
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
      .from('omnia_crm_attachments')
      .insert({
        ...attachment,
        uploaded_by: omniaUser.id
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as CrmAttachment;
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_crm_attachments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async removeByComment(commentId: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_crm_attachments')
      .delete()
      .eq('comment_id', commentId);

    if (error) throw error;
    return true;
  }
};