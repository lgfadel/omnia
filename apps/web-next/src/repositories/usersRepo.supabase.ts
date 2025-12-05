import { supabase } from '@/integrations/supabase/client'

export interface User {
  id: string
  auth_user_id: string | null
  name: string
  email: string
  avatar_url?: string
  roles: string[]
  color?: string
  created_at: string
  updated_at: string
}

export interface CreateUser {
  auth_user_id: string
  name: string
  email: string
  avatar_url?: string
  roles?: string[]
  color?: string
}

const mapDbUser = (user: any): User => ({
  id: user.id,
  auth_user_id: user.auth_user_id ?? null,
  name: user.name,
  email: user.email ?? '',
  avatar_url: user.avatar_url ?? undefined,
  roles: user.roles ?? [],
  color: user.color ?? undefined,
  created_at: user.created_at,
  updated_at: user.updated_at,
})

export const usersRepoSupabase = {
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapDbUser)
  },

  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data ? mapDbUser(data) : null
  },

  async getByAuthUserId(authUserId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return mapDbUser(data)
  },

  async getActiveUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapDbUser)
  },

  async searchByName(search: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .ilike('name', `%${search}%`)
      .order('name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapDbUser)
  },

  async create(user: CreateUser): Promise<User> {
    const { data, error } = await supabase
      .from('omnia_users')
      .insert({
        ...user,
        roles: user.roles || ['USUARIO']
      })
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Erro ao criar usuário')
    return mapDbUser(data)
  },

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const { data, error } = await supabase
      .from('omnia_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data ? mapDbUser(data) : null
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_users')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  }
}