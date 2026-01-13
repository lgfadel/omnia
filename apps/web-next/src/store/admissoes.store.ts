import { create } from 'zustand';
import { admissoesRepoSupabase, type Admissao } from '@/repositories/admissoesRepo.supabase';
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '../lib/logging';
import type { RealtimeChannel } from '@supabase/supabase-js';

let realtimeChannel: RealtimeChannel | null = null;

interface AdmissoesStore {
  admissoes: Admissao[];
  loading: boolean;
  error: string | null;
  
  loadAdmissoes: () => Promise<void>;
  getAdmissaoById: (id: string) => Promise<Admissao | null>;
  createAdmissao: (admissao: Omit<Admissao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>) => Promise<Admissao>;
  updateAdmissao: (id: string, admissao: Partial<Omit<Admissao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>>) => Promise<Admissao | null>;
  deleteAdmissao: (id: string) => Promise<boolean>;
  searchAdmissoes: (query: string) => Promise<Admissao[]>;
  subscribeToRealtime: () => void;
  unsubscribeFromRealtime: () => void;
  clearError: () => void;
}

export const useAdmissoesStore = create<AdmissoesStore>((set, get) => ({
  admissoes: [],
  loading: false,
  error: null,

  loadAdmissoes: async () => {
    set({ loading: true, error: null });
    try {
      const admissoes = await admissoesRepoSupabase.list();
      set({ admissoes, loading: false });
    } catch (error) {
      logger.error('Erro ao carregar admissões:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'admissão', 'omnia_admissoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
    }
  },

  getAdmissaoById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const admissao = await admissoesRepoSupabase.get(id);
      set({ loading: false });
      return admissao;
    } catch (error) {
      logger.error('Erro ao buscar admissão:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'admissão', 'omnia_admissoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      return null;
    }
  },

  createAdmissao: async (admissaoData: Omit<Admissao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>) => {
    set({ loading: true, error: null });
    try {
      const novaAdmissao = await admissoesRepoSupabase.create(admissaoData);
      const currentAdmissoes = get().admissoes;
      set({ 
        admissoes: [novaAdmissao, ...currentAdmissoes],
        loading: false 
      });
      return novaAdmissao;
    } catch (error) {
      logger.error('Erro ao criar admissão:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'admissão', 'omnia_admissoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  updateAdmissao: async (id: string, admissaoData: Partial<Omit<Admissao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedAdmissao = await admissoesRepoSupabase.update(id, admissaoData);
      if (updatedAdmissao) {
        const currentAdmissoes = get().admissoes;
        const updatedAdmissoes = currentAdmissoes.map(admissao => 
          admissao.id === id ? updatedAdmissao : admissao
        );
        set({ 
          admissoes: updatedAdmissoes,
          loading: false 
        });
      }
      return updatedAdmissao;
    } catch (error) {
      logger.error('Erro ao atualizar admissão:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'admissão', 'omnia_admissoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  deleteAdmissao: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await admissoesRepoSupabase.remove(id);
      const currentAdmissoes = get().admissoes;
      const updatedAdmissoes = currentAdmissoes.filter(admissao => admissao.id !== id);
      set({ 
        admissoes: updatedAdmissoes,
        loading: false 
      });
      return true;
    } catch (error) {
      logger.error('Erro ao deletar admissão:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'admissão', 'omnia_admissoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  searchAdmissoes: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const admissoes = await admissoesRepoSupabase.search(query);
      set({ admissoes, loading: false });
      return admissoes;
    } catch (error) {
      logger.error('Erro ao buscar admissões:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'admissão', 'omnia_admissoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      return [];
    }
  },

  subscribeToRealtime: () => {
    if (realtimeChannel) return;

    realtimeChannel = supabase
      .channel('admissoes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'omnia_admissoes' },
        async (payload) => {
          logger.debug('Realtime event received for admissoes:', payload.eventType);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Reload the specific admissao to get full data with relations
            const admissao = await admissoesRepoSupabase.get(payload.new.id);
            if (admissao) {
              const currentAdmissoes = get().admissoes;
              const existingIndex = currentAdmissoes.findIndex(a => a.id === admissao.id);
              
              if (existingIndex >= 0) {
                const updatedAdmissoes = [...currentAdmissoes];
                updatedAdmissoes[existingIndex] = admissao;
                set({ admissoes: updatedAdmissoes });
              } else {
                set({ admissoes: [admissao, ...currentAdmissoes] });
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const currentAdmissoes = get().admissoes;
            set({ admissoes: currentAdmissoes.filter(a => a.id !== payload.old.id) });
          }
        }
      )
      .subscribe();
  },

  unsubscribeFromRealtime: () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  },

  clearError: () => set({ error: null }),
}));
