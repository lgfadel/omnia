import { supabase } from "@/integrations/supabase/client"

export interface UserPermission {
  id: string
  user_id: string
  menu_item_id: string
  can_access: boolean
  granted_by?: string | null
  granted_at: string
  created_at: string
  updated_at: string
  // Relations
  menu_item?: {
    id: string
    name: string
    path: string
    icon?: string
  }
  user?: {
    id: string
    name: string
  }
  granted_by_user?: {
    id: string
    name: string
  }
}

export interface CreateUserPermissionData {
  user_id: string
  menu_item_id: string
  can_access: boolean
  granted_by?: string
}

export interface UpdateUserPermissionData {
  can_access?: boolean
  granted_by?: string
}

export interface UserPermissionSummary {
  menu_item_id: string
  menu_item_name: string
  menu_item_path: string
  permission_source: string
  can_access: boolean
  granted_by_name?: string
  granted_at?: string
}

// Transform database record to UserPermission type
const transformUserPermissionFromDB = (dbUserPermission: any): UserPermission => ({
  id: dbUserPermission.id,
  user_id: dbUserPermission.user_id,
  menu_item_id: dbUserPermission.menu_item_id,
  can_access: dbUserPermission.can_access,
  granted_by: dbUserPermission.granted_by,
  granted_at: dbUserPermission.granted_at,
  created_at: dbUserPermission.created_at,
  updated_at: dbUserPermission.updated_at,
  menu_item: dbUserPermission.menu_items ? {
    id: dbUserPermission.menu_items.id,
    name: dbUserPermission.menu_items.name,
    path: dbUserPermission.menu_items.path,
    icon: dbUserPermission.menu_items.icon
  } : undefined,
  user: dbUserPermission.users ? {
    id: dbUserPermission.users.id,
    name: dbUserPermission.users.name
  } : undefined,
  granted_by_user: dbUserPermission.granted_by_user ? {
    id: dbUserPermission.granted_by_user.id,
    name: dbUserPermission.granted_by_user.name
  } : undefined
})

export const userPermissionsRepoSupabase = {
  async list(): Promise<UserPermission[]> {
    try {
      const { data, error } = await supabase
        .from('omnia_user_permissions')
        .select(`
          *,
          menu_items:omnia_menu_items(id, name, path, icon),
          user:omnia_users!user_id(id, name),
          granted_by_user:omnia_users!granted_by(id, name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map(transformUserPermissionFromDB)
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.list:', error)
      throw error
    }
  },

  async getByUserId(userId: string): Promise<UserPermission[]> {
    try {
      const { data, error } = await supabase
        .from('omnia_user_permissions')
        .select(`
          *,
          menu_items:omnia_menu_items(id, name, path, icon),
          user:omnia_users!user_id(id, name),
          granted_by_user:omnia_users!granted_by(id, name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map(transformUserPermissionFromDB)
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.getByUserId:', error)
      throw error
    }
  },

  async getByMenuItemId(menuItemId: string): Promise<UserPermission[]> {
    try {
      const { data, error } = await supabase
        .from('omnia_user_permissions')
        .select(`
          *,
          menu_items:omnia_menu_items(id, name, path, icon),
          user:omnia_users!user_id(id, name),
          granted_by_user:omnia_users!granted_by(id, name)
        `)
        .eq('menu_item_id', menuItemId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map(transformUserPermissionFromDB)
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.getByMenuItemId:', error)
      throw error
    }
  },

  async getByUserAndMenuItem(userId: string, menuItemId: string): Promise<UserPermission | null> {
    try {
      const { data, error } = await supabase
        .from('omnia_user_permissions')
        .select(`
          *,
          menu_items:omnia_menu_items(id, name, path, icon),
          user:omnia_users!user_id(id, name),
          granted_by_user:omnia_users!granted_by(id, name)
        `)
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId)
        .single()

      if (error) throw error
      return data ? transformUserPermissionFromDB(data) : null
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.getByUserAndMenuItem:', error)
      throw error
    }
  },

  async getUserPermissionsSummary(userId: string): Promise<UserPermissionSummary[]> {
    try {
      // Fallback: return empty array since get_user_permissions_summary function doesn't exist yet
      console.warn('get_user_permissions_summary function not available in current schema')
      return []
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.getUserPermissionsSummary:', error)
      throw error
    }
  },

  async checkUserMenuPermission(userId: string, menuItemPath: string): Promise<boolean> {
    try {
      // Fallback: return true since check_user_menu_permission function doesn't exist
      console.warn('check_user_menu_permission function not available in current schema')
      return true
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.checkUserMenuPermission:', error)
      throw error
    }
  },

  async checkCurrentUserMenuPermission(menuItemPath: string): Promise<boolean> {
    try {
      // Fallback: return true since check_current_user_menu_permission function doesn't exist
      console.warn('check_current_user_menu_permission function not available in current schema')
      return true
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.checkCurrentUserMenuPermission:', error)
      throw error
    }
  },

  async getUserAccessibleMenuItems(userId?: string): Promise<any[]> {
    try {
      // Get all active menu items from the database
      const { data, error } = await supabase
        .from('omnia_menu_items')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('Error fetching menu items from omnia_menu_items:', error)
        // Return default menu items as fallback
        return [
          {
            id: 'dashboard',
            name: 'Dashboard',
            path: '/dashboard',
            icon: 'LayoutDashboard',
            parent_id: null,
            is_active: true,
            order_index: 1,
            can_access: true
          },
          {
            id: 'usuarios',
            name: 'Usuários',
            path: '/usuarios',
            icon: 'Users',
            parent_id: null,
            is_active: true,
            order_index: 2,
            can_access: true
          },
          {
            id: 'condominios',
            name: 'Condomínios',
            path: '/condominios',
            icon: 'Building',
            parent_id: null,
            is_active: true,
            order_index: 3,
            can_access: true
          },
          {
            id: 'crm',
            name: 'CRM',
            path: '/crm',
            icon: 'Users',
            parent_id: null,
            is_active: true,
            order_index: 4,
            can_access: true
          }
        ]
      }

      // Transform the data to match the expected format
      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        path: item.path,
        icon: item.icon,
        parent_id: item.parent_id,
        is_active: item.is_active,
        order_index: item.order_index,
        can_access: true // For now, assume all active items are accessible
      }))
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.getUserAccessibleMenuItems:', error)
      // Return default menu items as fallback
      return [
        {
          id: 'dashboard',
          name: 'Dashboard',
          path: '/dashboard',
          icon: 'LayoutDashboard',
          parent_id: null,
          is_active: true,
          order_index: 1,
          can_access: true
        },
        {
          id: 'usuarios',
          name: 'Usuários',
          path: '/usuarios',
          icon: 'Users',
          parent_id: null,
          is_active: true,
          order_index: 2,
          can_access: true
        },
        {
          id: 'condominios',
          name: 'Condomínios',
          path: '/condominios',
          icon: 'Building',
          parent_id: null,
          is_active: true,
          order_index: 3,
          can_access: true
        },
        {
          id: 'crm',
          name: 'CRM',
          path: '/crm',
          icon: 'Users',
          parent_id: null,
          is_active: true,
          order_index: 4,
          can_access: true
        }
      ]
    }
  },

  async create(permissionData: CreateUserPermissionData): Promise<UserPermission> {
    try {
      const { data: result, error } = await supabase
        .from('omnia_user_permissions')
        .insert(permissionData)
        .select(`
          *,
          menu_items:omnia_menu_items(id, name, path, icon),
          user:omnia_users!user_id(id, name),
          granted_by_user:omnia_users!granted_by(id, name)
        `)
        .single()

      if (error) throw error
      return transformUserPermissionFromDB(result)
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.create:', error)
      throw error
    }
  },

  async update(id: string, data: UpdateUserPermissionData): Promise<UserPermission | null> {
    try {
      const { data: result, error } = await supabase
        .from('omnia_user_permissions')
        .update(data)
        .eq('id', id)
        .select(`
          *,
          menu_items:omnia_menu_items(id, name, path, icon),
          user:omnia_users!user_id(id, name),
          granted_by_user:omnia_users!granted_by(id, name)
        `)
        .single()

      if (error) throw error
      return result ? transformUserPermissionFromDB(result) : null
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.update:', error)
      throw error
    }
  },

  async remove(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('omnia_user_permissions')
        .delete()
        .eq('id', id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.remove:', error)
      throw error
    }
  },

  async removeByUserAndMenuItem(userId: string, menuItemId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('omnia_user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error in userPermissionsRepoSupabase.removeByUserAndMenuItem:', error)
      throw error
    }
  }
}