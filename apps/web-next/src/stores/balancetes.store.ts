import { create } from 'zustand'
import { Balancete, CreateBalanceteData, UpdateBalanceteData, balancetesRepoSupabase } from '@/repositories/balancetesRepo.supabase'
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler'
import { logger } from '../lib/logging';

interface BalancetesStore {
  balancetes: Balancete[]
  loading: boolean
  error: string | null

  loadBalancetes: () => Promise<void>
  createBalancete: (data: CreateBalanceteData) => Promise<Balancete>
  updateBalancete: (id: string, data: UpdateBalanceteData) => Promise<Balancete | null>
  deleteBalancete: (id: string) => Promise<boolean>
  clearError: () => void
}

export const useBalancetesStore = create<BalancetesStore>((set, get) => ({
  balancetes: [],
  loading: false,
  error: null,

  loadBalancetes: async () => {
    logger.debug('BalancetesStore: Loading balancetes...')
    set({ loading: true, error: null })

    try {
      const balancetes = await balancetesRepoSupabase.list()
      logger.debug('BalancetesStore: Loaded balancetes:', balancetes)
      set({ balancetes, loading: false })
    } catch (error) {
      logger.error('BalancetesStore: Error loading balancetes:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'balancetes', 'omnia_balancetes')
      )
      set({ error: treatedError.message, loading: false })
    }
  },

  createBalancete: async (data) => {
    logger.debug('BalancetesStore: Creating balancete:', data)
    set({ loading: true, error: null })

    try {
      const newBalancete = await balancetesRepoSupabase.create(data)
      const { balancetes } = get()
      set({ balancetes: [newBalancete, ...balancetes], loading: false })
      logger.debug('BalancetesStore: Created balancete successfully')
      return newBalancete
    } catch (error) {
      logger.error('BalancetesStore: Error creating balancete:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'balancete', 'omnia_balancetes')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  updateBalancete: async (id: string, data) => {
    logger.debug(`BalancetesStore: Updating balancete: ${id}`, data)
    set({ loading: true, error: null })

    try {
      const updatedBalancete = await balancetesRepoSupabase.update(id, data)
      if (updatedBalancete) {
        const { balancetes } = get()
        const updatedList = balancetes.map(b =>
          b.id === id ? updatedBalancete : b
        )
        set({ balancetes: updatedList, loading: false })
        logger.debug('BalancetesStore: Updated balancete successfully')
        return updatedBalancete
      }
      set({ loading: false })
      return null
    } catch (error) {
      logger.error('BalancetesStore: Error updating balancete:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'balancete', 'omnia_balancetes')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  deleteBalancete: async (id: string) => {
    logger.debug('BalancetesStore: Deleting balancete:', id)
    set({ loading: true, error: null })

    try {
      const success = await balancetesRepoSupabase.remove(id)
      if (success) {
        const { balancetes } = get()
        set({ balancetes: balancetes.filter(b => b.id !== id), loading: false })
        logger.debug('BalancetesStore: Deleted balancete successfully')
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      logger.error('BalancetesStore: Error deleting balancete:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'balancete', 'omnia_balancetes')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
