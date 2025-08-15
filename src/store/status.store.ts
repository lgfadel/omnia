
import { create } from 'zustand'
import { Status } from '@/data/fixtures'
import { statusRepoSupabase } from '@/repositories/statusRepo.supabase'

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
    console.log('StatusStore: Loading statuses...')
    set({ loading: true, error: null })
    
    try {
      const statuses = await statusRepoSupabase.list()
      console.log('StatusStore: Loaded statuses:', statuses)
      set({ statuses, loading: false })
    } catch (error) {
      console.error('StatusStore: Error loading statuses:', error)
      set({ error: 'Erro ao carregar status', loading: false })
    }
  },

  createStatus: async (data) => {
    console.log('StatusStore: Creating status:', data)
    set({ loading: true, error: null })
    
    try {
      const newStatus = await statusRepoSupabase.create(data)
      const { statuses } = get()
      const updatedStatuses = [...statuses, newStatus].sort((a, b) => a.order - b.order)
      set({ statuses: updatedStatuses, loading: false })
      console.log('StatusStore: Created status successfully')
      return newStatus
    } catch (error) {
      console.error('StatusStore: Error creating status:', error)
      set({ error: 'Erro ao criar status', loading: false })
      throw error
    }
  },

  updateStatus: async (id: string, data) => {
    console.log('StatusStore: Updating status:', id, data)
    set({ loading: true, error: null })
    
    try {
      const updatedStatus = await statusRepoSupabase.update(id, data)
      if (updatedStatus) {
        const { statuses } = get()
        const updatedStatuses = statuses
          .map(s => s.id === id ? updatedStatus : s)
          .sort((a, b) => a.order - b.order)
        set({ statuses: updatedStatuses, loading: false })
        console.log('StatusStore: Updated status successfully')
      }
      return updatedStatus
    } catch (error) {
      console.error('StatusStore: Error updating status:', error)
      set({ error: 'Erro ao atualizar status', loading: false })
      return null
    }
  },

  deleteStatus: async (id: string) => {
    console.log('StatusStore: Deleting status:', id)
    
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
        console.log('StatusStore: Deleted status successfully')
      }
      return success
    } catch (error) {
      console.error('StatusStore: Error deleting status:', error)
      set({ error: 'Erro ao excluir status', loading: false })
      return false
    }
  },

  reorderStatuses: async (newStatuses: Status[]) => {
    console.log('StatusStore: Reordering statuses:', newStatuses)
    set({ loading: true, error: null })
    
    try {
      const reorderedStatuses = newStatuses.map((status, index) => ({
        ...status,
        order: index + 1
      }))
      
      await statusRepoSupabase.reorder(reorderedStatuses)
      set({ statuses: reorderedStatuses, loading: false })
      console.log('StatusStore: Reordered statuses successfully')
    } catch (error) {
      console.error('StatusStore: Error reordering statuses:', error)
      set({ error: 'Erro ao reordenar status', loading: false })
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
