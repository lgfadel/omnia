import { create } from 'zustand'
import { MenuItem, CreateMenuItemData, UpdateMenuItemData, menuItemsRepoSupabase } from '@/repositories/menuItemsRepo.supabase'
import { logger } from '../lib/logging';


interface MenuItemsState {
  menuItems: MenuItem[]
  rootItems: MenuItem[]
  isLoading: boolean
  error: string | null
  
  // Actions
  loadMenuItems: () => Promise<void>
  loadRootItems: () => Promise<void>
  loadChildren: (parentId: string) => Promise<MenuItem[]>
  getById: (id: string) => MenuItem | undefined
  getByPath: (path: string) => MenuItem | undefined
  addMenuItem: (menuItem: CreateMenuItemData) => Promise<void>
  updateMenuItem: (id: string, data: UpdateMenuItemData) => Promise<void>
  removeMenuItem: (id: string) => Promise<void>
  reorderMenuItems: (items: Array<{ id: string; order_index: number }>) => Promise<void>
  clearMenuItems: () => void
  clearError: () => void
}

export const useMenuItemsStore = create<MenuItemsState>((set, get) => ({
  menuItems: [],
  rootItems: [],
  isLoading: false,
  error: null,

  loadMenuItems: async () => {
    set({ isLoading: true, error: null })
    try {
      const menuItems = await menuItemsRepoSupabase.listAll()
      set({ menuItems, isLoading: false })
    } catch (error) {
      logger.error('Error loading menu items:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar itens do menu',
        isLoading: false 
      })
    }
  },

  loadRootItems: async () => {
    set({ isLoading: true, error: null })
    try {
      const rootItems = await menuItemsRepoSupabase.getRootItems()
      set({ rootItems, isLoading: false })
    } catch (error) {
      logger.error('Error loading root menu items:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar itens raiz do menu',
        isLoading: false 
      })
    }
  },

  loadChildren: async (parentId: string) => {
    try {
      const children = await menuItemsRepoSupabase.getChildren(parentId)
      return children
    } catch (error) {
      logger.error('Error loading menu item children:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao carregar subitens do menu' })
      return []
    }
  },

  getById: (id: string) => {
    const { menuItems } = get()
    return menuItems.find(item => item.id === id)
  },

  getByPath: (path: string) => {
    const { menuItems } = get()
    return menuItems.find(item => item.path === path)
  },

  addMenuItem: async (menuItemData: CreateMenuItemData) => {
    try {
      const newMenuItem = await menuItemsRepoSupabase.create(menuItemData)
      const { menuItems, rootItems } = get()
      
      // Add to main list
      set({ menuItems: [...menuItems, newMenuItem] })
      
      // If it's a root item, add to root items as well
      if (!newMenuItem.parent_id) {
        set({ rootItems: [...rootItems, newMenuItem] })
      }
    } catch (error) {
      logger.error('Error adding menu item:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao adicionar item do menu' })
    }
  },

  updateMenuItem: async (id: string, data: UpdateMenuItemData) => {
    try {
      const updatedMenuItem = await menuItemsRepoSupabase.update(id, data)
      if (updatedMenuItem) {
        const { menuItems, rootItems } = get()
        
        // Update in main list
        const updatedMenuItems = menuItems.map(item => 
          item.id === id ? updatedMenuItem : item
        )
        set({ menuItems: updatedMenuItems })
        
        // Update in root items if applicable
        if (!updatedMenuItem.parent_id) {
          const updatedRootItems = rootItems.map(item => 
            item.id === id ? updatedMenuItem : item
          )
          set({ rootItems: updatedRootItems })
        } else {
          // Remove from root items if it now has a parent
          const filteredRootItems = rootItems.filter(item => item.id !== id)
          set({ rootItems: filteredRootItems })
        }
      } else {
        set({ error: 'Erro ao atualizar item do menu' })
      }
    } catch (error) {
      logger.error('Error updating menu item:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao atualizar item do menu' })
    }
  },

  removeMenuItem: async (id: string) => {
    try {
      await menuItemsRepoSupabase.remove(id)
      const { menuItems, rootItems } = get()
      
      // Remove from main list
      const filteredMenuItems = menuItems.filter(item => item.id !== id)
      set({ menuItems: filteredMenuItems })
      
      // Remove from root items
      const filteredRootItems = rootItems.filter(item => item.id !== id)
      set({ rootItems: filteredRootItems })
    } catch (error) {
      logger.error('Error removing menu item:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao remover item do menu' })
    }
  },

  reorderMenuItems: async (items: Array<{ id: string; order_index: number }>) => {
    try {
      // Update each item individually since there's no batch reorder function
      for (const item of items) {
        await menuItemsRepoSupabase.update(item.id, { order_index: item.order_index })
      }
      
      // Reload items to reflect new order
      const { loadMenuItems, loadRootItems } = get()
      await loadMenuItems()
      await loadRootItems()
    } catch (error) {
      logger.error('Error reordering menu items:', error)
      set({ error: error instanceof Error ? error.message : 'Erro ao reordenar itens do menu' })
    }
  },

  clearMenuItems: () => {
    set({ menuItems: [], rootItems: [], error: null })
  },

  clearError: () => {
    set({ error: null })
  }
}))