import { create } from 'zustand'
import { Status } from '@/data/fixtures'

let statusData: Status[] = [
  { id: "nao-iniciado", name: "Não Iniciado", color: "#f59e0b", order: 1, isDefault: true },
  { id: "em-andamento", name: "Em Andamento", color: "#3b82f6", order: 2 },
  { id: "concluido", name: "Concluído", color: "#10b981", order: 3 },
  { id: "cancelado", name: "Cancelado", color: "#ef4444", order: 4 },
  { id: "pendente", name: "Pendente", color: "#8b5cf6", order: 5 }
]

let nextId = 6

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
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300))
      set({ statuses: [...statusData].sort((a, b) => a.order - b.order), loading: false })
    } catch (error) {
      set({ error: 'Erro ao carregar status', loading: false })
    }
  },

  createStatus: async (data) => {
    set({ loading: true, error: null })
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const newStatus: Status = {
        ...data,
        id: `status-${nextId++}`,
        order: data.order || Math.max(...statusData.map(s => s.order), 0) + 1
      }
      
      statusData.push(newStatus)
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
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const index = statusData.findIndex(s => s.id === id)
      if (index === -1) {
        set({ loading: false })
        return null
      }
      
      const updatedStatus = { ...statusData[index], ...data }
      statusData[index] = updatedStatus
      
      const { statuses } = get()
      const updatedStatuses = statuses.map(s => s.id === id ? updatedStatus : s)
      set({ statuses: updatedStatuses.sort((a, b) => a.order - b.order), loading: false })
      return updatedStatus
    } catch (error) {
      set({ error: 'Erro ao atualizar status', loading: false })
      return null
    }
  },

  deleteStatus: async (id: string) => {
    // Não permitir excluir status padrão
    const status = statusData.find(s => s.id === id)
    if (status?.isDefault) {
      set({ error: 'Não é possível excluir um status padrão' })
      return false
    }

    set({ loading: true, error: null })
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const index = statusData.findIndex(s => s.id === id)
      if (index === -1) {
        set({ loading: false })
        return false
      }
      
      statusData.splice(index, 1)
      
      const { statuses } = get()
      set({ statuses: statuses.filter(s => s.id !== id), loading: false })
      return true
    } catch (error) {
      set({ error: 'Erro ao excluir status', loading: false })
      return false
    }
  },

  reorderStatuses: async (newStatuses: Status[]) => {
    set({ loading: true, error: null })
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Atualizar ordem
      const reorderedStatuses = newStatuses.map((status, index) => ({
        ...status,
        order: index + 1
      }))
      
      // Atualizar dados locais
      statusData = reorderedStatuses
      
      set({ statuses: reorderedStatuses, loading: false })
    } catch (error) {
      set({ error: 'Erro ao reordenar status', loading: false })
    }
  }
}))