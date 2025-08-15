import { supabase } from "@/integrations/supabase/client"
import { UserRef, Role } from "@/data/fixtures"

// Transform database record to UserRef
function transformUserFromDB(dbUser: any): UserRef {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    roles: (dbUser.roles || []) as Role[],
    avatarUrl: dbUser.avatar_url
  }
}

export const secretariosRepoSupabase = {
  async list(): Promise<UserRef[]> {
    console.log('SecretariosRepo: Fetching all users...')
    
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) {
      console.error('SecretariosRepo: Error fetching users:', error)
      throw new Error(`Erro ao buscar usuários: ${error.message}`)
    }
    
    return data?.map(transformUserFromDB) || []
  },

  async getById(id: string): Promise<UserRef | null> {
    console.log('SecretariosRepo: Fetching user by ID:', id)
    
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null // User not found
      }
      console.error('SecretariosRepo: Error fetching user:', error)
      throw new Error(`Erro ao buscar usuário: ${error.message}`)
    }
    
    return data ? transformUserFromDB(data) : null
  },

  async create(data: Omit<UserRef, 'id'>): Promise<UserRef> {
    console.log('SecretariosRepo: Creating user:', data)
    
    const { data: newUser, error } = await supabase
      .from('omnia_users')
      .insert({
        name: data.name,
        email: data.email,
        roles: data.roles,
        avatar_url: data.avatarUrl
      })
      .select()
      .single()
    
    if (error) {
      console.error('SecretariosRepo: Error creating user:', error)
      throw new Error(`Erro ao criar usuário: ${error.message}`)
    }
    
    return transformUserFromDB(newUser)
  },

  async update(id: string, data: Partial<Omit<UserRef, 'id'>>): Promise<UserRef | null> {
    console.log('SecretariosRepo: Updating user:', id, data)
    
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.roles !== undefined) updateData.roles = data.roles
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl
    
    const { data: updatedUser, error } = await supabase
      .from('omnia_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('SecretariosRepo: Error updating user:', error)
      throw new Error(`Erro ao atualizar usuário: ${error.message}`)
    }
    
    return updatedUser ? transformUserFromDB(updatedUser) : null
  },

  async remove(id: string): Promise<boolean> {
    console.log('SecretariosRepo: Deleting user:', id)
    
    const { error } = await supabase
      .from('omnia_users')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('SecretariosRepo: Error deleting user:', error)
      throw new Error(`Erro ao excluir usuário: ${error.message}`)
    }
    
    return true
  }
}