import { create } from 'zustand'
import { UserRef } from '@/data/fixtures'
import { secretariosRepoSupabase } from '@/repositories/secretariosRepo.supabase'

interface SecretariosStore {
  secretarios: UserRef[]
  loading: boolean
  error: string | null
  
  // Actions
  loadSecretarios: () => Promise<void>
  createSecretario: (data: Omit<UserRef, 'id'>) => Promise<UserRef>
  updateSecretario: (id: string, data: Partial<Omit<UserRef, 'id'>>) => Promise<UserRef | null>
  deleteSecretario: (id: string) => Promise<boolean>
  clearError: () => void
}

export const useSecretariosStore = create<SecretariosStore>((set, get) => ({
  secretarios: [],
  loading: false,
  error: null,

  loadSecretarios: async () => {
    console.log('SecretariosStore: Loading secretarios...')
    set({ loading: true, error: null })
    
    try {
      const secretarios = await secretariosRepoSupabase.list()
      console.log('SecretariosStore: Loaded secretarios:', secretarios)
      set({ secretarios, loading: false })
    } catch (error) {
      console.error('SecretariosStore: Error loading secretarios:', error)
      set({ error: 'Erro ao carregar usuários', loading: false })
    }
  },

  createSecretario: async (data) => {
    console.log('SecretariosStore: Creating secretario:', data)
    set({ loading: true, error: null })
    
    try {
      const newSecretario = await secretariosRepoSupabase.create(data)
      const { secretarios } = get()
      set({ secretarios: [...secretarios, newSecretario], loading: false })
      console.log('SecretariosStore: Created secretario successfully')
      return newSecretario
    } catch (error) {
      console.error('SecretariosStore: Error creating secretario:', error)
      set({ error: 'Erro ao criar usuário', loading: false })
      throw error
    }
  },

  updateSecretario: async (id: string, data) => {
    console.log('SecretariosStore: Updating secretario:', id, data)
    set({ loading: true, error: null })
    
    try {
      const updatedSecretario = await secretariosRepoSupabase.update(id, data)
      if (updatedSecretario) {
        const { secretarios } = get()
        const updatedSecretarios = secretarios.map(s => s.id === id ? updatedSecretario : s)
        set({ secretarios: updatedSecretarios, loading: false })
        console.log('SecretariosStore: Updated secretario successfully')
      }
      return updatedSecretario
    } catch (error) {
      console.error('SecretariosStore: Error updating secretario:', error)
      set({ error: 'Erro ao atualizar usuário', loading: false })
      return null
    }
  },

  deleteSecretario: async (id: string) => {
    console.log('SecretariosStore: Deleting secretario:', id)
    set({ loading: true, error: null })
    
    try {
      const success = await secretariosRepoSupabase.remove(id)
      if (success) {
        const { secretarios } = get()
        set({ secretarios: secretarios.filter(s => s.id !== id), loading: false })
        console.log('SecretariosStore: Deleted secretario successfully')
      }
      return success
    } catch (error) {
      console.error('SecretariosStore: Error deleting secretario:', error)
      const message = error instanceof Error ? error.message : 'Erro ao excluir usuário'
      set({ error: message, loading: false })
      return false
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))