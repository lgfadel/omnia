import { create } from 'zustand';
import { rescisaoStatusRepoSupabase, type RescisaoStatus } from '@/repositories/rescisaoStatusRepo.supabase';
import { logger } from '../lib/logging';

interface RescisaoStatusStore {
  statuses: RescisaoStatus[];
  loading: boolean;
  error: string | null;
  
  loadStatuses: () => Promise<void>;
  createStatus: (data: Omit<RescisaoStatus, 'id'>) => Promise<RescisaoStatus>;
  updateStatus: (id: string, data: Partial<Omit<RescisaoStatus, 'id'>>) => Promise<RescisaoStatus | null>;
  deleteStatus: (id: string) => Promise<boolean>;
  reorderStatuses: (statuses: RescisaoStatus[]) => Promise<void>;
  clearError: () => void;
}

export const useRescisaoStatusStore = create<RescisaoStatusStore>((set, get) => ({
  statuses: [],
  loading: false,
  error: null,

  loadStatuses: async () => {
    set({ loading: true, error: null });
    try {
      const statuses = await rescisaoStatusRepoSupabase.list();
      set({ statuses, loading: false });
    } catch (error) {
      logger.error('Erro ao carregar status de admissão:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
    }
  },

  createStatus: async (data: Omit<RescisaoStatus, 'id'>) => {
    set({ loading: true, error: null });
    try {
      const newStatus = await rescisaoStatusRepoSupabase.create(data);
      const currentStatuses = get().statuses;
      set({ 
        statuses: [...currentStatuses, newStatus],
        loading: false 
      });
      return newStatus;
    } catch (error) {
      logger.error('Erro ao criar status de admissão:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  updateStatus: async (id: string, data: Partial<Omit<RescisaoStatus, 'id'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedStatus = await rescisaoStatusRepoSupabase.update(id, data);
      if (updatedStatus) {
        const currentStatuses = get().statuses;
        const updatedStatuses = currentStatuses.map(status => 
          status.id === id ? updatedStatus : status
        );
        set({ 
          statuses: updatedStatuses,
          loading: false 
        });
      }
      return updatedStatus;
    } catch (error) {
      logger.error('Erro ao atualizar status de admissão:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  deleteStatus: async (id: string) => {
    const currentStatuses = get().statuses;
    const statusToDelete = currentStatuses.find(s => s.id === id);
    
    if (statusToDelete?.isDefault) {
      const errorMsg = 'Não é possível deletar um status padrão';
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }

    set({ loading: true, error: null });
    try {
      await rescisaoStatusRepoSupabase.remove(id);
      const updatedStatuses = currentStatuses.filter(status => status.id !== id);
      set({ 
        statuses: updatedStatuses,
        loading: false 
      });
      return true;
    } catch (error) {
      logger.error('Erro ao deletar status de admissão:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  reorderStatuses: async (statuses: RescisaoStatus[]) => {
    set({ loading: true, error: null });
    try {
      await rescisaoStatusRepoSupabase.reorder(statuses);
      set({ 
        statuses: [...statuses],
        loading: false 
      });
    } catch (error) {
      logger.error('Erro ao reordenar status de admissão:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
