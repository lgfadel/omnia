import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logging';

export interface AtaComment {
  id: string
  ata_id: string
  body: string
  created_by?: string
  author_id: string
  created_at: string
}

export const ataCommentsRepoSupabase = {
  async list(ataId: string): Promise<AtaComment[]> {
    logger.debug('Loading ata comments from database...', ataId)
    
    const { data, error } = await supabase
      .from('omnia_comments' as any)
      .select('*')
      .eq('ata_id', ataId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading ata comments:', error);
      throw error;
    }
    
    return (data as any) || [];
  },

  async create(comment: Omit<AtaComment, 'id' | 'created_at'>): Promise<AtaComment> {
    logger.debug('Creating ata comment...', comment)
    
    // Get current user from omnia_users
    const { data: user } = await supabase.auth.getUser()
    
    const { data: omniaUser } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', user.user.id)
      .single()

    if (!omniaUser) {
      throw new Error('Usuário não encontrado na tabela omnia_users')
    }

    const { data, error } = await supabase
      .from('omnia_comments' as any)
      .insert({
        ...comment,
        author_id: omniaUser.id,
        created_by: omniaUser.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ata comment:', error);
      throw error;
    }

    return data as unknown as AtaComment;
  },

  async update(id: string, body: string): Promise<AtaComment | null> {
    logger.debug('Updating ata comment...', { id, body })
    
    const { data, error } = await supabase
      .from('omnia_comments' as any)
      .update({ body })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating ata comment:', error);
      throw error;
    }

    return data as unknown as AtaComment;
  },

  async remove(id: string): Promise<boolean> {
    logger.debug('Removing ata comment...', id)
    
    const { error } = await supabase
      .from('omnia_comments' as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing ata comment:', error);
      throw error;
    }

    return true;
  }
}