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
    const { data, error } = await supabase
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    if (error) throw error

    return data?.map(transformStatusFromDB) || []
  },

  async create(data: Omit<Status, 'id'>): Promise<Status> {
    const { data: newStatus, error } = await supabase
      .from('omnia_statuses')
      .insert({
        name: data.name,
        color: data.color,
        order_position: data.order,
        is_default: data.isDefault || false
      })
      .select('*')
      .single()

    if (error) throw error

    return transformStatusFromDB(newStatus)
  },

  async update(id: string, data: Partial<Omit<Status, 'id'>>): Promise<Status | null> {
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
      if (error.code === 'PGRST116') return null
      throw error
    }

    return transformStatusFromDB(updatedStatus)
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_statuses')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  async reorder(statuses: Status[]): Promise<void> {
    // Update each status order individually
    for (let i = 0; i < statuses.length; i++) {
      const { error } = await supabase
        .from('omnia_statuses')
        .update({ order_position: i + 1 })
        .eq('id', statuses[i].id)
      
      if (error) throw error
    }
  }
}