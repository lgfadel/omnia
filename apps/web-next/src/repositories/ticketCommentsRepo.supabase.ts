import { supabase } from '@/integrations/supabase/client';
import { logger } from '../lib/logging';

const getCurrentOmniaUserId = async () => {
  const { data } = await supabase.auth.getUser()
  const authUserId = data.user?.id

  if (!authUserId) {
    throw new Error('Usuário autenticado não encontrado')
  }

  const { data: omniaUser, error } = await supabase
    .from('omnia_users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single()

  if (error || !omniaUser?.id) {
    throw new Error('Usuário não encontrado na tabela omnia_users')
  }

  return omniaUser.id
}


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
    logger.debug(`Loading ticket comments from database: ${ticketId}`)
    
    const { data, error } = await supabase
      .from('omnia_ticket_comments' as any)
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error loading ticket comments:', error);
      throw error;
    }
    
    return (data as any) || [];
  },

  async create(comment: Omit<TicketComment, 'id' | 'created_at'>): Promise<TicketComment> {
    logger.debug('Creating ticket comment:', comment)
    
    // Get current user from omnia_users
    const omniaUserId = await getCurrentOmniaUserId()
    
    const { data, error } = await supabase
      .from('omnia_ticket_comments' as any)
      .insert({
        ...comment,
        author_id: omniaUserId,
        created_by: omniaUserId
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating ticket comment:', error);
      throw error;
    }

    return data as any;
  },

  async update(id: string, body: string): Promise<TicketComment | null> {
    logger.debug(`Updating ticket comment: ${id}`, body)
    
    const { data, error } = await supabase
      .from('omnia_ticket_comments' as any)
      .update({ body })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating ticket comment:', error);
      throw error;
    }

    return data as any;
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Deleting ticket comment: ${id}`)
    
    const { error } = await supabase
      .from('omnia_ticket_comments' as any)
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting ticket comment:', error);
      throw error;
    }

    return true;
  }
}