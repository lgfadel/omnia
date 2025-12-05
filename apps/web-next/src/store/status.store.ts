
import { create } from 'zustand'
import { Status } from '@/data/types'
import { statusRepoSupabase } from '@/repositories/statusRepo.supabase'
import { logger } from '../lib/logging';


interface StatusStore {
  statuses: Status[]
  loading: boolean
  error: string | null
  
  // Actions
  loadStatuses: () => Promise<void>
  createStatus: (data: Omit<Status, 'id'>) => Promise<Status>
  updateStatus: (id: string, data: Partial<Omit<Status, 'id'>>) => Promise<Status | null>
  deleteStatus: (id: string) => Promise<boolean>
  reorderStatuses: (statuses: Status[]) => Promise<void>
  clearError: () => void
}

export const useStatusStore = create<StatusStore>((set, get) => ({
  statuses: [],
  loading: false,
  error: null,

  loadStatuses: async () => {
    logger.debug('StatusStore: Loading statuses...')
    set({ loading: true, error: null })
    
    try {
      const statuses = await statusRepoSupabase.list()
      logger.debug('StatusStore: Loaded statuses:', statuses)
      set({ statuses, loading: false })
    } catch (error) {
      logger.error('StatusStore: Error loading statuses:', error)
      set({ error: 'Erro ao carregar status', loading: false })
    }
  },

  createStatus: async (data) => {
    logger.debug('StatusStore: Creating status:', data)
    set({ loading: true, error: null })
    
    try {
      const newStatus = await statusRepoSupabase.create(data)
      const { statuses } = get()
      const updatedStatuses = [...statuses, newStatus].sort((a, b) => a.order - b.order)
      set({ statuses: updatedStatuses, loading: false })
      logger.debug('StatusStore: Created status successfully')
      return newStatus
    } catch (error) {
      logger.error('StatusStore: Error creating status:', error)
      set({ error: 'Erro ao criar status', loading: false })
      throw error
    }
  },

  updateStatus: async (id: string, data) => {
    logger.debug(`StatusStore: Updating status: ${id}`, data)
    set({ loading: true, error: null })
    
    try {
      const updatedStatus = await statusRepoSupabase.update(id, data)
      if (updatedStatus) {
        const { statuses } = get()
        const updatedStatuses = statuses
          .map(s => s.id === id ? updatedStatus : s)
          .sort((a, b) => a.order - b.order)
        set({ statuses: updatedStatuses, loading: false })
        logger.debug('StatusStore: Updated status successfully')
      }
      return updatedStatus
    } catch (error) {
      logger.error('StatusStore: Error updating status:', error)
      set({ error: 'Erro ao atualizar status', loading: false })
      return null
    }
  },

  deleteStatus: async (id: string) => {
    logger.debug('StatusStore: Deleting status:', id)
    
    // Check if status is default
    const { statuses } = get()
    const status = statuses.find(s => s.id === id)
    if (status?.isDefault) {
      set({ error: 'Não é possível excluir um status padrão' })
      return false
    }

    set({ loading: true, error: null })
    try {
      const success = await statusRepoSupabase.remove(id)
      if (success) {
        set({ statuses: statuses.filter(s => s.id !== id), loading: false })
        logger.debug('StatusStore: Deleted status successfully')
      }
      return success
    } catch (error) {
      logger.error('StatusStore: Error deleting status:', error)
      set({ error: 'Erro ao excluir status', loading: false })
      return false
    }
  },

  reorderStatuses: async (newStatuses: Status[]) => {
    logger.debug('StatusStore: Reordering statuses:', newStatuses)
    set({ loading: true, error: null })
    
    try {
      const reorderedStatuses = newStatuses.map((status, index) => ({
        ...status,
        order: index + 1
      }))
      
      await statusRepoSupabase.reorder(reorderedStatuses)
      set({ statuses: reorderedStatuses, loading: false })
      logger.debug('StatusStore: Reordered statuses successfully')
    } catch (error) {
      logger.error('StatusStore: Error reordering statuses:', error)
      set({ error: 'Erro ao reordenar status', loading: false })
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
