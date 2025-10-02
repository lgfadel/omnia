import { create } from 'zustand';
import { CrmComment, crmCommentsRepoSupabase } from '@/repositories/crmCommentsRepo.supabase';
import { logger } from '../lib/logging';


interface CrmCommentsState {
  comments: CrmComment[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadComments: (leadId: string) => Promise<void>;
  addComment: (leadId: string, body: string) => Promise<CrmComment>;
  updateComment: (id: string, body: string) => Promise<void>;
  removeComment: (id: string) => Promise<void>;
  clearComments: () => void;
}

export const useCrmCommentsStore = create<CrmCommentsState>((set, get) => ({
  comments: [],
  isLoading: false,
  error: null,

  loadComments: async (leadId: string) => {
    set({ isLoading: true, error: null });
    try {
      const comments = await crmCommentsRepoSupabase.getByLeadId(leadId);
      set({ comments, isLoading: false });
    } catch (error) {
      logger.error('Error loading CRM comments:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar comentários',
        isLoading: false 
      });
    }
  },

  addComment: async (leadId: string, body: string) => {
    try {
      const newComment = await crmCommentsRepoSupabase.create({
        lead_id: leadId,
        body,
        author_id: '' // Will be set in the repository
      })
      
      set(state => ({
        comments: [newComment, ...state.comments]
      }))
      
      return newComment
    } catch (error) {
      logger.error('Error adding comment:', error)
      throw error
    }
  },

  updateComment: async (id: string, body: string) => {
    try {
      const updatedComment = await crmCommentsRepoSupabase.update(id, { body });
      if (updatedComment) {
        const { comments } = get();
        const updatedComments = comments.map(comment => 
          comment.id === id ? updatedComment : comment
        );
        set({ comments: updatedComments });
      } else {
        set({ error: 'Erro ao atualizar comentário' });
      }
    } catch (error) {
      logger.error('Error updating CRM comment:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao atualizar comentário' });
    }
  },

  removeComment: async (id: string) => {
    try {
      await crmCommentsRepoSupabase.remove(id);
      const { comments } = get();
      const filteredComments = comments.filter(comment => comment.id !== id);
      set({ comments: filteredComments });
    } catch (error) {
      logger.error('Error removing CRM comment:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao remover comentário' });
    }
  },

  clearComments: () => {
    set({ comments: [], error: null });
  }
}));