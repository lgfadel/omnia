import { AuthApiError, type PostgrestError } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client"
import type { Tables, TablesUpdate } from '@/integrations/supabase/db-types'
import { logger } from '../lib/logging';


export interface Condominium {
  id: string
  name: string
  address?: string | null
  cnpj?: string | null
  manager_name?: string | null
  phone?: string | null
  syndic_name?: string | null
  whatsapp?: string | null
  created_by?: string | null
  created_at: string | null
  updated_at: string | null
}

// Transform database record to Condominium type
const transformCondominiumFromDB = (dbCondominium: Tables<'omnia_condominiums'>): Condominium => ({
  id: dbCondominium.id,
  name: dbCondominium.name,
  address: dbCondominium.address,
  cnpj: dbCondominium.cnpj,
  manager_name: dbCondominium.manager_name,
  phone: dbCondominium.phone,
  syndic_name: dbCondominium.syndic_name,
  whatsapp: dbCondominium.whatsapp,
  created_by: dbCondominium.created_by,
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
      const pgError = error as PostgrestError
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        code: pgError?.code,
        hint: pgError?.hint,
        details: pgError?.details,
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
    
    const updateData: TablesUpdate<'omnia_condominiums'> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.address !== undefined) updateData.address = data.address
    if (data.cnpj !== undefined) updateData.cnpj = data.cnpj
    if (data.manager_name !== undefined) updateData.manager_name = data.manager_name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.syndic_name !== undefined) updateData.syndic_name = data.syndic_name
    if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp
    
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