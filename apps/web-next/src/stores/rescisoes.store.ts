import { create } from 'zustand';
import { rescisaoRepoSupabase, type Rescisao } from '@/repositories/rescisaoRepo.supabase';
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '../lib/logging';
import type { RealtimeChannel } from '@supabase/supabase-js';

let realtimeChannel: RealtimeChannel | null = null;

interface RescisoesStore {
  rescisoes: Rescisao[];
  loading: boolean;
  error: string | null;
  
  loadRescisoes: () => Promise<void>;
  getRescisaoById: (id: string) => Promise<Rescisao | null>;
  createRescisao: (rescisao: Omit<Rescisao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>) => Promise<Rescisao>;
  updateRescisao: (id: string, rescisao: Partial<Omit<Rescisao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>>) => Promise<Rescisao | null>;
  deleteRescisao: (id: string) => Promise<boolean>;
  searchRescisoes: (query: string) => Promise<Rescisao[]>;
  subscribeToRealtime: () => void;
  unsubscribeFromRealtime: () => void;
  clearError: () => void;
}

export const useRescisoesStore = create<RescisoesStore>((set, get) => ({
  rescisoes: [],
  loading: false,
  error: null,

  loadRescisoes: async () => {
    set({ loading: true, error: null });
    try {
      const rescisoes = await rescisaoRepoSupabase.list();
      set({ rescisoes, loading: false });
    } catch (error) {
      logger.error('Erro ao carregar rescisões:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'rescisão', 'omnia_rescisoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
    }
  },

  getRescisaoById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const rescisao = await rescisaoRepoSupabase.get(id);
      set({ loading: false });
      return rescisao;
    } catch (error) {
      logger.error('Erro ao buscar rescisão:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'rescisão', 'omnia_rescisoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      return null;
    }
  },

  createRescisao: async (rescisaoData: Omit<Rescisao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>) => {
    set({ loading: true, error: null });
    try {
      const novaRescisao = await rescisaoRepoSupabase.create(rescisaoData);
      const currentRescisoes = get().rescisoes;
      set({ 
        rescisoes: [novaRescisao, ...currentRescisoes],
        loading: false 
      });
      return novaRescisao;
    } catch (error) {
      logger.error('Erro ao criar rescisão:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'rescisão', 'omnia_rescisoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  updateRescisao: async (id: string, rescisaoData: Partial<Omit<Rescisao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedRescisao = await rescisaoRepoSupabase.update(id, rescisaoData);
      if (updatedRescisao) {
        const currentRescisoes = get().rescisoes;
        const updatedRescisoes = currentRescisoes.map(rescisao => 
          rescisao.id === id ? updatedRescisao : rescisao
        );
        set({ 
          rescisoes: updatedRescisoes,
          loading: false 
        });
      }
      return updatedRescisao;
    } catch (error) {
      logger.error('Erro ao atualizar rescisão:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'rescisão', 'omnia_rescisoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  deleteRescisao: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await rescisaoRepoSupabase.remove(id);
      const currentRescisoes = get().rescisoes;
      const updatedRescisoes = currentRescisoes.filter(rescisao => rescisao.id !== id);
      set({ 
        rescisoes: updatedRescisoes,
        loading: false 
      });
      return true;
    } catch (error) {
      logger.error('Erro ao deletar rescisão:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'rescisão', 'omnia_rescisoes')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  searchRescisoes: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const rescisoes = await rescisaoRepoSupabase.search(query);
      set({ rescisoes, loading: false });
      return rescisoes;
    } catch (error) {
      logger.error('Erro ao buscar rescisões:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'rescisão', 'omnia_rescisoes')
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
      .channel('rescisoes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'omnia_rescisoes' },
        async (payload) => {
          logger.debug('Realtime event received for rescisoes:', payload.eventType);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const rescisao = await rescisaoRepoSupabase.get(payload.new.id);
            if (rescisao) {
              const currentRescisoes = get().rescisoes;
              const existingIndex = currentRescisoes.findIndex(r => r.id === rescisao.id);
              
              if (existingIndex >= 0) {
                const updatedRescisoes = [...currentRescisoes];
                updatedRescisoes[existingIndex] = rescisao;
                set({ rescisoes: updatedRescisoes });
              } else {
                set({ rescisoes: [rescisao, ...currentRescisoes] });
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const currentRescisoes = get().rescisoes;
            set({ rescisoes: currentRescisoes.filter(r => r.id !== payload.old.id) });
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
