import { supabase } from '@/integrations/supabase/client';
import { logger } from '../lib/logging';

export interface AdmissaoComment {
  id: string;
  admissaoId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatarUrl?: string;
  authorColor?: string;
  body: string;
  createdAt: Date;
}

function transformCommentFromDB(dbComment: any): AdmissaoComment {
  return {
    id: dbComment.id,
    admissaoId: dbComment.admissao_id,
    authorId: dbComment.author?.id || dbComment.author_id,
    authorName: dbComment.author?.name || 'Usuário',
    authorEmail: dbComment.author?.email || '',
    authorAvatarUrl: dbComment.author?.avatar_url || undefined,
    authorColor: dbComment.author?.color || '#3B82F6',
    body: dbComment.body,
    createdAt: new Date(dbComment.created_at),
  };
}

export const admissaoCommentsRepoSupabase = {
  async listByAdmissao(admissaoId: string): Promise<AdmissaoComment[]> {
    logger.debug(`Loading comments for admissão: ${admissaoId}`)
    
    const { data, error } = await supabase
      .from('omnia_admissao_comments' as any)
      .select(`
        *,
        author:omnia_users!omnia_admissao_comments_author_id_fkey(id, name, email, avatar_url, color)
      `)
      .eq('admissao_id', admissaoId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Erro ao buscar comentários de admissão:', error);
      throw error;
    }

    return data?.map(transformCommentFromDB) || [];
  },

  async create(admissaoId: string, authorId: string, body: string): Promise<AdmissaoComment> {
    logger.debug(`Creating comment for admissão: ${admissaoId}`)
    
    const { data, error } = await supabase
      .from('omnia_admissao_comments' as any)
      .insert({
        admissao_id: admissaoId,
        author_id: authorId,
        body: body,
      })
      .select(`
        *,
        author:omnia_users!omnia_admissao_comments_author_id_fkey(id, name, email, avatar_url, color)
      `)
      .single();

    if (error) {
      logger.error('Erro ao criar comentário de admissão:', error);
      throw error;
    }

    return transformCommentFromDB(data);
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing comment: ${id}`)
    
    const { error } = await supabase
      .from('omnia_admissao_comments' as any)
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Erro ao deletar comentário de admissão:', error);
      throw error;
    }

    return true;
  }
};
