import { create } from 'zustand';
import { crmOrigensRepoSupabase, CrmOrigem } from '@/repositories/crmOrigensRepo.supabase';

interface CrmOrigensStore {
  origens: CrmOrigem[];
  loading: boolean;
  error: string | null;
  
  loadOrigens: () => Promise<void>;
  createOrigem: (data: Omit<CrmOrigem, 'id'>) => Promise<CrmOrigem>;
  updateOrigem: (id: string, data: Partial<Omit<CrmOrigem, 'id'>>) => Promise<CrmOrigem | null>;
  deleteOrigem: (id: string) => Promise<boolean>;
  getDefaultOrigem: () => Promise<CrmOrigem | null>;
  clearError: () => void;
}

export const useCrmOrigensStore = create<CrmOrigensStore>((set, get) => ({
  origens: [],
  loading: false,
  error: null,

  loadOrigens: async () => {
    set({ loading: true, error: null });
    try {
      const origens = await crmOrigensRepoSupabase.list();
      set({ origens, loading: false });
    } catch (error) {
      console.error('Erro ao carregar origens do CRM:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
    }
  },

  createOrigem: async (data: Omit<CrmOrigem, 'id'>) => {
    set({ loading: true, error: null });
    try {
      const newOrigem = await crmOrigensRepoSupabase.create(data);
      const currentOrigens = get().origens;
      set({ 
        origens: [...currentOrigens, newOrigem],
        loading: false 
      });
      return newOrigem;
    } catch (error) {
      console.error('Erro ao criar origem do CRM:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  updateOrigem: async (id: string, data: Partial<Omit<CrmOrigem, 'id'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedOrigem = await crmOrigensRepoSupabase.update(id, data);
      if (updatedOrigem) {
        const currentOrigens = get().origens;
        const updatedOrigens = currentOrigens.map(origem => 
          origem.id === id ? updatedOrigem : origem
        );
        set({ 
          origens: updatedOrigens,
          loading: false 
        });
      }
      return updatedOrigem;
    } catch (error) {
      console.error('Erro ao atualizar origem do CRM:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  deleteOrigem: async (id: string) => {
    // Check if it's a default origem
    const currentOrigens = get().origens;
    const origemToDelete = currentOrigens.find(o => o.id === id);
    
    if (origemToDelete?.isDefault) {
      const errorMsg = 'Não é possível deletar uma origem padrão';
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }

    set({ loading: true, error: null });
    try {
      await crmOrigensRepoSupabase.remove(id);
      const updatedOrigens = currentOrigens.filter(origem => origem.id !== id);
      set({ 
        origens: updatedOrigens,
        loading: false 
      });
      return true;
    } catch (error) {
      console.error('Erro ao deletar origem do CRM:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  getDefaultOrigem: async () => {
    try {
      return await crmOrigensRepoSupabase.getDefault();
    } catch (error) {
      console.error('Erro ao buscar origem padrão:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));