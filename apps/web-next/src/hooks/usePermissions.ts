import { useEffect, useState, useCallback } from 'react'
import { useUserPermissionsStore } from '@/stores/userPermissions.store'
import { useAuth } from '@/components/auth/AuthProvider'
import { MenuItem } from '@/repositories/menuItemsRepo.supabase'
import { logger } from '../lib/logging';


export interface PermissionsData {
  canAccess: (menuItemId: string) => Promise<boolean>
  canAccessPath: (menuPath: string) => Promise<boolean>
  hasPermission: (menuItemId: string) => boolean
  hasPermissionForPath: (menuPath: string) => boolean
  accessibleMenuItems: MenuItem[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Hook para gerenciar permissões do usuário atual
 * Fornece métodos para verificar permissões e acessar itens de menu permitidos
 */
export function usePermissions(): PermissionsData {
  const { user } = useAuth()
  const {
    currentUserPermissions,
    accessibleMenuItems,
    isLoading,
    error,
    loadCurrentUserPermissions,
    loadUserAccessibleMenuItems,
    checkCurrentUserMenuPermission,
    checkCurrentUserMenuPermissionByPath,
    clearError
  } = useUserPermissionsStore()

  const [permissionsCache, setPermissionsCache] = useState<Record<string, boolean>>({})
  const [pathPermissionsCache, setPathPermissionsCache] = useState<Record<string, boolean>>({})

  const loadInitialData = useCallback(async () => {
    try {
      await Promise.all([
        loadCurrentUserPermissions(),
        loadUserAccessibleMenuItems()
      ])
    } catch (error) {
      logger.error('Erro ao carregar dados de permissões:', error)
    }
  }, [loadCurrentUserPermissions, loadUserAccessibleMenuItems])

  // Carregar dados iniciais
  useEffect(() => {
    if (user) {
      loadInitialData()
    }
  }, [user, loadInitialData])

  // Função para verificar permissão por ID do menu item (com cache)
  const canAccess = useCallback(async (menuItemId: string): Promise<boolean> => {
    // Verificar cache primeiro
    if (permissionsCache[menuItemId] !== undefined) {
      return permissionsCache[menuItemId]
    }

    try {
      const hasAccess = await checkCurrentUserMenuPermission(menuItemId)
      
      // Atualizar cache
      setPermissionsCache(prev => ({
        ...prev,
        [menuItemId]: hasAccess
      }))
      
      return hasAccess
    } catch (error) {
      logger.error('Erro ao verificar permissão:', error)
      return false
    }
  }, [checkCurrentUserMenuPermission, permissionsCache])

  // Função para verificar permissão por caminho do menu (com cache)
  const canAccessPath = useCallback(async (menuPath: string): Promise<boolean> => {
    // Verificar cache primeiro
    if (pathPermissionsCache[menuPath] !== undefined) {
      return pathPermissionsCache[menuPath]
    }

    try {
      const hasAccess = await checkCurrentUserMenuPermissionByPath(menuPath)
      
      // Atualizar cache
      setPathPermissionsCache(prev => ({
        ...prev,
        [menuPath]: hasAccess
      }))
      
      return hasAccess
    } catch (error) {
      logger.error('Erro ao verificar permissão por caminho:', error)
      return false
    }
  }, [checkCurrentUserMenuPermissionByPath, pathPermissionsCache])

  // Função síncrona para verificar permissão (baseada nos dados já carregados)
  const hasPermission = useCallback((menuItemId: string): boolean => {
    // Verificar cache primeiro
    if (permissionsCache[menuItemId] !== undefined) {
      return permissionsCache[menuItemId]
    }

    // Verificar nas permissões já carregadas
    const permission = currentUserPermissions.find(p => p.menu_item_id === menuItemId)
    return permission?.can_access || false
  }, [currentUserPermissions, permissionsCache])

  // Função síncrona para verificar permissão por caminho
  const hasPermissionForPath = useCallback((menuPath: string): boolean => {
    // Verificar cache primeiro
    if (pathPermissionsCache[menuPath] !== undefined) {
      return pathPermissionsCache[menuPath]
    }

    // Verificar nos itens acessíveis já carregados
    const menuItem = accessibleMenuItems.find(item => item.path === menuPath)
    return !!menuItem
  }, [accessibleMenuItems, pathPermissionsCache])

  // Função para atualizar dados
  const refresh = useCallback(async () => {
    // Limpar caches
    setPermissionsCache({})
    setPathPermissionsCache({})
    
    // Limpar erros
    clearError()
    
    // Recarregar dados
    await loadInitialData()
  }, [clearError, loadInitialData])

  // Limpar cache quando as permissões mudarem
  useEffect(() => {
    setPermissionsCache({})
    setPathPermissionsCache({})
  }, [currentUserPermissions, accessibleMenuItems])

  return {
    canAccess,
    canAccessPath,
    hasPermission,
    hasPermissionForPath,
    accessibleMenuItems,
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook simplificado para verificar se o usuário pode acessar um item específico
 * @param menuItemId - ID do item do menu
 */
export function useCanAccess(menuItemId: string) {
  const { canAccess, hasPermission, isLoading, error } = usePermissions()
  const [canAccessItem, setCanAccessItem] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    // Primeiro, tentar verificação síncrona
    const syncResult = hasPermission(menuItemId)
    if (syncResult !== undefined) {
      setCanAccessItem(syncResult)
      return
    }

    // Se não tiver resultado síncrono, fazer verificação assíncrona
    const checkAccess = async () => {
      setIsChecking(true)
      try {
        const result = await canAccess(menuItemId)
        setCanAccessItem(result)
      } catch (error) {
        logger.error('Erro ao verificar acesso:', error)
        setCanAccessItem(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkAccess()
  }, [menuItemId, canAccess, hasPermission])

  return {
    canAccess: canAccessItem,
    isLoading: isLoading || isChecking,
    error
  }
}

/**
 * Hook simplificado para verificar se o usuário pode acessar um caminho específico
 * @param menuPath - Caminho do menu (ex: '/dashboard', '/crm')
 */
export function useCanAccessPath(menuPath: string) {
  const { canAccessPath, hasPermissionForPath, isLoading, error } = usePermissions()
  const [canAccessRoute, setCanAccessRoute] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    // Primeiro, tentar verificação síncrona
    const syncResult = hasPermissionForPath(menuPath)
    if (syncResult !== undefined) {
      setCanAccessRoute(syncResult)
      return
    }

    // Se não tiver resultado síncrono, fazer verificação assíncrona
    const checkAccess = async () => {
      setIsChecking(true)
      try {
        const result = await canAccessPath(menuPath)
        setCanAccessRoute(result)
      } catch (error) {
        logger.error('Erro ao verificar acesso ao caminho:', error)
        setCanAccessRoute(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkAccess()
  }, [menuPath, canAccessPath, hasPermissionForPath])

  return {
    canAccess: canAccessRoute,
    isLoading: isLoading || isChecking,
    error
  }
}

/**
 * Hook para obter apenas os itens de menu acessíveis
 */
export function useAccessibleMenuItems() {
  const { accessibleMenuItems, isLoading, error, refresh } = usePermissions()
  
  return {
    menuItems: accessibleMenuItems,
    isLoading,
    error,
    refresh
  }
}