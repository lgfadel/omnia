import { create } from 'zustand';
import { tarefasRepoSupabase, type Tarefa } from '@/repositories/tarefasRepo.supabase';
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler';
import { logger } from '../lib/logging';


interface TarefasStore {
  tarefas: Tarefa[];
  loading: boolean;
  error: string | null;
  
  loadTarefas: () => Promise<void>;
  getTarefaById: (id: string) => Promise<Tarefa | null>;
  createTarefa: (tarefa: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>) => Promise<Tarefa>;
  updateTarefa: (id: string, tarefa: Partial<Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>>) => Promise<Tarefa | null>;
  deleteTarefa: (id: string) => Promise<boolean>;
  searchTarefas: (query: string) => Promise<Tarefa[]>;
  clearError: () => void;
}

export const useTarefasStore = create<TarefasStore>((set, get) => ({
  tarefas: [],
  loading: false,
  error: null,

  loadTarefas: async () => {
    set({ loading: true, error: null });
    try {
      const tarefas = await tarefasRepoSupabase.list();
      set({ tarefas, loading: false });
    } catch (error) {
      logger.error('Erro ao carregar tarefas:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'tarefa', 'omnia_tarefas')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
    }
  },

  getTarefaById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const tarefa = await tarefasRepoSupabase.get(id);
      set({ loading: false });
      return tarefa;
    } catch (error) {
      logger.error('Erro ao buscar tarefa:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'tarefa', 'omnia_tarefas')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      return null;
    }
  },

  createTarefa: async (tarefaData: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>) => {
    set({ loading: true, error: null });
    try {
      const novaTarefa = await tarefasRepoSupabase.create(tarefaData);
      const currentTarefas = get().tarefas;
      set({ 
        tarefas: [novaTarefa, ...currentTarefas],
        loading: false 
      });
      return novaTarefa;
    } catch (error) {
      logger.error('Erro ao criar tarefa:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'tarefa', 'omnia_tarefas')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  updateTarefa: async (id: string, tarefaData: Partial<Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedTarefa = await tarefasRepoSupabase.update(id, tarefaData);
      if (updatedTarefa) {
        const currentTarefas = get().tarefas;
        const updatedTarefas = currentTarefas.map(tarefa => 
          tarefa.id === id ? updatedTarefa : tarefa
        );
        set({ 
          tarefas: updatedTarefas,
          loading: false 
        });
      }
      return updatedTarefa;
    } catch (error) {
      logger.error('Erro ao atualizar tarefa:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'tarefa', 'omnia_tarefas')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  deleteTarefa: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await tarefasRepoSupabase.remove(id);
      const currentTarefas = get().tarefas;
      const updatedTarefas = currentTarefas.filter(tarefa => tarefa.id !== id);
      set({ 
        tarefas: updatedTarefas,
        loading: false 
      });
      return true;
    } catch (error) {
      logger.error('Erro ao deletar tarefa:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'tarefa', 'omnia_tarefas')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      throw error;
    }
  },

  searchTarefas: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const tarefas = await tarefasRepoSupabase.search(query);
      set({ tarefas, loading: false });
      return tarefas;
    } catch (error) {
      logger.error('Erro ao buscar tarefas:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'tarefa', 'omnia_tarefas')
      );
      set({ 
        error: treatedError.message,
        loading: false 
      });
      return [];
    }
  },

  clearError: () => set({ error: null }),
}));