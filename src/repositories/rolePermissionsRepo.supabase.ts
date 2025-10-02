import { supabase } from "@/integrations/supabase/client"
import { logger } from '../lib/logging';


export interface RolePermission {
  id: string
  role_name: string
  menu_item_id: string
  can_access: boolean
  created_at: string
  updated_at: string
  // Relations
  menu_item?: {
    id: string
    name: string
    path: string
    icon?: string
  }
}

export interface CreateRolePermissionData {
  role_name: string
  menu_item_id: string
  can_access: boolean
}

export interface UpdateRolePermissionData {
  can_access?: boolean
}

export type RoleName = 'ADMIN' | 'SECRETARIO' | 'USUARIO'

// Transform database record to RolePermission type
const transformRolePermissionFromDB = (dbRolePermission: any): RolePermission => ({
  id: dbRolePermission.id,
  role_name: dbRolePermission.role_name,
  menu_item_id: dbRolePermission.menu_item_id,
  can_access: dbRolePermission.can_access,
  created_at: dbRolePermission.created_at,
  updated_at: dbRolePermission.updated_at,
  menu_item: dbRolePermission.menu_items ? {
    id: dbRolePermission.menu_items.id,
    name: dbRolePermission.menu_items.name,
    path: dbRolePermission.menu_items.path,
    icon: dbRolePermission.menu_items.icon
  } : undefined
})

export const rolePermissionsRepoSupabase = {
  async list(): Promise<RolePermission[]> {
    logger.debug('Loading role permissions from database...')
    
    const { data, error } = await supabase
      .from('omnia_role_permissions')
      .select(`
        *,
        menu_items!inner(
          id,
          name,
          path,
          icon
        )
      `)
      .order('role_name')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error loading role permissions:', error)
      throw error
    }

    logger.debug('Loaded role permissions:', data)
    return data?.map(transformRolePermissionFromDB) || []
  },

  async getByRole(roleName: RoleName): Promise<RolePermission[]> {
    logger.debug('Loading role permissions by role:', roleName)
    
    const { data, error } = await supabase
      .from('omnia_role_permissions')
      .select(`
        *,
        menu_items!inner(
          id,
          name,
          path,
          icon
        )
      `)
      .eq('role_name', roleName)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error loading role permissions by role:', error)
      throw error
    }

    return data?.map(transformRolePermissionFromDB) || []
  },

  async getByMenuItemId(menuItemId: string): Promise<RolePermission[]> {
    logger.debug('Loading role permissions by menu item id:', menuItemId)
    
    const { data, error } = await supabase
      .from('omnia_role_permissions')
      .select(`
        *,
        menu_items!inner(
          id,
          name,
          path,
          icon
        )
      `)
      .eq('menu_item_id', menuItemId)
      .order('role_name')

    if (error) {
      logger.error('Error loading role permissions by menu item id:', error)
      throw error
    }

    return data?.map(transformRolePermissionFromDB) || []
  },

  async getByRoleAndMenuItem(roleName: RoleName, menuItemId: string): Promise<RolePermission | null> {
    logger.debug(`Loading role permission by role and menu item: ${roleName}`, menuItemId)
    
    const { data, error } = await supabase
      .from('omnia_role_permissions')
      .select(`
        *,
        menu_items!inner(
          id,
          name,
          path,
          icon
        )
      `)
      .eq('role_name', roleName)
      .eq('menu_item_id', menuItemId)
      .single()

    if (error) {
      logger.error('Error loading role permission:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    return transformRolePermissionFromDB(data)
  },

  async getAccessibleMenuItemsByRole(roleName: RoleName): Promise<RolePermission[]> {
    logger.debug('Loading accessible menu items by role:', roleName)
    
    const { data, error } = await supabase
      .from('omnia_role_permissions')
      .select(`
        *,
        menu_items!inner(
          id,
          name,
          path,
          icon,
          order_index
        )
      `)
      .eq('role_name', roleName)
      .eq('can_access', true)
      .order('menu_items.order_index')

    if (error) {
      logger.error('Error loading accessible menu items by role:', error)
      throw error
    }

    return data?.map(transformRolePermissionFromDB) || []
  },

  async getRolePermissionsMatrix(): Promise<Record<string, Record<string, boolean>>> {
    logger.debug('Loading role permissions matrix...')
    
    const { data, error } = await supabase
      .from('omnia_role_permissions')
      .select(`
        role_name,
        can_access,
        menu_items!inner(
          path
        )
      `)

    if (error) {
      logger.error('Error loading role permissions matrix:', error)
      throw error
    }

    // Transform to matrix format: { role: { menuPath: canAccess } }
    const matrix: Record<string, Record<string, boolean>> = {}
    
    data?.forEach((permission: any) => {
      const roleName = permission.role_name
      const menuPath = permission.menu_items.path
      const canAccess = permission.can_access
      
      if (!matrix[roleName]) {
        matrix[roleName] = {}
      }
      
      matrix[roleName][menuPath] = canAccess
    })

    logger.debug('Loaded role permissions matrix:', matrix)
    return matrix
  },

  async create(permissionData: CreateRolePermissionData): Promise<RolePermission> {
    logger.debug('Creating role permission:', permissionData)
    
    const { data: newPermission, error: createError } = await supabase
      .from('omnia_role_permissions')
      .insert({
        role_name: permissionData.role_name,
        menu_item_id: permissionData.menu_item_id,
        can_access: permissionData.can_access
      })
      .select(`
        *,
        menu_items!inner(
          id,
          name,
          path,
          icon
        )
      `)
      .single()

    if (createError) {
      logger.error('Error creating role permission:', createError)
      throw createError
    }

    logger.debug('Created role permission:', newPermission)
    return transformRolePermissionFromDB(newPermission)
  },

  async update(id: string, data: UpdateRolePermissionData): Promise<RolePermission | null> {
    logger.debug(`Updating role permission: ${id}`, data)
    
    const updateData: any = {}
    
    if (data.can_access !== undefined) updateData.can_access = data.can_access

    const { data: updatedPermission, error } = await supabase
      .from('omnia_role_permissions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        menu_items!inner(
          id,
          name,
          path,
          icon
        )
      `)
      .single()

    if (error) {
      logger.error('Error updating role permission:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    logger.debug('Updated role permission:', updatedPermission)
    return transformRolePermissionFromDB(updatedPermission)
  },

  async updateByRoleAndMenuItem(roleName: RoleName, menuItemId: string, canAccess: boolean): Promise<RolePermission | null> {
    logger.debug(`Updating role permission by role and menu item: ${roleName}`, { menuItemId, canAccess })
    
    const { data: updatedPermission, error } = await supabase
      .from('omnia_role_permissions')
      .update({ can_access: canAccess })
      .eq('role_name', roleName)
      .eq('menu_item_id', menuItemId)
      .select(`
        *,
        menu_items!inner(
          id,
          name,
          path,
          icon
        )
      `)
      .single()

    if (error) {
      logger.error('Error updating role permission:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    logger.debug('Updated role permission:', updatedPermission)
    return transformRolePermissionFromDB(updatedPermission)
  },

  async remove(id: string): Promise<boolean> {
    logger.debug('Removing role permission:', id)
    
    const { error } = await supabase
      .from('omnia_role_permissions')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error removing role permission:', error)
      throw error
    }

    logger.debug('Removed role permission successfully')
    return true
  },

  async removeByRoleAndMenuItem(roleName: RoleName, menuItemId: string): Promise<boolean> {
    logger.debug(`Removing role permission by role and menu item: ${roleName}`, menuItemId)
    
    const { error } = await supabase
      .from('omnia_role_permissions')
      .delete()
      .eq('role_name', roleName)
      .eq('menu_item_id', menuItemId)

    if (error) {
      logger.error('Error removing role permission:', error)
      throw error
    }

    logger.debug('Removed role permission successfully')
    return true
  },

  async bulkUpdateRolePermissions(roleName: RoleName, permissions: Array<{ menuItemId: string; canAccess: boolean }>): Promise<void> {
    logger.debug(`Bulk updating role permissions: ${roleName}`, permissions)
    
    // Use a transaction to update multiple permissions
    for (const permission of permissions) {
      await this.updateByRoleAndMenuItem(roleName, permission.menuItemId, permission.canAccess)
    }
    
    logger.debug('Bulk updated role permissions successfully')
  }
}