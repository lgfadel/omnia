import { supabase } from '@/integrations/supabase/client';

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  comment_id?: string | null;
  name: string;
  url: string;
  mime_type: string | null;
  size_kb: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export type CreateTicketAttachment = {
  ticket_id: string;
  comment_id?: string | null;
  name: string;
  url: string;
  mime_type: string | null;
  size_kb: number | null;
  uploaded_by: string | null;
}

export const ticketAttachmentsRepoSupabase = {
  async list(ticketId: string): Promise<TicketAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async listByComment(commentId: string): Promise<TicketAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_ticket_attachments')
      .select('*')
      .eq('comment_id', commentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async listDirectTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .is('comment_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async create(attachment: CreateTicketAttachment): Promise<TicketAttachment> {
    const { data, error } = await supabase
      .from('omnia_ticket_attachments')
      .insert(attachment)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_ticket_attachments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },
};