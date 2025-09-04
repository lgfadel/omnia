import { create } from 'zustand'
import { Condominium, condominiumsRepoSupabase } from '@/repositories/condominiumsRepo.supabase'

interface CondominiumStore {
  condominiums: Condominium[]
  loading: boolean
  error: string | null
  
  // Actions
  loadCondominiums: () => Promise<void>
  createCondominium: (data: Omit<Condominium, 'id' | 'created_at' | 'updated_at' | 'syndic' | 'manager'>) => Promise<Condominium>
  updateCondominium: (id: string, data: Partial<Omit<Condominium, 'id' | 'created_at' | 'updated_at' | 'syndic' | 'manager'>>) => Promise<Condominium | null>
  deleteCondominium: (id: string) => Promise<boolean>
  getCondominiumById: (id: string) => Promise<Condominium | null>
  checkCnpjExists: (cnpj: string, excludeId?: string) => Promise<boolean>
  clearError: () => void
}

export const useCondominiumStore = create<CondominiumStore>((set, get) => ({
  condominiums: [],
  loading: false,
  error: null,

  loadCondominiums: async () => {
    console.log('CondominiumStore: Loading condominiums...')
    set({ loading: true, error: null })
    
    try {
      const condominiums = await condominiumsRepoSupabase.list()
      console.log('CondominiumStore: Loaded condominiums:', condominiums)
      set({ condominiums, loading: false })
    } catch (error) {
      console.error('CondominiumStore: Error loading condominiums:', error)
      set({ error: 'Erro ao carregar condomínios', loading: false })
    }
  },

  createCondominium: async (data) => {
    console.log('CondominiumStore: Creating condominium:', data)
    set({ loading: true, error: null })
    
    try {
      const newCondominium = await condominiumsRepoSupabase.create(data)
      const { condominiums } = get()
      const updatedCondominiums = [...condominiums, newCondominium].sort((a, b) => a.name.localeCompare(b.name))
      set({ condominiums: updatedCondominiums, loading: false })
      console.log('CondominiumStore: Created condominium successfully')
      return newCondominium
    } catch (error) {
      console.error('CondominiumStore: Error creating condominium:', error)
      set({ error: 'Erro ao criar condomínio', loading: false })
      throw error
    }
  },

  updateCondominium: async (id: string, data) => {
    console.log('CondominiumStore: Updating condominium:', id, data)
    set({ loading: true, error: null })
    
    try {
      const updatedCondominium = await condominiumsRepoSupabase.update(id, data)
      if (updatedCondominium) {
        const { condominiums } = get()
        const updatedCondominiums = condominiums.map(condominium => 
          condominium.id === id ? updatedCondominium : condominium
        ).sort((a, b) => a.name.localeCompare(b.name))
        set({ condominiums: updatedCondominiums, loading: false })
        console.log('CondominiumStore: Updated condominium successfully')
        return updatedCondominium
      }
      set({ loading: false })
      return null
    } catch (error) {
      console.error('CondominiumStore: Error updating condominium:', error)
      set({ error: 'Erro ao atualizar condomínio', loading: false })
      throw error
    }
  },

  deleteCondominium: async (id: string) => {
    console.log('CondominiumStore: Deleting condominium:', id)
    set({ loading: true, error: null })
    
    try {
      const success = await condominiumsRepoSupabase.remove(id)
      if (success) {
        const { condominiums } = get()
        const updatedCondominiums = condominiums.filter(condominium => condominium.id !== id)
        set({ condominiums: updatedCondominiums, loading: false })
        console.log('CondominiumStore: Deleted condominium successfully')
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      console.error('CondominiumStore: Error deleting condominium:', error)
      set({ error: 'Erro ao excluir condomínio', loading: false })
      throw error
    }
  },

  getCondominiumById: async (id: string) => {
    console.log('CondominiumStore: Getting condominium by id:', id)
    set({ loading: true, error: null })
    
    try {
      const condominium = await condominiumsRepoSupabase.getById(id)
      set({ loading: false })
      console.log('CondominiumStore: Got condominium:', condominium)
      return condominium
    } catch (error) {
      console.error('CondominiumStore: Error getting condominium:', error)
      set({ error: 'Erro ao buscar condomínio', loading: false })
      throw error
    }
  },

  checkCnpjExists: async (cnpj: string, excludeId?: string) => {
    console.log('CondominiumStore: Checking CNPJ exists:', cnpj)
    
    try {
      const exists = await condominiumsRepoSupabase.checkCnpjExists(cnpj, excludeId)
      console.log('CondominiumStore: CNPJ exists:', exists)
      return exists
    } catch (error) {
      console.error('CondominiumStore: Error checking CNPJ:', error)
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))