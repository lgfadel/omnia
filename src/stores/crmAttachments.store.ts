import { create } from 'zustand';
import { CrmAttachment, CreateCrmAttachment, crmAttachmentsRepoSupabase } from '@/repositories/crmAttachmentsRepo.supabase';

interface CrmAttachmentsState {
  attachments: CrmAttachment[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadAttachments: (leadId: string) => Promise<void>;
  loadAttachmentsByComment: (commentId: string) => Promise<void>;
  loadDirectLeadAttachments: (leadId: string) => Promise<void>;
  addAttachment: (attachment: CreateCrmAttachment) => Promise<void>;
  removeAttachment: (id: string) => Promise<void>;
  removeAttachmentsByComment: (commentId: string) => Promise<void>;
  clearAttachments: () => void;
}

export const useCrmAttachmentsStore = create<CrmAttachmentsState>((set, get) => ({
  attachments: [],
  isLoading: false,
  error: null,

  loadAttachments: async (leadId: string) => {
    set({ isLoading: true, error: null });
    try {
      const attachments = await crmAttachmentsRepoSupabase.list(leadId);
      set({ attachments, isLoading: false });
    } catch (error) {
      console.error('Error loading CRM attachments:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar anexos',
        isLoading: false 
      });
    }
  },

  loadAttachmentsByComment: async (commentId: string) => {
    set({ isLoading: true, error: null });
    try {
      const attachments = await crmAttachmentsRepoSupabase.listByComment(commentId);
      set({ attachments, isLoading: false });
    } catch (error) {
      console.error('Error loading CRM comment attachments:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar anexos do comentário',
        isLoading: false 
      });
    }
  },

  loadDirectLeadAttachments: async (leadId: string) => {
    set({ isLoading: true, error: null });
    try {
      const attachments = await crmAttachmentsRepoSupabase.listDirectLeadAttachments(leadId);
      set({ attachments, isLoading: false });
    } catch (error) {
      console.error('Error loading direct CRM lead attachments:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar anexos diretos do lead',
        isLoading: false 
      });
    }
  },

  addAttachment: async (attachment: CreateCrmAttachment) => {
    try {
      const newAttachment = await crmAttachmentsRepoSupabase.create(attachment);
      const { attachments } = get();
      set({ attachments: [newAttachment, ...attachments] });
    } catch (error) {
      console.error('Error adding CRM attachment:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao adicionar anexo' });
    }
  },

  removeAttachment: async (id: string) => {
    try {
      await crmAttachmentsRepoSupabase.remove(id);
      const { attachments } = get();
      const filteredAttachments = attachments.filter(attachment => attachment.id !== id);
      set({ attachments: filteredAttachments });
    } catch (error) {
      console.error('Error removing CRM attachment:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao remover anexo' });
    }
  },

  removeAttachmentsByComment: async (commentId: string) => {
    try {
      await crmAttachmentsRepoSupabase.removeByComment(commentId);
      const { attachments } = get();
      const filteredAttachments = attachments.filter(attachment => attachment.comment_id !== commentId);
      set({ attachments: filteredAttachments });
    } catch (error) {
      console.error('Error removing CRM comment attachments:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao remover anexos do comentário' });
    }
  },

  clearAttachments: () => {
    set({ attachments: [], error: null });
  }
}));