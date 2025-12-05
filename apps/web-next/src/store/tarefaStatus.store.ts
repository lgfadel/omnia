import { create } from 'zustand';
import { tarefaStatusRepoSupabase, type TarefaStatus } from '@/repositories/tarefaStatusRepo.supabase';
import { logger } from '../lib/logging';


interface TarefaStatusStore {
  statuses: TarefaStatus[];
  loading: boolean;
  error: string | null;
  
  loadStatuses: () => Promise<void>;
  createStatus: (data: Omit<TarefaStatus, 'id'>) => Promise<TarefaStatus>;
  updateStatus: (id: string, data: Partial<Omit<TarefaStatus, 'id'>>) => Promise<TarefaStatus | null>;
  deleteStatus: (id: string) => Promise<boolean>;
  reorderStatuses: (statuses: TarefaStatus[]) => Promise<void>;
  clearError: () => void;
}

export const useTarefaStatusStore = create<TarefaStatusStore>((set, get) => ({
  statuses: [],
  loading: false,
  error: null,

  loadStatuses: async () => {
    set({ loading: true, error: null });
    try {
      const statuses = await tarefaStatusRepoSupabase.list();
      set({ statuses, loading: false });
    } catch (error) {
      logger.error('Erro ao carregar status de tarefas:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
    }
  },

  createStatus: async (data: Omit<TarefaStatus, 'id'>) => {
    set({ loading: true, error: null });
    try {
      const newStatus = await tarefaStatusRepoSupabase.create(data);
      const currentStatuses = get().statuses;
      set({ 
        statuses: [...currentStatuses, newStatus],
        loading: false 
      });
      return newStatus;
    } catch (error) {
      logger.error('Erro ao criar status de tarefa:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  updateStatus: async (id: string, data: Partial<Omit<TarefaStatus, 'id'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedStatus = await tarefaStatusRepoSupabase.update(id, data);
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
      logger.error('Erro ao atualizar status de tarefa:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  deleteStatus: async (id: string) => {
    // Check if it's a default status
    const currentStatuses = get().statuses;
    const statusToDelete = currentStatuses.find(s => s.id === id);
    
    if (statusToDelete?.isDefault) {
      const errorMsg = 'Não é possível deletar um status padrão';
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }

    set({ loading: true, error: null });
    try {
      await tarefaStatusRepoSupabase.remove(id);
      const updatedStatuses = currentStatuses.filter(status => status.id !== id);
      set({ 
        statuses: updatedStatuses,
        loading: false 
      });
      return true;
    } catch (error) {
      logger.error('Erro ao deletar status de tarefa:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  reorderStatuses: async (statuses: TarefaStatus[]) => {
    set({ loading: true, error: null });
    try {
      await tarefaStatusRepoSupabase.reorder(statuses);
      set({ 
        statuses: [...statuses],
        loading: false 
      });
    } catch (error) {
      logger.error('Erro ao reordenar status de tarefas:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));