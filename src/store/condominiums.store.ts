import { create } from 'zustand'
import { Condominium, condominiumsRepoSupabase } from '@/repositories/condominiumsRepo.supabase'
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler'
import { logger } from '../lib/logging';


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
    logger.debug('CondominiumStore: Loading condominiums...')
    set({ loading: true, error: null })
    
    try {
      const condominiums = await condominiumsRepoSupabase.list()
      logger.debug('CondominiumStore: Loaded condominiums:', condominiums)
      set({ condominiums, loading: false })
    } catch (error) {
      logger.error('CondominiumStore: Error loading condominiums:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'condomínios', 'omnia_condominiums')
      )
      set({ error: treatedError.message, loading: false })
    }
  },

  createCondominium: async (data) => {
    logger.debug('CondominiumStore: Creating condominium:', data)
    set({ loading: true, error: null })
    
    try {
      const newCondominium = await condominiumsRepoSupabase.create(data)
      const { condominiums } = get()
      const updatedCondominiums = [...condominiums, newCondominium].sort((a, b) => a.name.localeCompare(b.name))
      set({ condominiums: updatedCondominiums, loading: false })
      logger.debug('CondominiumStore: Created condominium successfully')
      return newCondominium
    } catch (error) {
      logger.error('CondominiumStore: Error creating condominium:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'condomínio', 'omnia_condominiums')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  updateCondominium: async (id: string, data) => {
    logger.debug(`CondominiumStore: Updating condominium: ${id}`, data)
    set({ loading: true, error: null })
    
    try {
      const updatedCondominium = await condominiumsRepoSupabase.update(id, data)
      if (updatedCondominium) {
        const { condominiums } = get()
        const updatedCondominiums = condominiums.map(condominium => 
          condominium.id === id ? updatedCondominium : condominium
        ).sort((a, b) => a.name.localeCompare(b.name))
        set({ condominiums: updatedCondominiums, loading: false })
        logger.debug('CondominiumStore: Updated condominium successfully')
        return updatedCondominium
      }
      set({ loading: false })
      return null
    } catch (error) {
      logger.error('CondominiumStore: Error updating condominium:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'condomínio', 'omnia_condominiums')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  deleteCondominium: async (id: string) => {
    logger.debug('CondominiumStore: Deleting condominium:', id)
    set({ loading: true, error: null })
    
    try {
      const success = await condominiumsRepoSupabase.remove(id)
      if (success) {
        const { condominiums } = get()
        const updatedCondominiums = condominiums.filter(condominium => condominium.id !== id)
        set({ condominiums: updatedCondominiums, loading: false })
        logger.debug('CondominiumStore: Deleted condominium successfully')
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      logger.error('CondominiumStore: Error deleting condominium:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'condomínio', 'omnia_condominiums')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  getCondominiumById: async (id: string) => {
    logger.debug('CondominiumStore: Getting condominium by id:', id)
    set({ loading: true, error: null })
    
    try {
      const condominium = await condominiumsRepoSupabase.getById(id)
      set({ loading: false })
      logger.debug('CondominiumStore: Got condominium:', condominium)
      return condominium
    } catch (error) {
      logger.error('CondominiumStore: Error getting condominium:', error)
      set({ error: 'Erro ao buscar condomínio', loading: false })
      throw error
    }
  },

  checkCnpjExists: async (cnpj: string, excludeId?: string) => {
    logger.debug('CondominiumStore: Checking CNPJ exists:', cnpj)
    
    try {
      const exists = await condominiumsRepoSupabase.checkCnpjExists(cnpj, excludeId)
      logger.debug('CondominiumStore: CNPJ exists:', exists)
      return exists
    } catch (error) {
      logger.error('CondominiumStore: Error checking CNPJ:', error)
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))