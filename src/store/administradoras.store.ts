import { create } from 'zustand'
import { Administradora, administradorasRepoSupabase } from '@/repositories/administradorasRepo.supabase'
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler'

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
    console.log('AdministradorasStore: Loading administradoras...')
    set({ loading: true, error: null })
    
    try {
      const administradoras = await administradorasRepoSupabase.list()
      console.log('AdministradorasStore: Loaded administradoras:', administradoras)
      set({ administradoras, loading: false })
    } catch (error) {
      console.error('AdministradorasStore: Error loading administradoras:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'administradoras', 'omnia_administradoras')
      )
      set({ error: treatedError.message, loading: false })
    }
  },

  createAdministradora: async (data) => {
    console.log('AdministradorasStore: Creating administradora:', data)
    set({ loading: true, error: null })
    
    try {
      const newAdministradora = await administradorasRepoSupabase.create(data)
      const { administradoras } = get()
      const updatedAdministradoras = [...administradoras, newAdministradora].sort((a, b) => a.nome.localeCompare(b.nome))
      set({ administradoras: updatedAdministradoras, loading: false })
      console.log('AdministradorasStore: Created administradora successfully')
      return newAdministradora
    } catch (error) {
      console.error('AdministradorasStore: Error creating administradora:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'administradora', 'omnia_administradoras')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  updateAdministradora: async (id: string, data) => {
    console.log('AdministradorasStore: Updating administradora:', id, data)
    set({ loading: true, error: null })
    
    try {
      const updatedAdministradora = await administradorasRepoSupabase.update(id, data)
      if (updatedAdministradora) {
        const { administradoras } = get()
        const updatedAdministradoras = administradoras.map(admin => 
          admin.id === id ? updatedAdministradora : admin
        ).sort((a, b) => a.nome.localeCompare(b.nome))
        set({ administradoras: updatedAdministradoras, loading: false })
        console.log('AdministradorasStore: Updated administradora successfully')
      }
      return updatedAdministradora
    } catch (error) {
      console.error('AdministradorasStore: Error updating administradora:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'administradora', 'omnia_administradoras')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  deleteAdministradora: async (id: string) => {
    console.log('AdministradorasStore: Deleting administradora:', id)
    set({ loading: true, error: null })
    
    try {
      const success = await administradorasRepoSupabase.remove(id)
      if (success) {
        const { administradoras } = get()
        const updatedAdministradoras = administradoras.filter(admin => admin.id !== id)
        set({ administradoras: updatedAdministradoras, loading: false })
        console.log('AdministradorasStore: Deleted administradora successfully')
      }
      return success
    } catch (error) {
      console.error('AdministradorasStore: Error deleting administradora:', error)
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