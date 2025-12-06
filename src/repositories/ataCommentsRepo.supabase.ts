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

export interface CreateAtaComment {
  ata_id: string
  body: string
  // author_id será definido automaticamente no repositório
}

export const ataCommentsRepoSupabase = {
  async list(ataId: string): Promise<AtaComment[]> {
    logger.debug(`Loading ata comments from database: ${ataId}`)
    
    const { data, error } = await supabase
      .from('omnia_comments' as any)
      .select('*')
      .eq('ata_id', ataId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error loading ata comments:', error);
      throw error;
    }
    
    return (data as any) || [];
  },

  async create(comment: CreateAtaComment): Promise<AtaComment> {
    logger.debug('Creating ata comment:', comment)
    
    // Get current user from auth
    const { data: user, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user.user) {
      throw new Error('Usuário não autenticado')
    }

    // Get omnia_user for author_id
    const { data: omniaUser } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', user.user.id)
      .single()

    if (!omniaUser) {
      throw new Error('Usuário não encontrado na tabela omnia_users')
    }

    // Log detailed information for debugging
    logger.info('Creating ata comment with IDs:', {
      authUserId: user.user.id,
      omniaUserId: omniaUser.id,
      ataId: comment.ata_id
    });

    const { data, error } = await supabase
      .from('omnia_comments' as any)
      .insert({
        ...comment,
        author_id: omniaUser.id,
        created_by: omniaUser.id  // Uses omnia_users.id after constraint fix
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating ata comment:', error);
      throw error;
    }

    return data as unknown as AtaComment;
  },

  async update(id: string, body: string): Promise<AtaComment | null> {
    logger.debug(`Updating ata comment: ${id}`, { body })
    
    const { data, error } = await supabase
      .from('omnia_comments' as any)
      .update({ body })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating ata comment:', error);
      throw error;
    }

    return data as unknown as AtaComment;
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing ata comment: ${id}`)
    
    const { error } = await supabase
      .from('omnia_comments' as any)
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error removing ata comment:', error);
      throw error;
    }

    return true;
  }
}