import { supabase } from "@/integrations/supabase/client"

export interface MenuItem {
  id: string
  name: string
  path: string
  icon?: string
  parent_id?: string | null
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateMenuItemData {
  name: string
  path: string
  icon?: string
  parent_id?: string | null
  order_index?: number
  is_active?: boolean
}

export interface UpdateMenuItemData {
  name?: string
  path?: string
  icon?: string
  parent_id?: string | null
  order_index?: number
  is_active?: boolean
}

// Transform database record to MenuItem type
const transformMenuItemFromDB = (dbMenuItem: any): MenuItem => ({
  id: dbMenuItem.id,
  name: dbMenuItem.name,
  path: dbMenuItem.path,
  icon: dbMenuItem.icon,
  parent_id: dbMenuItem.parent_id,
  order_index: dbMenuItem.order_index,
  is_active: dbMenuItem.is_active,
  created_at: dbMenuItem.created_at,
  updated_at: dbMenuItem.updated_at
})

export const menuItemsRepoSupabase = {
  async list(): Promise<MenuItem[]> {
    console.log('Loading menu items from database...')
    
    const { data, error } = await supabase
      .from('omnia_menu_items')
      .select('*')
      .eq('is_active', true)
      .order('order_index')

    if (error) {
      console.error('Error loading menu items:', error)
      throw error
    }

    console.log('Loaded menu items:', data)
    return data?.map(transformMenuItemFromDB) || []
  },

  async listAll(): Promise<MenuItem[]> {
    console.log('Loading all menu items from database...')
    
    const { data, error } = await supabase
      .from('omnia_menu_items')
      .select('*')
      .order('order_index')

    if (error) {
      console.error('Error loading all menu items:', error)
      throw error
    }

    console.log('Loaded all menu items:', data)
    return data?.map(transformMenuItemFromDB) || []
  },

  async getById(id: string): Promise<MenuItem | null> {
    console.log('Loading menu item by id:', id)
    
    const { data, error } = await supabase
      .from('omnia_menu_items')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error loading menu item:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    return transformMenuItemFromDB(data)
  },

  async getByPath(path: string): Promise<MenuItem | null> {
    console.log('Loading menu item by path:', path)
    
    const { data, error } = await supabase
      .from('omnia_menu_items')
      .select('*')
      .eq('path', path)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Error loading menu item by path:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    return transformMenuItemFromDB(data)
  },

  async getChildren(parentId: string): Promise<MenuItem[]> {
    console.log('Loading menu item children:', parentId)
    
    const { data, error } = await supabase
      .from('omnia_menu_items')
      .select('*')
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('order_index')

    if (error) {
      console.error('Error loading menu item children:', error)
      throw error
    }

    return data?.map(transformMenuItemFromDB) || []
  },

  async getRootItems(): Promise<MenuItem[]> {
    console.log('Loading root menu items...')
    
    const { data, error } = await supabase
      .from('omnia_menu_items')
      .select('*')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('order_index')

    if (error) {
      console.error('Error loading root menu items:', error)
      throw error
    }

    return data?.map(transformMenuItemFromDB) || []
  },

  async create(menuItemData: CreateMenuItemData): Promise<MenuItem> {
    console.log('Creating menu item:', menuItemData)
    
    // Get the next order index if not provided
    let orderIndex = menuItemData.order_index
    if (orderIndex === undefined) {
      const { data: orderData, error: orderError } = await supabase
        .from('omnia_menu_items')
        .select('order_index')
        .order('order_index', { ascending: false })
        .limit(1)

      if (orderError) {
        console.error('Error getting next order index:', orderError)
        throw orderError
      }

      orderIndex = orderData && orderData.length > 0 
        ? orderData[0].order_index + 1 
        : 1
    }

    const { data: newMenuItem, error: createError } = await supabase
      .from('omnia_menu_items')
      .insert({
        name: menuItemData.name,
        path: menuItemData.path,
        icon: menuItemData.icon,
        parent_id: menuItemData.parent_id,
        order_index: orderIndex,
        is_active: menuItemData.is_active ?? true
      })
      .select('*')
      .single()

    if (createError) {
      console.error('Error creating menu item:', createError)
      throw createError
    }

    console.log('Created menu item:', newMenuItem)
    return transformMenuItemFromDB(newMenuItem)
  },

  async update(id: string, data: UpdateMenuItemData): Promise<MenuItem | null> {
    console.log('Updating menu item:', id, data)
    
    const updateData: any = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.path !== undefined) updateData.path = data.path
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.parent_id !== undefined) updateData.parent_id = data.parent_id
    if (data.order_index !== undefined) updateData.order_index = data.order_index
    if (data.is_active !== undefined) updateData.is_active = data.is_active

    const { data: updatedMenuItem, error } = await supabase
      .from('omnia_menu_items')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating menu item:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    console.log('Updated menu item:', updatedMenuItem)
    return transformMenuItemFromDB(updatedMenuItem)
  },

  async remove(id: string): Promise<boolean> {
    console.log('Removing menu item:', id)
    
    const { error } = await supabase
      .from('omnia_menu_items')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error removing menu item:', error)
      throw error
    }

    console.log('Removed menu item successfully')
    return true
  },

  async reorder(menuItems: MenuItem[]): Promise<void> {
    console.log('Reordering menu items:', menuItems)
    
    // Update each menu item order individually
    for (let i = 0; i < menuItems.length; i++) {
      const { error } = await supabase
        .from('omnia_menu_items')
        .update({ order_index: i + 1 })
        .eq('id', menuItems[i].id)
      
      if (error) {
        console.error('Error reordering menu item:', error)
        throw error
      }
    }
    
    console.log('Reordered menu items successfully')
  }
}