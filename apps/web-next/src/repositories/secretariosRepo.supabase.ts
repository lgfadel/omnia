import { supabase } from "@/integrations/supabase/client"
import { UserRef, Role } from "@/data/types"
import { logger } from '../lib/logging';


const getCurrentAuthUserId = async () => {
  const { data } = await supabase.auth.getUser()
  const authUserId = data.user?.id

  return authUserId || null
}

// Transform database record to UserRef
function transformUserFromDB(dbUser: any): UserRef {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email || '', // Default to empty string if email not accessible
    roles: (dbUser.roles || []) as Role[],
    avatarUrl: dbUser.avatar_url,
    color: dbUser.color
  }
}

export const secretariosRepoSupabase = {
  async list(): Promise<UserRef[]> {
    logger.debug('SecretariosRepo: Fetching all users...')

    // Check if current user is admin to determine data access level
    const authUserId = await getCurrentAuthUserId()
    let isAdmin = false

    if (authUserId) {
      const { data: currentUserData } = await supabase
        .from('omnia_users')
        .select('roles, auth_user_id')
        .eq('auth_user_id', authUserId)
        .single()

      isAdmin = currentUserData?.roles?.includes('ADMIN') || false
    }

    // Use different select patterns based on user role
    const selectColumns = isAdmin
      ? 'id, name, email, roles, avatar_url, color, created_at, updated_at'
      : 'id, name, roles, avatar_url, color, created_at, updated_at'

    const { data, error } = await supabase
      .from('omnia_users')
      .select(selectColumns)
      .order('name', { ascending: true })

    if (error) {
      logger.error('SecretariosRepo: Error fetching users:', error)
      throw new Error(`Erro ao buscar usuários: ${error.message}`)
    }

    return data?.map(transformUserFromDB) || []
  },

  async getById(id: string): Promise<UserRef | null> {
    logger.debug('SecretariosRepo: Fetching user by ID:', id)

    // Check if current user is admin or requesting their own data
    const authUserId = await getCurrentAuthUserId()
    let isAdmin = false
    let isOwnRecord = false

    if (authUserId) {
      const { data: currentUserData } = await supabase
        .from('omnia_users')
        .select('roles, auth_user_id, id')
        .eq('auth_user_id', authUserId)
        .single()

      isAdmin = currentUserData?.roles?.includes('ADMIN') || false
      isOwnRecord = currentUserData?.id === id
    }

    // Use different select patterns based on access level
    const selectColumns = (isAdmin || isOwnRecord)
      ? 'id, name, email, roles, avatar_url, color, created_at, updated_at'
      : 'id, name, roles, avatar_url, color, created_at, updated_at'

    const { data, error } = await supabase
      .from('omnia_users')
      .select(selectColumns)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // User not found
      }
      logger.error('SecretariosRepo: Error fetching user:', error)
      throw new Error(`Erro ao buscar usuário: ${error.message}`)
    }

    return data ? transformUserFromDB(data) : null
  },

  async create(data: Omit<UserRef, 'id'> & { password?: string }): Promise<UserRef & { tempPassword?: string }> {
    logger.debug('SecretariosRepo: Creating user:', data)

    // Call edge function to create user with auth
    const { data: result, error } = await supabase.functions.invoke('create-user', {
      body: {
        name: data.name,
        email: data.email,
        roles: data.roles,
        avatarUrl: data.avatarUrl,
        color: data.color,
        password: data.password
      }
    })

    if (error) {
      logger.error('SecretariosRepo: Error calling create-user function:', error)
      throw new Error(`Erro ao criar usuário: ${error.message}`)
    }

    if (!result.success) {
      logger.error('SecretariosRepo: Function returned error:', result.error)
      throw new Error(result.error)
    }

    logger.debug('SecretariosRepo: User created successfully with temp password:', result.tempPassword)

    const userResult: UserRef = {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      roles: result.user.roles,
      avatarUrl: result.user.avatarUrl,
      color: result.user.color
    }

    // Add tempPassword to the result if it exists
    return result.tempPassword ? { ...userResult, tempPassword: result.tempPassword } : userResult
  },

  async update(id: string, data: Partial<Omit<UserRef, 'id'>>): Promise<UserRef | null> {
    logger.debug(`SecretariosRepo: Updating user: ${id}`, data)

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.roles !== undefined) updateData.roles = data.roles
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl
    if (data.color !== undefined) updateData.color = data.color

    const { data: updatedUser, error } = await supabase
      .from('omnia_users')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, roles, avatar_url, color, created_at, updated_at')
      .single()

    if (error) {
      logger.error('SecretariosRepo: Error updating user:', error)
      throw new Error(`Erro ao atualizar usuário: ${error.message}`)
    }

    return updatedUser ? transformUserFromDB(updatedUser) : null
  },

  async remove(id: string): Promise<boolean> {
    logger.debug('SecretariosRepo: Deleting user:', id)

    try {
      // Pre-check: verify associations to provide a friendly error before invoking the function
      const [{ data: sec }, { data: resp }] = await Promise.all([
        supabase.from('omnia_atas').select('id').eq('secretary_id', id).limit(1),
        supabase.from('omnia_atas').select('id').eq('responsible_id', id).limit(1)
      ])

      if ((sec && sec.length > 0) || (resp && resp.length > 0)) {
        throw new Error(
          'Não é possível excluir este usuário: ele está vinculado a atas como secretário ou responsável. Reatribua as atas ou remova os vínculos e tente novamente.'
        )
      }

      // Use the delete-user edge function to handle both omnia_users and auth.users deletion
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: id }
      })

      if (error) {
        logger.error('SecretariosRepo: Error calling delete-user function:', error)
        // Try to extract server-provided message
        const errWithContext = error as { context?: Record<string, unknown> }
        const context = errWithContext.context
        const dataWithError = data as Record<string, unknown> | null
        const serverMsg = (context && (context.error || context.message || (context.response as Record<string, unknown> | undefined)?.error)) || dataWithError?.error
        let friendly = typeof serverMsg === 'string' ? serverMsg : ''
        if (serverMsg === 'Cannot delete user with associated records') {
          friendly = 'Não é possível excluir este usuário: ele possui vínculos com registros (atas, comentários, etc.). Remova os vínculos antes de excluir.'
        } else if (serverMsg === 'Missing request body') {
          friendly = 'Falha ao excluir: corpo da requisição ausente.'
        } else if (serverMsg === 'Invalid JSON body') {
          friendly = 'Falha ao excluir: corpo da requisição inválido.'
        } else if (serverMsg === 'User ID is required') {
          friendly = 'ID do usuário é obrigatório.'
        } else if (serverMsg === 'No authorization header' || serverMsg === 'Invalid token') {
          friendly = 'Ação não autorizada: faça login novamente.'
        } else if (serverMsg === 'Unauthorized: Admin access required') {
          friendly = 'Apenas administradores podem excluir usuários.'
        }
        throw new Error(friendly || `Erro ao excluir usuário: ${error.message}`)
      }

      if (!data?.success) {
        const rawError = (data as Record<string, unknown>)?.error
        const errorMessage = typeof rawError === 'string' ? rawError : 'Erro desconhecido ao excluir usuário'
        logger.error('SecretariosRepo: Delete user function returned error:', errorMessage)
        throw new Error(errorMessage)
      }

      logger.debug('SecretariosRepo: User deleted successfully:', data.deletedUser)
      return true

    } catch (error: unknown) {
      logger.error('SecretariosRepo: Error deleting user:', error)
      throw new Error(error instanceof Error ? error.message : 'Erro ao excluir usuário')
    }
  }
}