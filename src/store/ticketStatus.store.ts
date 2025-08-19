import { create } from 'zustand';
import { ticketStatusRepoSupabase, type TicketStatus } from '@/repositories/ticketStatusRepo.supabase';

interface TicketStatusStore {
  statuses: TicketStatus[];
  loading: boolean;
  error: string | null;
  
  loadStatuses: () => Promise<void>;
  createStatus: (data: Omit<TicketStatus, 'id'>) => Promise<TicketStatus>;
  updateStatus: (id: string, data: Partial<Omit<TicketStatus, 'id'>>) => Promise<TicketStatus | null>;
  deleteStatus: (id: string) => Promise<boolean>;
  reorderStatuses: (statuses: TicketStatus[]) => Promise<void>;
  clearError: () => void;
}

export const useTicketStatusStore = create<TicketStatusStore>((set, get) => ({
  statuses: [],
  loading: false,
  error: null,

  loadStatuses: async () => {
    set({ loading: true, error: null });
    try {
      const statuses = await ticketStatusRepoSupabase.list();
      set({ statuses, loading: false });
    } catch (error) {
      console.error('Erro ao carregar status de tickets:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
    }
  },

  createStatus: async (data: Omit<TicketStatus, 'id'>) => {
    set({ loading: true, error: null });
    try {
      const newStatus = await ticketStatusRepoSupabase.create(data);
      const currentStatuses = get().statuses;
      set({ 
        statuses: [...currentStatuses, newStatus],
        loading: false 
      });
      return newStatus;
    } catch (error) {
      console.error('Erro ao criar status de ticket:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  updateStatus: async (id: string, data: Partial<Omit<TicketStatus, 'id'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedStatus = await ticketStatusRepoSupabase.update(id, data);
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
      console.error('Erro ao atualizar status de ticket:', error);
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
      await ticketStatusRepoSupabase.remove(id);
      const updatedStatuses = currentStatuses.filter(status => status.id !== id);
      set({ 
        statuses: updatedStatuses,
        loading: false 
      });
      return true;
    } catch (error) {
      console.error('Erro ao deletar status de ticket:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  reorderStatuses: async (statuses: TicketStatus[]) => {
    set({ loading: true, error: null });
    try {
      await ticketStatusRepoSupabase.reorder(statuses);
      set({ 
        statuses: [...statuses],
        loading: false 
      });
    } catch (error) {
      console.error('Erro ao reordenar status de tickets:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));