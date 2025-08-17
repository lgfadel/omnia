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
    
    // Step 1: Create user in auth.users using Admin API
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!' // Generate temporary password
    
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: data.name
      }
    })
    
    if (authError) {
      console.error('SecretariosRepo: Error creating auth user:', authError)
      throw new Error(`Erro ao criar usuário: ${authError.message}`)
    }
    
    // Step 2: Wait a moment for trigger to create omnia_users record
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Step 3: Update the roles in omnia_users (trigger creates with default USUARIO role)
    const { data: updatedUser, error: updateError } = await supabase
      .from('omnia_users')
      .update({
        name: data.name, // Ensure name is set correctly
        roles: data.roles,
        avatar_url: data.avatarUrl
      })
      .eq('auth_user_id', authUser.user.id)
      .select()
      .single()
    
    if (updateError) {
      console.error('SecretariosRepo: Error updating user roles:', updateError)
      throw new Error(`Erro ao configurar papéis do usuário: ${updateError.message}`)
    }
    
    return transformUserFromDB(updatedUser)
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
    
    // Verificar se o usuário tem atas vinculadas
    const { data: atasCount, error: countError } = await supabase
      .from('omnia_atas')
      .select('id')
      .eq('secretary_id', id)
      .limit(1)
    
    if (countError) {
      console.error('SecretariosRepo: Error checking user atas:', countError)
      throw new Error(`Erro ao verificar atas do usuário: ${countError.message}`)
    }
    
    if (atasCount && atasCount.length > 0) {
      throw new Error('Não é possível excluir este usuário pois existem atas vinculadas a ele. Remova ou transfira as atas primeiro.')
    }
    
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