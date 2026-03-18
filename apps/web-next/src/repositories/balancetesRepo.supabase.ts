import { supabase } from "@/integrations/supabase/client"
import { logger } from '../lib/logging'
import { protocolosRepoSupabase, type Protocolo } from './protocolosRepo.supabase'

export interface Balancete {
  id: string
  condominium_id: string
  condominium_name?: string
  received_at: string
  competencia: string
  volumes: number
  observations?: string | null
  status: string
  sent_at?: string | null
  protocolo_id?: string | null
  created_by?: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CreateBalanceteData {
  condominium_id: string
  received_at: string
  competencia: string
  volumes: number
  observations?: string | null
  created_by?: string | null
}

export interface UpdateBalanceteData {
  condominium_id?: string
  received_at?: string
  competencia?: string
  volumes?: number
  observations?: string | null
}

export const balancetesRepoSupabase = {
  async list(): Promise<Balancete[]> {
    logger.debug('Loading balancetes...')

    const { data, error } = await supabase
      .from('omnia_balancetes')
      .select('*, omnia_condominiums(name)')
      .order('received_at', { ascending: false })

    if (error) {
      logger.error('Error loading balancetes:', error)
      throw error
    }

    logger.debug('Loaded balancetes:', data)
    return (data || []).map((row: any) => ({
      id: row.id,
      condominium_id: row.condominium_id,
      condominium_name: row.omnia_condominiums?.name || '',
      received_at: row.received_at,
      competencia: row.competencia,
      volumes: row.volumes,
      observations: row.observations,
      status: row.status,
      sent_at: row.sent_at,
      protocolo_id: row.protocolo_id,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
  },

  async create(data: CreateBalanceteData): Promise<Balancete> {
    logger.debug('Creating balancete:', data)

    const insertData = {
      condominium_id: data.condominium_id,
      received_at: data.received_at,
      competencia: data.competencia,
      volumes: data.volumes,
      observations: data.observations,
      created_by: data.created_by,
    }
    logger.debug('Insert data:', insertData)

    const { data: newBalancete, error } = await supabase
      .from('omnia_balancetes')
      .insert(insertData)
      .select('*, omnia_condominiums(name)')
      .maybeSingle()

    if (error) {
      logger.error('Error creating balancete:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    logger.debug('Created balancete:', newBalancete)
    const row = newBalancete as any
    return {
      id: row.id,
      condominium_id: row.condominium_id,
      condominium_name: row.omnia_condominiums?.name || '',
      received_at: row.received_at,
      competencia: row.competencia,
      volumes: row.volumes,
      observations: row.observations,
      status: row.status,
      sent_at: row.sent_at,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  },

  async update(id: string, data: UpdateBalanceteData): Promise<Balancete | null> {
    logger.debug(`Updating balancete: ${id}`, data)

    const updateData: Record<string, any> = {}
    if (data.condominium_id !== undefined) updateData.condominium_id = data.condominium_id
    if (data.received_at !== undefined) updateData.received_at = data.received_at
    if (data.competencia !== undefined) updateData.competencia = data.competencia
    if (data.volumes !== undefined) updateData.volumes = data.volumes
    if (data.observations !== undefined) updateData.observations = data.observations

    const { data: updatedBalancete, error } = await supabase
      .from('omnia_balancetes')
      .update(updateData)
      .eq('id', id)
      .select('*, omnia_condominiums(name)')
      .single()

    if (error) {
      logger.error('Error updating balancete:', error)
      throw error
    }

    if (!updatedBalancete) return null
    logger.debug('Updated balancete:', updatedBalancete)
    const row = updatedBalancete as any
    return {
      id: row.id,
      condominium_id: row.condominium_id,
      condominium_name: row.omnia_condominiums?.name || '',
      received_at: row.received_at,
      competencia: row.competencia,
      volumes: row.volumes,
      observations: row.observations,
      status: row.status,
      sent_at: row.sent_at,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  },

  async remove(id: string): Promise<boolean> {
    logger.debug('Removing balancete:', id)

    const { error } = await supabase
      .from('omnia_balancetes')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error removing balancete:', error)
      throw error
    }

    logger.debug('Removed balancete:', id)
    return true
  },

  async getById(id: string): Promise<Balancete | null> {
    logger.debug('Getting balancete by id:', id)

    const { data, error } = await supabase
      .from('omnia_balancetes')
      .select('*, omnia_condominiums(name)')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('Error getting balancete:', error)
      return null
    }

    if (!data) return null
    logger.debug('Got balancete:', data)
    const row = data as any
    return {
      id: row.id,
      condominium_id: row.condominium_id,
      condominium_name: row.omnia_condominiums?.name || '',
      received_at: row.received_at,
      competencia: row.competencia,
      volumes: row.volumes,
      observations: row.observations,
      status: row.status,
      sent_at: row.sent_at,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  },

  async markAsSent(ids: string[], dataEnvio: string, createdBy?: string): Promise<{ protocolo: Protocolo; balancetes: Balancete[] }> {
    logger.debug('Marking balancetes as sent:', ids)

    // 1. Criar protocolo
    const protocolo = await protocolosRepoSupabase.create({
      data_envio: dataEnvio,
      quantidade_balancetes: ids.length,
      created_by: createdBy,
    })

    // 2. Atualizar balancetes com sent_at e protocolo_id
    const { data, error } = await supabase
      .from('omnia_balancetes')
      .update({ 
        sent_at: dataEnvio,
        protocolo_id: protocolo.id,
      } as any)
      .in('id', ids)
      .select('*, omnia_condominiums(name)')

    if (error) {
      logger.error('Error marking balancetes as sent:', error)
      throw error
    }

    logger.debug('Marked balancetes as sent:', data)
    const balancetes = (data || []).map((row: any) => ({
      id: row.id,
      condominium_id: row.condominium_id,
      condominium_name: row.omnia_condominiums?.name || '',
      received_at: row.received_at,
      competencia: row.competencia,
      volumes: row.volumes,
      observations: row.observations,
      status: row.status,
      sent_at: row.sent_at,
      protocolo_id: row.protocolo_id,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    return { protocolo, balancetes }
  },

  async getByProtocoloId(protocoloId: string): Promise<Balancete[]> {
    logger.debug('Getting balancetes by protocolo_id:', protocoloId)

    const { data, error } = await supabase
      .from('omnia_balancetes')
      .select('*, omnia_condominiums(name)')
      .eq('protocolo_id', protocoloId)
      .order('condominium_id')

    if (error) {
      logger.error('Error getting balancetes by protocolo_id:', error)
      throw error
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      condominium_id: row.condominium_id,
      condominium_name: row.omnia_condominiums?.name || '',
      received_at: row.received_at,
      competencia: row.competencia,
      volumes: row.volumes,
      observations: row.observations,
      status: row.status,
      sent_at: row.sent_at,
      protocolo_id: row.protocolo_id,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
  },
}
