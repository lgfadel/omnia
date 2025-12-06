import { supabase } from "@/integrations/supabase/client"
import { Status } from "@/data/types"
import { logger } from '../lib/logging';


// Transform database record to Status type
const transformCrmStatusFromDB = (dbStatus: any): Status => ({
  id: dbStatus.id,
  name: dbStatus.name,
  color: dbStatus.color,
  order: dbStatus.order_position,
  isDefault: dbStatus.is_default
})

export const crmStatusRepoSupabase = {
  async list(): Promise<Status[]> {
    logger.debug('Loading CRM statuses from database...')
    
    const { data, error } = await supabase
      .from('omnia_crm_statuses' as any)
      .select('*')
      .order('order_position')

    if (error) {
      logger.error('Error loading CRM statuses:', error)
      throw error
    }

    logger.debug('Loaded CRM statuses:', data)
    return data?.map(transformCrmStatusFromDB) || []
  },

  async create(statusData: Omit<Status, 'id'>): Promise<Status> {
    logger.debug('Creating CRM status:', statusData)
    
    // Get the next order position
    const { data: orderData, error: orderError } = await supabase
      .from('omnia_crm_statuses' as any)
      .select('order_position')
      .order('order_position', { ascending: false })
      .limit(1) as any

    const nextOrder = orderData && orderData.length > 0 
      ? orderData[0].order_position + 1 
      : 1

    const { data: newStatus, error: createError } = await supabase
      .from('omnia_crm_statuses' as any)
      .insert({
        name: statusData.name,
        color: statusData.color,
        order_position: statusData.order || nextOrder,
        is_default: statusData.isDefault || false
      })
      .select('*')
      .single()

    if (createError) {
      logger.error('Error creating CRM status:', createError)
      throw createError
    }

    logger.debug('Created CRM status:', newStatus)
    return transformCrmStatusFromDB(newStatus)
  },

  async update(id: string, data: Partial<Omit<Status, 'id'>>): Promise<Status | null> {
    logger.debug(`Updating CRM status: ${id}`, data)
    
    const updateData: any = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.color !== undefined) updateData.color = data.color
    if (data.order !== undefined) updateData.order_position = data.order
    if (data.isDefault !== undefined) updateData.is_default = data.isDefault

    const { data: updatedStatus, error } = await supabase
      .from('omnia_crm_statuses' as any)
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      logger.error('Error updating CRM status:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    logger.debug('Updated CRM status:', updatedStatus)
    return transformCrmStatusFromDB(updatedStatus)
  },

  async remove(id: string): Promise<boolean> {
    logger.debug('Removing CRM status:', id)
    
    const { error } = await supabase
      .from('omnia_crm_statuses' as any)
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error removing CRM status:', error)
      throw error
    }

    logger.debug('Removed CRM status successfully')
    return true
  },

  async reorder(statuses: Status[]): Promise<void> {
    logger.debug('Reordering CRM statuses:', statuses)
    
    // Update each status order individually
    for (let i = 0; i < statuses.length; i++) {
      const { error } = await supabase
        .from('omnia_crm_statuses' as any)
        .update({ order_position: i + 1 })
        .eq('id', statuses[i].id)
      
      if (error) {
        logger.error('Error reordering CRM status:', error)
        throw error
      }
    }
    
    logger.debug('Reordered CRM statuses successfully')
  }
}