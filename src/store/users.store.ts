import { create } from 'zustand'
import { usersRepoSupabase, User } from '@/repositories/usersRepo.supabase'

interface UsersState {
  users: User[]
  loading: boolean
  error: string | null
  loadUsers: () => Promise<void>
  getUserById: (id: string) => User | undefined
  searchUsers: (search: string) => Promise<User[]>
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  loadUsers: async () => {
    set({ loading: true, error: null })
    try {
      const users = await usersRepoSupabase.getAll()
      set({ users, loading: false })
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      })
    }
  },

  getUserById: (id: string) => {
    const { users } = get()
    return users.find(user => user.id === id)
  },

  searchUsers: async (search: string) => {
    try {
      return await usersRepoSupabase.searchByName(search)
    } catch (error) {
      console.error('Erro ao buscar usuários:', error)
      return []
    }
  }
}))