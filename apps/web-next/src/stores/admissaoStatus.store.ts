import { create } from 'zustand';
import { admissaoStatusRepoSupabase, type AdmissaoStatus } from '@/repositories/admissaoStatusRepo.supabase';
import { logger } from '../lib/logging';

interface AdmissaoStatusStore {
  statuses: AdmissaoStatus[];
  loading: boolean;
  error: string | null;
  
  loadStatuses: () => Promise<void>;
  createStatus: (data: Omit<AdmissaoStatus, 'id'>) => Promise<AdmissaoStatus>;
  updateStatus: (id: string, data: Partial<Omit<AdmissaoStatus, 'id'>>) => Promise<AdmissaoStatus | null>;
  deleteStatus: (id: string) => Promise<boolean>;
  reorderStatuses: (statuses: AdmissaoStatus[]) => Promise<void>;
  clearError: () => void;
}

export const useAdmissaoStatusStore = create<AdmissaoStatusStore>((set, get) => ({
  statuses: [],
  loading: false,
  error: null,

  loadStatuses: async () => {
    set({ loading: true, error: null });
    try {
      const statuses = await admissaoStatusRepoSupabase.list();
      set({ statuses, loading: false });
    } catch (error) {
      logger.error('Erro ao carregar status de admissão:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
    }
  },

  createStatus: async (data: Omit<AdmissaoStatus, 'id'>) => {
    set({ loading: true, error: null });
    try {
      const newStatus = await admissaoStatusRepoSupabase.create(data);
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

  updateStatus: async (id: string, data: Partial<Omit<AdmissaoStatus, 'id'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedStatus = await admissaoStatusRepoSupabase.update(id, data);
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
      await admissaoStatusRepoSupabase.remove(id);
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

  reorderStatuses: async (statuses: AdmissaoStatus[]) => {
    set({ loading: true, error: null });
    try {
      await admissaoStatusRepoSupabase.reorder(statuses);
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
