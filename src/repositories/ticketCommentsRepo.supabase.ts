import { supabase } from '@/integrations/supabase/client';

export interface TicketComment {
  id: string;
  ticket_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  author_id: string;
}

export const ticketCommentsRepoSupabase = {
  async list(ticketId: string): Promise<TicketComment[]> {
    const { data, error } = await supabase
      .from('omnia_ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(comment: Omit<TicketComment, 'id' | 'created_at'>): Promise<TicketComment> {
    const { data, error } = await supabase
      .from('omnia_ticket_comments')
      .insert(comment)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_ticket_comments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async update(id: string, comment: Partial<Pick<TicketComment, 'body'>>): Promise<TicketComment | null> {
    const { data, error } = await supabase
      .from('omnia_ticket_comments')
      .update(comment)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};