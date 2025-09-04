import { supabase } from "@/integrations/supabase/client"

export interface Condominium {
  id: string
  name: string
  cnpj?: string
  address?: string
  phone?: string
  whatsapp?: string
  syndic_name?: string
  manager_name?: string
  created_at: string
  updated_at: string
  created_by?: string
}

// Transform database record to Condominium type
const transformCondominiumFromDB = (dbCondominium: any): Condominium => ({
  id: dbCondominium.id,
  name: dbCondominium.name,
  cnpj: dbCondominium.cnpj,
  address: dbCondominium.address,
  phone: dbCondominium.phone,
  whatsapp: dbCondominium.whatsapp,
  syndic_name: dbCondominium.syndic_name,
  manager_name: dbCondominium.manager_name,
  created_at: dbCondominium.created_at,
  updated_at: dbCondominium.updated_at,
  created_by: dbCondominium.created_by
})

export const condominiumsRepoSupabase = {
  async list(): Promise<Condominium[]> {
    console.log('Loading condominiums...')
    
    const { data, error } = await supabase
      .from('omnia_condominiums')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error loading condominiums:', error)
      throw error
    }

    console.log('Loaded condominiums:', data)
    return data?.map(transformCondominiumFromDB) || []
  },

  async create(data: Omit<Condominium, 'id' | 'created_at' | 'updated_at'>): Promise<Condominium> {
    console.log('Creating condominium:', data)
    
    const { data: newCondominium, error } = await supabase
      .from('omnia_condominiums')
      .insert({
        name: data.name,
        cnpj: data.cnpj,
        address: data.address,
        phone: data.phone,
        whatsapp: data.whatsapp,
        syndic_name: data.syndic_name,
        manager_name: data.manager_name,
        created_by: data.created_by
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating condominium:', error)
      throw error
    }

    console.log('Created condominium:', newCondominium)
    return transformCondominiumFromDB(newCondominium)
  },

  async update(id: string, data: Partial<Omit<Condominium, 'id' | 'created_at' | 'updated_at'>>): Promise<Condominium | null> {
    console.log('Updating condominium:', id, data)
    
    const { data: updatedCondominium, error } = await supabase
      .from('omnia_condominiums')
      .update({
        name: data.name,
        cnpj: data.cnpj,
        address: data.address,
        phone: data.phone,
        whatsapp: data.whatsapp,
        syndic_name: data.syndic_name,
        manager_name: data.manager_name
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating condominium:', error)
      throw error
    }

    console.log('Updated condominium:', updatedCondominium)
    return updatedCondominium ? transformCondominiumFromDB(updatedCondominium) : null
  },

  async remove(id: string): Promise<boolean> {
    console.log('Removing condominium:', id)
    
    const { error } = await supabase
      .from('omnia_condominiums')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error removing condominium:', error)
      throw error
    }

    console.log('Removed condominium:', id)
    return true
  },

  async getById(id: string): Promise<Condominium | null> {
    console.log('Getting condominium by id:', id)
    
    const { data, error } = await supabase
      .from('omnia_condominiums')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error getting condominium:', error)
      return null
    }

    console.log('Got condominium:', data)
    return data ? transformCondominiumFromDB(data) : null
  },

  async checkCnpjExists(cnpj: string, excludeId?: string): Promise<boolean> {
    console.log('Checking if CNPJ exists:', cnpj)
    
    let query = supabase
      .from('omnia_condominiums')
      .select('id')
      .eq('cnpj', cnpj)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error checking CNPJ:', error)
      throw error
    }

    return (data?.length || 0) > 0
  }
}