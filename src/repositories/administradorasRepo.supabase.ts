import { supabase } from "@/integrations/supabase/client"

export interface Administradora {
  id: string;
  nome: string;
  tipo: "Administradora" | "Contabilidade" | "Construtora" | "Advogado";
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAdministradoraData {
  nome: string;
  tipo: "Administradora" | "Contabilidade" | "Construtora" | "Advogado";
  ativo?: boolean;
}

export interface UpdateAdministradoraData {
  nome?: string;
  tipo?: "Administradora" | "Contabilidade" | "Construtora" | "Advogado";
  ativo?: boolean;
}

// Transform database record to Administradora type
const transformAdministradoraFromDB = (dbAdmin: any): Administradora => ({
  id: dbAdmin.id,
  nome: dbAdmin.nome,
  tipo: dbAdmin.tipo,
  ativo: dbAdmin.ativo,
  created_at: dbAdmin.created_at,
  updated_at: dbAdmin.updated_at
})

export const administradorasRepoSupabase = {
  async list(): Promise<Administradora[]> {
    const { data, error } = await supabase
      .from('omnia_administradoras' as any)
      .select('*')
      .order('nome')

    if (error) {
      throw error
    }

    return data?.map(transformAdministradoraFromDB) || []
  },

  async create(adminData: CreateAdministradoraData): Promise<Administradora> {
    const { data: newAdmin, error: createError } = await supabase
      .from('omnia_administradoras' as any)
      .insert({
        nome: adminData.nome,
        tipo: adminData.tipo,
        ativo: adminData.ativo ?? true
      })
      .select()
      .single() as any

    if (createError) {
      throw createError
    }

    return transformAdministradoraFromDB(newAdmin)
  },

  async update(id: string, data: UpdateAdministradoraData): Promise<Administradora | null> {
    const { data: updatedAdmin, error } = await supabase
      .from('omnia_administradoras' as any)
      .update({
        nome: data.nome,
        tipo: data.tipo,
        ativo: data.ativo
      })
      .eq('id', id)
      .select()
      .single() as any

    if (error) {
      throw error
    }

    return updatedAdmin ? transformAdministradoraFromDB(updatedAdmin) : null
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_administradoras' as any)
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return true
  },

  async getById(id: string): Promise<Administradora | null> {
    
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