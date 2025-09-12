import { create } from 'zustand';
import { crmStatusRepoSupabase } from '@/repositories/crmStatusRepo.supabase';
import { Status } from '@/data/types';

interface CrmStatusStore {
  statuses: Status[];
  loading: boolean;
  error: string | null;
  
  loadStatuses: () => Promise<void>;
  createStatus: (data: Omit<Status, 'id'>) => Promise<Status>;
  updateStatus: (id: string, data: Partial<Omit<Status, 'id'>>) => Promise<Status | null>;
  deleteStatus: (id: string) => Promise<boolean>;
  reorderStatuses: (statuses: Status[]) => Promise<void>;
  clearError: () => void;
}

export const useCrmStatusStore = create<CrmStatusStore>((set, get) => ({
  statuses: [],
  loading: false,
  error: null,

  loadStatuses: async () => {
    set({ loading: true, error: null });
    try {
      const statuses = await crmStatusRepoSupabase.list();
      set({ statuses, loading: false });
    } catch (error) {
      console.error('Erro ao carregar status do CRM:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
    }
  },

  createStatus: async (data: Omit<Status, 'id'>) => {
    set({ loading: true, error: null });
    try {
      const newStatus = await crmStatusRepoSupabase.create(data);
      const currentStatuses = get().statuses;
      set({ 
        statuses: [...currentStatuses, newStatus],
        loading: false 
      });
      return newStatus;
    } catch (error) {
      console.error('Erro ao criar status do CRM:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  updateStatus: async (id: string, data: Partial<Omit<Status, 'id'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedStatus = await crmStatusRepoSupabase.update(id, data);
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
      console.error('Erro ao atualizar status do CRM:', error);
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
      await crmStatusRepoSupabase.remove(id);
      const updatedStatuses = currentStatuses.filter(status => status.id !== id);
      set({ 
        statuses: updatedStatuses,
        loading: false 
      });
      return true;
    } catch (error) {
      console.error('Erro ao deletar status do CRM:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  reorderStatuses: async (statuses: Status[]) => {
    set({ loading: true, error: null });
    try {
      await crmStatusRepoSupabase.reorder(statuses);
      set({ 
        statuses: [...statuses],
        loading: false 
      });
    } catch (error) {
      console.error('Erro ao reordenar status do CRM:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));