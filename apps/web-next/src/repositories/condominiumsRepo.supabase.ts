import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client"
import { logger } from '../lib/logging';


export interface Condominium {
  id: string
  name: string
  address?: string | null
  administradora_id?: string | null
  ativo?: boolean | null
  created_at: string | null
  updated_at: string | null
}

// Transform database record to Condominium type
const transformCondominiumFromDB = (dbCondominium: any): Condominium => ({
  id: dbCondominium.id,
  name: dbCondominium.name,
  address: dbCondominium.address,
  administradora_id: dbCondominium.administradora_id,
  ativo: dbCondominium.ativo,
  created_at: dbCondominium.created_at,
  updated_at: dbCondominium.updated_at
})

export const condominiumsRepoSupabase = {
  async list(): Promise<Condominium[]> {
    logger.debug('Loading condominiums...')

    const fetchCondominiums = async () => {
      const { data, error } = await supabase
        .from('omnia_condominiums')
        .select('*')
        .order('name')

      if (error) {
        throw error
      }

      return data
    }

    try {
      const data = await fetchCondominiums()
      logger.debug('Loaded condominiums:', data)
      return data?.map(transformCondominiumFromDB) || []
    } catch (error) {
      // Enhanced error logging to capture Supabase error details
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        hint: (error as any)?.hint,
        details: (error as any)?.details,
        status: (error as any)?.status,
        statusCode: (error as any)?.statusCode,
      }
      logger.error('Error loading condominiums:', errorDetails)

      const isInvalidRefreshToken =
        error instanceof AuthApiError &&
        (error.message ?? '').toLowerCase().includes('refresh token')

      if (isInvalidRefreshToken) {
        logger.warn('Invalid refresh token while loading condominiums. Clearing local session and retrying.')
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch (signOutError) {
          logger.warn('Failed to clear local session after invalid refresh token (condominiums list)', signOutError)
        }

        const data = await fetchCondominiums()
        logger.debug('Loaded condominiums after clearing session:', data)
        return data?.map(transformCondominiumFromDB) || []
      }

      throw error
    }
  },

  async create(data: Omit<Condominium, 'id' | 'created_at' | 'updated_at'>): Promise<Condominium> {
    logger.debug('Creating condominium:', data)
    
    const { data: newCondominium, error } = await supabase
      .from('omnia_condominiums')
      .insert({
        name: data.name,
        address: data.address,
        administradora_id: data.administradora_id,
        ativo: data.ativo
      })
      .select('*')
      .single()

    if (error) {
      logger.error('Error creating condominium:', error)
      throw error
    }

    logger.debug('Created condominium:', newCondominium)
    return transformCondominiumFromDB(newCondominium)
  },

  async update(id: string, data: Partial<Omit<Condominium, 'id' | 'created_at' | 'updated_at'>>): Promise<Condominium | null> {
    logger.debug(`Updating condominium: ${id}`, data)
    
    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.address !== undefined) updateData.address = data.address
    if (data.administradora_id !== undefined) updateData.administradora_id = data.administradora_id
    if (data.ativo !== undefined) updateData.ativo = data.ativo
    
    const { data: updatedCondominium, error } = await supabase
      .from('omnia_condominiums')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      logger.error('Error updating condominium:', error)
      throw error
    }

    logger.debug('Updated condominium:', updatedCondominium)
    return updatedCondominium ? transformCondominiumFromDB(updatedCondominium) : null
  },

  async remove(id: string): Promise<boolean> {
    logger.debug('Removing condominium:', id)
    
    const { error } = await supabase
      .from('omnia_condominiums')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error removing condominium:', error)
      throw error
    }

    logger.debug('Removed condominium:', id)
    return true
  },

  async getById(id: string): Promise<Condominium | null> {
    logger.debug('Getting condominium by id:', id)
    
    const { data, error } = await supabase
      .from('omnia_condominiums')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('Error getting condominium:', error)
      return null
    }

    logger.debug('Got condominium:', data)
    return data ? transformCondominiumFromDB(data) : null
  },

}