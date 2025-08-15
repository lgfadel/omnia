
import { supabase } from "@/integrations/supabase/client"
import { Status } from "@/data/fixtures"

// Transform database record to Status type
const transformStatusFromDB = (dbStatus: any): Status => ({
  id: dbStatus.id,
  name: dbStatus.name,
  color: dbStatus.color,
  order: dbStatus.order_position,
  isDefault: dbStatus.is_default
})

export const statusRepoSupabase = {
  async list(): Promise<Status[]> {
    console.log('Loading statuses from database...')
    
    const { data, error } = await supabase
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    if (error) {
      console.error('Error loading statuses:', error)
      throw error
    }

    console.log('Loaded statuses:', data)
    return data?.map(transformStatusFromDB) || []
  },

  async create(data: Omit<Status, 'id'>): Promise<Status> {
    console.log('Creating status:', data)
    
    // Get the next order position
    const { data: maxOrderData } = await supabase
      .from('omnia_statuses')
      .select('order_position')
      .order('order_position', { ascending: false })
      .limit(1)

    const nextOrder = maxOrderData && maxOrderData.length > 0 
      ? maxOrderData[0].order_position + 1 
      : 1

    const { data: newStatus, error } = await supabase
      .from('omnia_statuses')
      .insert({
        name: data.name,
        color: data.color,
        order_position: data.order || nextOrder,
        is_default: data.isDefault || false
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating status:', error)
      throw error
    }

    console.log('Created status:', newStatus)
    return transformStatusFromDB(newStatus)
  },

  async update(id: string, data: Partial<Omit<Status, 'id'>>): Promise<Status | null> {
    console.log('Updating status:', id, data)
    
    const updateData: any = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.color !== undefined) updateData.color = data.color
    if (data.order !== undefined) updateData.order_position = data.order
    if (data.isDefault !== undefined) updateData.is_default = data.isDefault

    const { data: updatedStatus, error } = await supabase
      .from('omnia_statuses')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating status:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    console.log('Updated status:', updatedStatus)
    return transformStatusFromDB(updatedStatus)
  },

  async remove(id: string): Promise<boolean> {
    console.log('Removing status:', id)
    
    const { error } = await supabase
      .from('omnia_statuses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error removing status:', error)
      throw error
    }

    console.log('Removed status successfully')
    return true
  },

  async reorder(statuses: Status[]): Promise<void> {
    console.log('Reordering statuses:', statuses)
    
    // Update each status order individually
    for (let i = 0; i < statuses.length; i++) {
      const { error } = await supabase
        .from('omnia_statuses')
        .update({ order_position: i + 1 })
        .eq('id', statuses[i].id)
      
      if (error) {
        console.error('Error reordering status:', error)
        throw error
      }
    }
    
    console.log('Reordered statuses successfully')
  }
}
