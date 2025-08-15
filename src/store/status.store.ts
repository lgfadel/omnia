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
}

export const useStatusStore = create<StatusStore>((set, get) => ({
  statuses: [],
  loading: false,
  error: null,

  loadStatuses: async () => {
    set({ loading: true, error: null })
    try {
      const statuses = await statusRepoSupabase.list()
      set({ statuses, loading: false })
    } catch (error) {
      set({ error: 'Erro ao carregar status', loading: false })
    }
  },

  createStatus: async (data) => {
    set({ loading: true, error: null })
    try {
      const newStatus = await statusRepoSupabase.create(data)
      const { statuses } = get()
      set({ statuses: [...statuses, newStatus].sort((a, b) => a.order - b.order), loading: false })
      return newStatus
    } catch (error) {
      set({ error: 'Erro ao criar status', loading: false })
      throw error
    }
  },

  updateStatus: async (id: string, data) => {
    set({ loading: true, error: null })
    try {
      const updatedStatus = await statusRepoSupabase.update(id, data)
      if (updatedStatus) {
        const { statuses } = get()
        const updatedStatuses = statuses.map(s => s.id === id ? updatedStatus : s)
        set({ statuses: updatedStatuses.sort((a, b) => a.order - b.order), loading: false })
      }
      return updatedStatus
    } catch (error) {
      set({ error: 'Erro ao atualizar status', loading: false })
      return null
    }
  },

  deleteStatus: async (id: string) => {
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
      }
      return success
    } catch (error) {
      set({ error: 'Erro ao excluir status', loading: false })
      return false
    }
  },

  reorderStatuses: async (newStatuses: Status[]) => {
    set({ loading: true, error: null })
    try {
      const reorderedStatuses = newStatuses.map((status, index) => ({
        ...status,
        order: index + 1
      }))
      
      await statusRepoSupabase.reorder(reorderedStatuses)
      set({ statuses: reorderedStatuses, loading: false })
    } catch (error) {
      set({ error: 'Erro ao reordenar status', loading: false })
    }
  }
}))