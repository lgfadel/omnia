import { supabase } from '@/integrations/supabase/client';

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  name: string;
  url: string;
  mime_type: string | null;
  size_kb: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export const ticketAttachmentsRepoSupabase = {
  async list(ticketId: string): Promise<TicketAttachment[]> {
    const { data, error } = await supabase
      .from('omnia_ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(attachment: Omit<TicketAttachment, 'id' | 'created_at'>): Promise<TicketAttachment> {
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