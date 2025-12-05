import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMenuItemsStore } from '../menuItems.store'
import { menuItemsRepoSupabase } from '@/repositories/menuItemsRepo.supabase'
import type { MenuItem, CreateMenuItemData, UpdateMenuItemData } from '@/repositories/menuItemsRepo.supabase'

// Mock do repository
vi.mock('@/repositories/menuItemsRepo.supabase', () => ({
  menuItemsRepoSupabase: {
    listAll: vi.fn(),
    list: vi.fn(),
    getRootItems: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const mockMenuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Dashboard',
    path: '/dashboard',
    icon: 'Home',
    order_index: 1,
    is_active: true,
    parent_id: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Atas',
    path: '/atas',
    icon: 'FileText',
    order_index: 2,
    is_active: true,
    parent_id: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
]

describe('MenuItemsStore', () => {
  beforeEach(() => {
    // Reset store state
    useMenuItemsStore.setState({
      menuItems: [],
      rootItems: [],
      isLoading: false,
      error: null,
    })
    
    // Reset mocks
    vi.clearAllMocks()
  })

  describe('loadMenuItems', () => {
    it('should load menu items successfully', async () => {
      // Arrange
      vi.mocked(menuItemsRepoSupabase.listAll).mockResolvedValue(mockMenuItems)
      vi.mocked(menuItemsRepoSupabase.getRootItems).mockResolvedValue(mockMenuItems)
      
      const { loadMenuItems } = useMenuItemsStore.getState()

      // Act
      await loadMenuItems()

      // Assert
      const state = useMenuItemsStore.getState()
      expect(state.menuItems).toEqual(mockMenuItems)
      expect(state.rootItems).toEqual(mockMenuItems)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(menuItemsRepoSupabase.listAll).toHaveBeenCalledOnce()
      expect(menuItemsRepoSupabase.getRootItems).toHaveBeenCalledOnce()
    })

    it('should handle errors when loading menu items', async () => {
      // Arrange
      const errorMessage = 'Failed to load menu items'
      vi.mocked(menuItemsRepoSupabase.listAll).mockRejectedValue(new Error(errorMessage))
      
      const { loadMenuItems } = useMenuItemsStore.getState()

      // Act
      await loadMenuItems()

      // Assert
      const state = useMenuItemsStore.getState()
      expect(state.menuItems).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe(errorMessage)
    })

    it('should set loading state during operation', async () => {
      // Arrange
      let resolvePromise: (value: MenuItem[]) => void
      const promise = new Promise<MenuItem[]>((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(menuItemsRepoSupabase.listAll).mockReturnValue(promise)
      vi.mocked(menuItemsRepoSupabase.getRootItems).mockResolvedValue([])
      
      const { loadMenuItems } = useMenuItemsStore.getState()

      // Act
      const loadPromise = loadMenuItems()
      
      // Assert loading state
      expect(useMenuItemsStore.getState().isLoading).toBe(true)
      
      // Complete the promise
      resolvePromise!(mockMenuItems)
      await loadPromise
      
      // Assert final state
      expect(useMenuItemsStore.getState().isLoading).toBe(false)
    })
  })

  describe('addMenuItem', () => {
    it('should add a new menu item successfully', async () => {
      // Arrange
      const newMenuItem = mockMenuItems[0]
      const createData: CreateMenuItemData = {
        name: newMenuItem.name,
        path: newMenuItem.path,
        icon: newMenuItem.icon,
        order_index: newMenuItem.order_index,
        is_active: newMenuItem.is_active,
        parent_id: newMenuItem.parent_id,
      }
      
      vi.mocked(menuItemsRepoSupabase.create).mockResolvedValue(newMenuItem)
      
      const { addMenuItem } = useMenuItemsStore.getState()

      // Act
      const result = await addMenuItem(createData)

      // Assert
      expect(result).toEqual(newMenuItem)
      expect(menuItemsRepoSupabase.create).toHaveBeenCalledWith(createData)
      
      const state = useMenuItemsStore.getState()
      expect(state.menuItems).toContain(newMenuItem)
    })

    it('should handle errors when adding menu item', async () => {
      // Arrange
      const errorMessage = 'Failed to create menu item'
      const createData: CreateMenuItemData = {
        name: 'Test',
        path: '/test',
        icon: 'Test',
        order_index: 1,
        is_active: true,
        parent_id: null,
      }
      
      vi.mocked(menuItemsRepoSupabase.create).mockRejectedValue(new Error(errorMessage))
      
      const { addMenuItem } = useMenuItemsStore.getState()

      // Act & Assert
      await expect(addMenuItem(createData)).rejects.toThrow(errorMessage)
      
      const state = useMenuItemsStore.getState()
      expect(state.error).toBe(errorMessage)
    })
  })

  describe('updateMenuItem', () => {
    it('should update an existing menu item successfully', async () => {
      // Arrange
      const existingItem = mockMenuItems[0]
      const updatedItem = { ...existingItem, name: 'Updated Dashboard' }
      const updateData: UpdateMenuItemData = { name: 'Updated Dashboard' }
      
      // Set initial state
      useMenuItemsStore.setState({ menuItems: [existingItem] })
      
      vi.mocked(menuItemsRepoSupabase.update).mockResolvedValue(updatedItem)
      
      const { updateMenuItem } = useMenuItemsStore.getState()

      // Act
      const result = await updateMenuItem(existingItem.id, updateData)

      // Assert
      expect(result).toEqual(updatedItem)
      expect(menuItemsRepoSupabase.update).toHaveBeenCalledWith(existingItem.id, updateData)
      
      const state = useMenuItemsStore.getState()
      expect(state.menuItems[0]).toEqual(updatedItem)
    })

    it('should handle errors when updating menu item', async () => {
      // Arrange
      const errorMessage = 'Failed to update menu item'
      const updateData: UpdateMenuItemData = { name: 'Updated' }
      
      vi.mocked(menuItemsRepoSupabase.update).mockRejectedValue(new Error(errorMessage))
      
      const { updateMenuItem } = useMenuItemsStore.getState()

      // Act & Assert
      await expect(updateMenuItem('1', updateData)).rejects.toThrow(errorMessage)
      
      const state = useMenuItemsStore.getState()
      expect(state.error).toBe(errorMessage)
    })
  })

  describe('removeMenuItem', () => {
    it('should remove a menu item successfully', async () => {
      // Arrange
      const itemToRemove = mockMenuItems[0]
      
      // Set initial state
      useMenuItemsStore.setState({ menuItems: mockMenuItems })
      
      vi.mocked(menuItemsRepoSupabase.remove).mockResolvedValue(true)
      
      const { removeMenuItem } = useMenuItemsStore.getState()

      // Act
      const result = await removeMenuItem(itemToRemove.id)

      // Assert
      expect(result).toBe(true)
      expect(menuItemsRepoSupabase.remove).toHaveBeenCalledWith(itemToRemove.id)
      
      const state = useMenuItemsStore.getState()
      expect(state.menuItems).not.toContain(itemToRemove)
      expect(state.menuItems).toHaveLength(1)
    })

    it('should handle errors when removing menu item', async () => {
      // Arrange
      const errorMessage = 'Failed to remove menu item'
      
      vi.mocked(menuItemsRepoSupabase.remove).mockRejectedValue(new Error(errorMessage))
      
      const { removeMenuItem } = useMenuItemsStore.getState()

      // Act & Assert
      await expect(removeMenuItem('1')).rejects.toThrow(errorMessage)
      
      const state = useMenuItemsStore.getState()
      expect(state.error).toBe(errorMessage)
    })
  })
})