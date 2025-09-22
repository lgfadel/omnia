import { supabase } from "@/integrations/supabase/client"

// Interface para Origem do Lead
export interface CrmOrigem {
  id: string
  name: string
  color: string
  isDefault: boolean
}

// Transform database record to CrmOrigem type
const transformCrmOrigemFromDB = (dbOrigem: any): CrmOrigem => ({
  id: dbOrigem.id,
  name: dbOrigem.name,
  color: dbOrigem.color,
  isDefault: dbOrigem.is_default
})

export const crmOrigensRepoSupabase = {
  async list(): Promise<CrmOrigem[]> {
    console.log('Loading CRM origens from database...')
    
    const { data, error } = await supabase
      .from('omnia_crm_origens' as any)
      .select('*')
      .order('name')

    if (error) {
      console.error('Error loading CRM origens:', error)
      throw error
    }

    console.log('Loaded CRM origens:', data)
    return data?.map(transformCrmOrigemFromDB) || []
  },

  async create(origemData: Omit<CrmOrigem, 'id'>): Promise<CrmOrigem> {
    console.log('Creating CRM origem:', origemData)
    
    const { data: newOrigem, error: createError } = await supabase
      .from('omnia_crm_origens' as any)
      .insert({
        name: origemData.name,
        color: origemData.color,
        is_default: origemData.isDefault || false
      })
      .select('*')
      .single()

    if (createError) {
      console.error('Error creating CRM origem:', createError)
      throw createError
    }

    console.log('Created CRM origem:', newOrigem)
    return transformCrmOrigemFromDB(newOrigem)
  },

  async update(id: string, data: Partial<Omit<CrmOrigem, 'id'>>): Promise<CrmOrigem | null> {
    console.log('Updating CRM origem:', id, data)
    
    const updateData: any = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.color !== undefined) updateData.color = data.color
    if (data.isDefault !== undefined) updateData.is_default = data.isDefault

    const { data: updatedOrigem, error } = await supabase
      .from('omnia_crm_origens' as any)
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating CRM origem:', error)
      if (error.code === 'PGRST116') return null
      throw error
    }

    console.log('Updated CRM origem:', updatedOrigem)
    return transformCrmOrigemFromDB(updatedOrigem)
  },

  async remove(id: string): Promise<boolean> {
    console.log('Removing CRM origem:', id)
    
    const { error } = await supabase
      .from('omnia_crm_origens' as any)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error removing CRM origem:', error)
      throw error
    }

    console.log('Removed CRM origem:', id)
    return true
  },

  async getDefault(): Promise<CrmOrigem | null> {
    console.log('Getting default CRM origem...')
    
    const { data, error } = await supabase
      .from('omnia_crm_origens' as any)
      .select('*')
      .eq('is_default', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('Error getting default CRM origem:', error)
      throw error
    }

    return transformCrmOrigemFromDB(data)
  }
}