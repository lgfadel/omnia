import { useEffect, useState, useCallback, useMemo } from 'react'
import { useMenuItemsStore } from '@/stores/menuItems.store'
import { usePermissions } from '@/hooks/usePermissions'
import { MenuItem } from '@/repositories/menuItemsRepo.supabase'
import { logger } from '../lib/logging';


export interface MenuItemsData {
  allMenuItems: MenuItem[]
  rootMenuItems: MenuItem[]
  accessibleMenuItems: MenuItem[]
  accessibleRootItems: MenuItem[]
  isLoading: boolean
  error: string | null
  getChildren: (parentId: string) => Promise<MenuItem[]>
  getAccessibleChildren: (parentId: string) => Promise<MenuItem[]>
  getMenuItemById: (id: string) => MenuItem | undefined
  getMenuItemByPath: (path: string) => MenuItem | undefined
  buildMenuTree: () => MenuItem[]
  buildAccessibleMenuTree: () => MenuItem[]
  refresh: () => Promise<void>
}

/**
 * Hook para gerenciar itens de menu com integração de permissões
 * Fornece acesso a todos os itens de menu e filtra baseado nas permissões do usuário
 */
export function useMenuItems(): MenuItemsData {
  const {
    menuItems: allMenuItems,
    rootItems: rootMenuItems,
    isLoading: menuLoading,
    error: menuError,
    loadMenuItems,
    loadRootItems,
    loadChildren,
    getById,
    getByPath,
    clearError
  } = useMenuItemsStore()

  const {
    accessibleMenuItems,
    hasPermission,
    isLoading: permissionsLoading,
    error: permissionsError
  } = usePermissions()

  const [accessibleRootItems, setAccessibleRootItems] = useState<MenuItem[]>([])

  // Estados combinados
  const isLoading = menuLoading || permissionsLoading
  const error = menuError || permissionsError

  const loadInitialData = useCallback(async () => {
    try {
      await Promise.all([
        loadMenuItems(),
        loadRootItems()
      ])
    } catch (error) {
      logger.error('Erro ao carregar itens de menu:', error)
    }
  }, [loadMenuItems, loadRootItems])

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Filtrar itens raiz acessíveis quando os dados mudarem
  useEffect(() => {
    if (rootMenuItems.length > 0 && accessibleMenuItems.length > 0) {
      const accessibleIds = new Set(accessibleMenuItems.map(item => item.id))
      const filteredRootItems = rootMenuItems.filter(item => accessibleIds.has(item.id))
      setAccessibleRootItems(filteredRootItems)
    }
  }, [rootMenuItems, accessibleMenuItems, setAccessibleRootItems])

  // Função para obter filhos de um item
  const getChildren = useCallback(async (parentId: string): Promise<MenuItem[]> => {
    try {
      return await loadChildren(parentId)
    } catch (error) {
      logger.error('Erro ao carregar filhos do menu:', error)
      return []
    }
  }, [loadChildren])

  // Função para obter filhos acessíveis de um item
  const getAccessibleChildren = useCallback(async (parentId: string): Promise<MenuItem[]> => {
    try {
      const children = await loadChildren(parentId)
      
      // Filtrar apenas os filhos que o usuário tem permissão para acessar
      const accessibleChildren = children.filter(child => {
        return hasPermission(child.id)
      })
      
      return accessibleChildren
    } catch (error) {
      logger.error('Erro ao carregar filhos acessíveis do menu:', error)
      return []
    }
  }, [loadChildren, hasPermission])

  // Função para obter item por ID
  const getMenuItemById = useCallback((id: string): MenuItem | undefined => {
    return getById(id)
  }, [getById])

  // Função para obter item por caminho
  const getMenuItemByPath = useCallback((path: string): MenuItem | undefined => {
    return getByPath(path)
  }, [getByPath])

  // Função para construir árvore completa de menu
  const buildMenuTree = useCallback((): MenuItem[] => {
    const itemsMap = new Map<string, MenuItem & { children?: MenuItem[] }>()
    const rootItems: (MenuItem & { children?: MenuItem[] })[] = []

    // Criar mapa de todos os itens
    allMenuItems.forEach(item => {
      itemsMap.set(item.id, { ...item, children: [] })
    })

    // Construir árvore
    allMenuItems.forEach(item => {
      const menuItem = itemsMap.get(item.id)!
      
      if (item.parent_id) {
        const parent = itemsMap.get(item.parent_id)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(menuItem)
        }
      } else {
        rootItems.push(menuItem)
      }
    })

    // Ordenar por order_index
    const sortByOrder = (items: (MenuItem & { children?: MenuItem[] })[]) => {
      items.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortByOrder(item.children)
        }
      })
    }

    sortByOrder(rootItems)
    return rootItems
  }, [allMenuItems])

  // Função para construir árvore de menu acessível
  const buildAccessibleMenuTree = useCallback((): MenuItem[] => {
    // Paths de menu temporariamente ocultos
    const hiddenPaths = ['/crm']
    const filteredItems = accessibleMenuItems.filter(item => !hiddenPaths.includes(item.path))

    const accessibleIds = new Set(filteredItems.map(item => item.id))
    const itemsMap = new Map<string, MenuItem & { children?: MenuItem[] }>()
    const rootItems: (MenuItem & { children?: MenuItem[] })[] = []

    // Criar mapa apenas dos itens acessíveis
    filteredItems.forEach(item => {
      itemsMap.set(item.id, { ...item, children: [] })
    })

    // Construir árvore apenas com itens acessíveis (filtrados)
    filteredItems.forEach(item => {
      const menuItem = itemsMap.get(item.id)!
      
      if (item.parent_id && accessibleIds.has(item.parent_id)) {
        const parent = itemsMap.get(item.parent_id)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(menuItem)
        }
      } else if (!item.parent_id) {
        rootItems.push(menuItem)
      }
    })

    // Ordenar por order_index
    const sortByOrder = (items: (MenuItem & { children?: MenuItem[] })[]) => {
      items.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortByOrder(item.children)
        }
      })
    }

    sortByOrder(rootItems)
    return rootItems
  }, [accessibleMenuItems])

  // Função para atualizar dados
  const refresh = useCallback(async () => {
    clearError()
    await loadInitialData()
  }, [clearError, loadInitialData])

  return {
    allMenuItems,
    rootMenuItems,
    accessibleMenuItems,
    accessibleRootItems,
    isLoading,
    error,
    getChildren,
    getAccessibleChildren,
    getMenuItemById,
    getMenuItemByPath,
    buildMenuTree,
    buildAccessibleMenuTree,
    refresh
  }
}

/**
 * Hook simplificado para obter apenas itens de menu acessíveis
 */
export function useAccessibleMenuItems() {
  const { accessibleMenuItems, accessibleRootItems, isLoading, error, refresh } = useMenuItems()
  
  return {
    menuItems: accessibleMenuItems,
    rootItems: accessibleRootItems,
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook para obter a árvore de menu acessível
 */
export function useAccessibleMenuTree() {
  const { buildAccessibleMenuTree, isLoading, error, refresh } = useMenuItems()
  
  const menuTree = useMemo(() => {
    if (isLoading) return []
    return buildAccessibleMenuTree()
  }, [buildAccessibleMenuTree, isLoading])
  
  return {
    menuTree,
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook para verificar se um item de menu específico está acessível
 * @param menuPath - Caminho do menu
 */
export function useMenuItemAccess(menuPath: string) {
  const { getMenuItemByPath, accessibleMenuItems, isLoading, error } = useMenuItems()
  
  const menuItem = useMemo(() => {
    return getMenuItemByPath(menuPath)
  }, [getMenuItemByPath, menuPath])
  
  const isAccessible = useMemo(() => {
    if (!menuItem) return false
    return accessibleMenuItems.some(item => item.id === menuItem.id)
  }, [menuItem, accessibleMenuItems])
  
  return {
    menuItem,
    isAccessible,
    isLoading,
    error
  }
}

/**
 * Hook para navegação baseada em permissões
 * @param currentPath - Caminho atual
 */
export function useMenuNavigation(currentPath: string) {
  const { accessibleMenuItems, getMenuItemByPath, isLoading, error } = useMenuItems()
  
  const currentMenuItem = useMemo(() => {
    return getMenuItemByPath(currentPath)
  }, [getMenuItemByPath, currentPath])
  
  const canAccessCurrent = useMemo(() => {
    if (!currentMenuItem) return false
    return accessibleMenuItems.some(item => item.id === currentMenuItem.id)
  }, [currentMenuItem, accessibleMenuItems])
  
  const getNextAccessibleItem = useCallback(() => {
    if (accessibleMenuItems.length === 0) return null
    
    const currentIndex = accessibleMenuItems.findIndex(item => item.path === currentPath)
    if (currentIndex === -1) return accessibleMenuItems[0]
    
    const nextIndex = (currentIndex + 1) % accessibleMenuItems.length
    return accessibleMenuItems[nextIndex]
  }, [accessibleMenuItems, currentPath])
  
  const getPreviousAccessibleItem = useCallback(() => {
    if (accessibleMenuItems.length === 0) return null
    
    const currentIndex = accessibleMenuItems.findIndex(item => item.path === currentPath)
    if (currentIndex === -1) return accessibleMenuItems[accessibleMenuItems.length - 1]
    
    const prevIndex = currentIndex === 0 ? accessibleMenuItems.length - 1 : currentIndex - 1
    return accessibleMenuItems[prevIndex]
  }, [accessibleMenuItems, currentPath])
  
  return {
    currentMenuItem,
    canAccessCurrent,
    getNextAccessibleItem,
    getPreviousAccessibleItem,
    isLoading,
    error
  }
}