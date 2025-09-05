import { supabase } from '@/integrations/supabase/client';

export interface TicketComment {
  id: string
  ticket_id: string
  body: string
  created_by?: string
  author_id: string
  created_at: string
}

export const ticketCommentsRepoSupabase = {
  async list(ticketId: string): Promise<TicketComment[]> {
    console.log('Loading ticket comments from database...', ticketId)
    
    const { data, error } = await supabase
      .from('omnia_ticket_comments' as any)
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading ticket comments:', error);
      throw error;
    }
    
    return (data as any) || [];
  },

  async create(comment: Omit<TicketComment, 'id' | 'created_at'>): Promise<TicketComment> {
    console.log('Creating ticket comment:', comment)
    
    const { data, error } = await supabase
      .from('omnia_ticket_comments' as any)
      .insert(comment)
      .select()
      .single();

    if (error) {
      console.error('Error creating ticket comment:', error);
      throw error;
    }

    return data as any;
  },

  async update(id: string, body: string): Promise<TicketComment | null> {
    console.log('Updating ticket comment:', id, body)
    
    const { data, error } = await supabase
      .from('omnia_ticket_comments' as any)
      .update({ body })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating ticket comment:', error);
      throw error;
    }

    return data as any;
  },

  async remove(id: string): Promise<boolean> {
    console.log('Deleting ticket comment:', id)
    
    const { error } = await supabase
      .from('omnia_ticket_comments' as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting ticket comment:', error);
      throw error;
    }

    return true;
  }
}