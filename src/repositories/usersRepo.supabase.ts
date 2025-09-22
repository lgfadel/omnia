import { supabase } from '@/integrations/supabase/client'

export interface User {
  id: string
  auth_user_id: string
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

export const usersRepoSupabase = {
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
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
    return data
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
    return data
  },

  async getActiveUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  },

  async searchByName(search: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .ilike('name', `%${search}%`)
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
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
    return data
  },

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const { data, error } = await supabase
      .from('omnia_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
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