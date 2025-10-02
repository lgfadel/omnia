import { create } from 'zustand'
import { UserRef } from '@/data/types'
import { secretariosRepoSupabase } from '@/repositories/secretariosRepo.supabase'
import { logger } from '../lib/logging';


interface SecretariosStore {
  secretarios: UserRef[]
  loading: boolean
  error: string | null
  
  // Actions
  loadSecretarios: () => Promise<void>
  createSecretario: (data: Omit<UserRef, 'id'> & { password?: string }) => Promise<{ user: UserRef; tempPassword?: string }>
  updateSecretario: (id: string, data: Partial<Omit<UserRef, 'id'>>) => Promise<UserRef | null>
  deleteSecretario: (id: string) => Promise<boolean>
  clearError: () => void
}

export const useSecretariosStore = create<SecretariosStore>((set, get) => ({
  secretarios: [],
  loading: false,
  error: null,

  loadSecretarios: async () => {
    logger.debug('SecretariosStore: Loading secretarios...')
    set({ loading: true, error: null })
    
    try {
      const secretarios = await secretariosRepoSupabase.list()
      logger.debug('SecretariosStore: Loaded secretarios:', secretarios)
      set({ secretarios, loading: false })
    } catch (error) {
      logger.error('SecretariosStore: Error loading secretarios:', error)
      set({ error: 'Erro ao carregar usuários', loading: false })
    }
  },

  createSecretario: async (data) => {
    logger.debug('SecretariosStore: Creating secretario:', data)
    set({ loading: true, error: null })
    
    try {
      const result = await secretariosRepoSupabase.create(data)
      const { secretarios } = get()
      
      // Extract tempPassword from result if it exists
      const { tempPassword, ...newSecretario } = result
      
      set({ secretarios: [...secretarios, newSecretario], loading: false })
      logger.debug('SecretariosStore: Created secretario successfully')
      
      // Return both the user and tempPassword if it exists
      return tempPassword ? { user: newSecretario, tempPassword } : { user: newSecretario }
    } catch (error) {
      logger.error('SecretariosStore: Error creating secretario:', error)
      set({ error: 'Erro ao criar usuário', loading: false })
      throw error
    }
  },

  updateSecretario: async (id: string, data) => {
    logger.debug('SecretariosStore: Updating secretario:', id, data)
    set({ loading: true, error: null })
    
    try {
      const updatedSecretario = await secretariosRepoSupabase.update(id, data)
      if (updatedSecretario) {
        const { secretarios } = get()
        const updatedSecretarios = secretarios.map(s => s.id === id ? updatedSecretario : s)
        set({ secretarios: updatedSecretarios, loading: false })
        logger.debug('SecretariosStore: Updated secretario successfully')
      }
      return updatedSecretario
    } catch (error) {
      logger.error('SecretariosStore: Error updating secretario:', error)
      set({ error: 'Erro ao atualizar usuário', loading: false })
      return null
    }
  },

  deleteSecretario: async (id: string) => {
    logger.debug('SecretariosStore: Deleting secretario:', id)
    set({ loading: true, error: null })
    
    try {
      const success = await secretariosRepoSupabase.remove(id)
      if (success) {
        const { secretarios } = get()
        set({ secretarios: secretarios.filter(s => s.id !== id), loading: false })
        logger.debug('SecretariosStore: Deleted secretario successfully')
      }
      return success
    } catch (error) {
      logger.error('SecretariosStore: Error deleting secretario:', error)
      const message = error instanceof Error ? error.message : 'Erro ao excluir usuário'
      set({ error: message, loading: false })
      return false
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))