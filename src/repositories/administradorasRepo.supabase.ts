import { supabase } from "@/integrations/supabase/client"

export interface Administradora {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAdministradoraData {
  nome: string;
  ativo?: boolean;
}

export interface UpdateAdministradoraData {
  nome?: string;
  ativo?: boolean;
}

// Transform database record to Administradora type
const transformAdministradoraFromDB = (dbAdmin: any): Administradora => ({
  id: dbAdmin.id,
  nome: dbAdmin.nome,
  ativo: dbAdmin.ativo,
  created_at: dbAdmin.created_at,
  updated_at: dbAdmin.updated_at
})

export const administradorasRepoSupabase = {
  async list(): Promise<Administradora[]> {
    console.log('Loading administradoras from database...')
    
    const { data, error } = await supabase
      .from('omnia_administradoras' as any)
      .select('*')
      .order('nome')

    if (error) {
      console.error('Error loading administradoras:', error)
      throw error
    }

    console.log('Loaded administradoras:', data)
    return data?.map(transformAdministradoraFromDB) || []
  },

  async create(adminData: CreateAdministradoraData): Promise<Administradora> {
    console.log('Creating administradora:', adminData)
    
    const { data: newAdmin, error: createError } = await supabase
      .from('omnia_administradoras' as any)
      .insert({
        nome: adminData.nome,
        ativo: adminData.ativo ?? true
      })
      .select()
      .single() as any

    if (createError) {
      console.error('Error creating administradora:', createError)
      throw createError
    }

    console.log('Created administradora:', newAdmin)
    return transformAdministradoraFromDB(newAdmin)
  },

  async update(id: string, data: UpdateAdministradoraData): Promise<Administradora | null> {
    console.log('Updating administradora:', id, data)
    
    const { data: updatedAdmin, error } = await supabase
      .from('omnia_administradoras' as any)
      .update({
        nome: data.nome,
        ativo: data.ativo
      })
      .eq('id', id)
      .select()
      .single() as any

    if (error) {
      console.error('Error updating administradora:', error)
      throw error
    }

    console.log('Updated administradora:', updatedAdmin)
    return updatedAdmin ? transformAdministradoraFromDB(updatedAdmin) : null
  },

  async remove(id: string): Promise<boolean> {
    console.log('Removing administradora:', id)
    
    const { error } = await supabase
      .from('omnia_administradoras' as any)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error removing administradora:', error)
      throw error
    }

    console.log('Removed administradora:', id)
    return true
  },

  async getById(id: string): Promise<Administradora | null> {
    console.log('Getting administradora by id:', id)
    
    const { data, error } = await supabase
      .from('omnia_administradoras' as any)
      .select('*')
      .eq('id', id)
      .single() as any

    if (error) {
      console.error('Error getting administradora:', error)
      return null
    }

    return data ? transformAdministradoraFromDB(data) : null
  }
}