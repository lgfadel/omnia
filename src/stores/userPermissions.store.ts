import { create } from 'zustand'
import { UserPermission, CreateUserPermissionData, UpdateUserPermissionData, UserPermissionSummary, userPermissionsRepoSupabase } from '@/repositories/userPermissionsRepo.supabase'
import { MenuItem } from '@/repositories/menuItemsRepo.supabase'

interface UserPermissionsState {
  userPermissions: UserPermission[]
  currentUserPermissions: UserPermission[]
  accessibleMenuItems: MenuItem[]
  permissionsSummary: UserPermissionSummary | null
  isLoading: boolean
  error: string | null
  
  // Actions
  loadUserPermissions: (userId?: string) => Promise<void>
  loadCurrentUserPermissions: () => Promise<void>
  loadUserAccessibleMenuItems: (userId?: string) => Promise<void>
  loadUserPermissionsSummary: (userId?: string) => Promise<void>
  checkUserMenuPermission: (userId: string, menuItemId: string) => Promise<boolean>
  checkCurrentUserMenuPermission: (menuItemId: string) => Promise<boolean>
  checkCurrentUserMenuPermissionByPath: (menuPath: string) => Promise<boolean>
  addUserPermission: (permission: CreateUserPermissionData) => Promise<void>
  updateUserPermission: (id: string, data: UpdateUserPermissionData) => Promise<void>
  removeUserPermission: (id: string) => Promise<void>
  removeUserPermissionByUserAndMenuItem: (userId: string, menuItemId: string) => Promise<void>
  grantUserPermission: (userId: string, menuItemId: string) => Promise<void>
  revokeUserPermission: (userId: string, menuItemId: string) => Promise<void>
  clearUserPermissions: () => void
  clearError: () => void
}

export const useUserPermissionsStore = create<UserPermissionsState>((set, get) => ({
  userPermissions: [],
  currentUserPermissions: [],
  accessibleMenuItems: [],
  permissionsSummary: null,
  isLoading: false,
  error: null,

  loadUserPermissions: async (userId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const permissions = userId 
        ? await userPermissionsRepoSupabase.getByUserId(userId)
        : await userPermissionsRepoSupabase.list()
      
      if (userId) {
        set({ userPermissions: permissions, isLoading: false })
      } else {
        set({ userPermissions: permissions, isLoading: false })
      }
    } catch (error) {
      console.error('Error loading user permissions:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar permissões do usuário',
        isLoading: false 
      })
    }
  },

  loadCurrentUserPermissions: async () => {
    set({ isLoading: true, error: null })
    try {
      // This will use the current authenticated user from Supabase
      const permissions = await userPermissionsRepoSupabase.list()
      set({ currentUserPermissions: permissions, isLoading: false })
    } catch (error) {
      console.error('Error loading current user permissions:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar suas permissões',
        isLoading: false 
      })
    }
  },

  loadUserAccessibleMenuItems: async (userId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const menuItems = await userPermissionsRepoSupabase.getUserAccessibleMenuItems(userId)
      set({ accessibleMenuItems: menuItems, isLoading: false })
    } catch (error) {
      console.error('Error loading user accessible menu items:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar itens de menu acessíveis',
        isLoading: false 
      })
    }
  },

  loadUserPermissionsSummary: async (userId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const summary = await userPermissionsRepoSupabase.getUserPermissionsSummary(userId)
      set({ permissionsSummary: summary || [], isLoading: false })
    } catch (error) {
      console.error('Error loading user permissions summary:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar resumo de permissões',
        isLoading: false 
      })
    }
  },

  checkUserMenuPermission: async (userId: string, menuItemId: string) => {
    try {
      return await userPermissionsRepoSupabase.checkUserMenuPermission(userId, menuItemId)
    } catch (error) {
      console.error('Error checking user menu permission:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao verificar permissão' })
      return false
    }
  },

  checkCurrentUserMenuPermission: async (menuItemId: string) => {
    try {
      return await userPermissionsRepoSupabase.checkCurrentUserMenuPermission(menuItemId)
    } catch (error) {
      console.error('Error checking current user menu permission:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao verificar sua permissão' })
      return false
    }
  },

  checkCurrentUserMenuPermissionByPath: async (menuPath: string) => {
    try {
      // First, we need to get the menu item by path, then check permission
      // This would require integration with menu items store or repository
      // For now, we'll implement a basic version
      const { accessibleMenuItems } = get()
      const menuItem = accessibleMenuItems.find(item => item.path === menuPath)
      
      if (!menuItem) {
        return false
      }
      
      return await userPermissionsRepoSupabase.checkCurrentUserMenuPermission(menuItem.id)
    } catch (error) {
      console.error('Error checking current user menu permission by path:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao verificar permissão por caminho' })
      return false
    }
  },

  addUserPermission: async (permissionData: CreateUserPermissionData) => {
    try {
      const newPermission = await userPermissionsRepoSupabase.create(permissionData)
      const { userPermissions } = get()
      set({ userPermissions: [newPermission, ...userPermissions] })
    } catch (error) {
      console.error('Error adding user permission:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao adicionar permissão' })
    }
  },

  updateUserPermission: async (id: string, data: UpdateUserPermissionData) => {
    try {
      const updatedPermission = await userPermissionsRepoSupabase.update(id, data)
      if (updatedPermission) {
        const { userPermissions } = get()
        const updatedPermissions = userPermissions.map(permission => 
          permission.id === id ? updatedPermission : permission
        )
        set({ userPermissions: updatedPermissions })
      } else {
        set({ error: 'Erro ao atualizar permissão' })
      }
    } catch (error) {
      console.error('Error updating user permission:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao atualizar permissão' })
    }
  },

  removeUserPermission: async (id: string) => {
    try {
      await userPermissionsRepoSupabase.remove(id)
      const { userPermissions } = get()
      const filteredPermissions = userPermissions.filter(permission => permission.id !== id)
      set({ userPermissions: filteredPermissions })
    } catch (error) {
      console.error('Error removing user permission:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao remover permissão' })
    }
  },

  removeUserPermissionByUserAndMenuItem: async (userId: string, menuItemId: string) => {
    try {
      await userPermissionsRepoSupabase.removeByUserAndMenuItem(userId, menuItemId)
      const { userPermissions } = get()
      const filteredPermissions = userPermissions.filter(
        permission => !(permission.user_id === userId && permission.menu_item_id === menuItemId)
      )
      set({ userPermissions: filteredPermissions })
    } catch (error) {
      console.error('Error removing user permission by user and menu item:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao remover permissão específica' })
    }
  },

  grantUserPermission: async (userId: string, menuItemId: string) => {
    try {
      // Check if permission already exists
      const existingPermission = await userPermissionsRepoSupabase.getByUserAndMenuItem(userId, menuItemId)
      
      if (existingPermission) {
        // Update existing permission to grant access
        await get().updateUserPermission(existingPermission.id, { can_access: true })
      } else {
        // Create new permission
        await get().addUserPermission({
          user_id: userId,
          menu_item_id: menuItemId,
          can_access: true
        })
      }
    } catch (error) {
      console.error('Error granting user permission:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao conceder permissão' })
    }
  },

  revokeUserPermission: async (userId: string, menuItemId: string) => {
    try {
      // Check if permission exists
      const existingPermission = await userPermissionsRepoSupabase.getByUserAndMenuItem(userId, menuItemId)
      
      if (existingPermission) {
        // Update existing permission to revoke access
        await get().updateUserPermission(existingPermission.id, { can_access: false })
      }
      // If permission doesn't exist, it's already revoked (no access by default)
    } catch (error) {
      console.error('Error revoking user permission:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao revogar permissão' })
    }
  },

  clearUserPermissions: () => {
    set({ 
      userPermissions: [], 
      currentUserPermissions: [], 
      accessibleMenuItems: [], 
      permissionsSummary: null, 
      error: null 
    })
  },

  clearError: () => {
    set({ error: null })
  }
}))