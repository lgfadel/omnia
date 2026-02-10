import { create } from 'zustand'
import { Administradora, administradorasRepoSupabase } from '@/repositories/administradorasRepo.supabase'
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler'
import { logger } from '../lib/logging';


interface AdministradorasStore {
  administradoras: Administradora[]
  loading: boolean
  error: string | null
  
  // Actions
  loadAdministradoras: () => Promise<void>
  createAdministradora: (data: Omit<Administradora, 'id' | 'created_at' | 'updated_at'>) => Promise<Administradora>
  updateAdministradora: (id: string, data: Partial<Omit<Administradora, 'id' | 'created_at' | 'updated_at'>>) => Promise<Administradora | null>
  deleteAdministradora: (id: string) => Promise<boolean>
  clearError: () => void
}

export const useAdministradorasStore = create<AdministradorasStore>((set, get) => ({
  administradoras: [],
  loading: false,
  error: null,

  loadAdministradoras: async () => {
    logger.debug('AdministradorasStore: Loading administradoras...')
    set({ loading: true, error: null })
    
    try {
      const administradoras = await administradorasRepoSupabase.list()
      logger.debug('AdministradorasStore: Loaded administradoras:', administradoras)
      set({ administradoras, loading: false })
    } catch (error) {
      logger.error('AdministradorasStore: Error loading administradoras:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'administradoras', 'omnia_administradoras')
      )
      set({ error: treatedError.message, loading: false })
    }
  },

  createAdministradora: async (data) => {
    logger.debug('AdministradorasStore: Creating administradora:', data)
    set({ loading: true, error: null })
    
    try {
      const newAdministradora = await administradorasRepoSupabase.create(data)
      const { administradoras } = get()
      const updatedAdministradoras = [...administradoras, newAdministradora].sort((a, b) => a.nome.localeCompare(b.nome))
      set({ administradoras: updatedAdministradoras, loading: false })
      logger.debug('AdministradorasStore: Created administradora successfully')
      return newAdministradora
    } catch (error) {
      logger.error('AdministradorasStore: Error creating administradora:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'administradora', 'omnia_administradoras')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  updateAdministradora: async (id: string, data) => {
    logger.debug(`AdministradorasStore: Updating administradora: ${id}`, data)
    set({ loading: true, error: null })
    
    try {
      const updatedAdministradora = await administradorasRepoSupabase.update(id, data)
      if (updatedAdministradora) {
        const { administradoras } = get()
        const updatedAdministradoras = administradoras.map(admin => 
          admin.id === id ? updatedAdministradora : admin
        ).sort((a, b) => a.nome.localeCompare(b.nome))
        set({ administradoras: updatedAdministradoras, loading: false })
        logger.debug('AdministradorasStore: Updated administradora successfully')
      }
      return updatedAdministradora
    } catch (error) {
      logger.error('AdministradorasStore: Error updating administradora:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'administradora', 'omnia_administradoras')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  deleteAdministradora: async (id: string) => {
    logger.debug('AdministradorasStore: Deleting administradora:', id)
    set({ loading: true, error: null })
    
    try {
      const success = await administradorasRepoSupabase.remove(id)
      if (success) {
        const { administradoras } = get()
        const updatedAdministradoras = administradoras.filter(admin => admin.id !== id)
        set({ administradoras: updatedAdministradoras, loading: false })
        logger.debug('AdministradorasStore: Deleted administradora successfully')
      }
      return success
    } catch (error) {
      logger.error('AdministradorasStore: Error deleting administradora:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'administradora', 'omnia_administradoras')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))