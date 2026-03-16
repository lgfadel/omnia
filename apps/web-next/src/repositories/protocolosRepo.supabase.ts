import { supabase } from '@/integrations/supabase/client'
import { logger } from '../lib/logging'

export interface Protocolo {
  id: string
  numero: number
  data_envio: string
  quantidade_balancetes: number
  cancelado: boolean
  cancelado_em?: string | null
  cancelado_por?: string | null
  motivo_cancelamento?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface CreateProtocoloData {
  data_envio?: string
  quantidade_balancetes: number
  created_by?: string
}

// Type assertion para tabela não tipada ainda no Supabase
const protocolosTable = () => supabase.from('omnia_protocolos' as any)

export const protocolosRepoSupabase = {
  async list(): Promise<Protocolo[]> {
    logger.debug('Listing protocolos')

    const { data, error } = await protocolosTable()
      .select('*')
      .order('numero', { ascending: false })

    if (error) {
      logger.error('Error listing protocolos:', error)
      throw error
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      numero: row.numero,
      data_envio: row.data_envio,
      quantidade_balancetes: row.quantidade_balancetes,
      cancelado: row.cancelado || false,
      cancelado_em: row.cancelado_em,
      cancelado_por: row.cancelado_por,
      motivo_cancelamento: row.motivo_cancelamento,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
  },

  async getById(id: string): Promise<Protocolo | null> {
    logger.debug('Getting protocolo by id:', id)

    const { data, error } = await protocolosTable()
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('Error getting protocolo:', error)
      return null
    }

    if (!data) return null
    const row = data as any

    return {
      id: row.id,
      numero: row.numero,
      data_envio: row.data_envio,
      quantidade_balancetes: row.quantidade_balancetes,
      cancelado: row.cancelado || false,
      cancelado_em: row.cancelado_em,
      cancelado_por: row.cancelado_por,
      motivo_cancelamento: row.motivo_cancelamento,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  },

  async create(data: CreateProtocoloData): Promise<Protocolo> {
    logger.debug('Creating protocolo:', data)

    const { data: created, error } = await protocolosTable()
      .insert({
        data_envio: data.data_envio || new Date().toISOString().split('T')[0],
        quantidade_balancetes: data.quantidade_balancetes,
        created_by: data.created_by,
      } as any)
      .select()
      .single()

    if (error) {
      logger.error('Error creating protocolo:', error)
      throw error
    }

    logger.debug('Created protocolo:', created)
    const row = created as any
    return {
      id: row.id,
      numero: row.numero,
      data_envio: row.data_envio,
      quantidade_balancetes: row.quantidade_balancetes,
      cancelado: row.cancelado || false,
      cancelado_em: row.cancelado_em,
      cancelado_por: row.cancelado_por,
      motivo_cancelamento: row.motivo_cancelamento,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  },

  async cancelar(id: string, canceladoPor?: string, motivo?: string): Promise<Protocolo> {
    logger.debug('Canceling protocolo:', id)

    const { data, error } = await protocolosTable()
      .update({
        cancelado: true,
        cancelado_em: new Date().toISOString(),
        cancelado_por: canceladoPor,
        motivo_cancelamento: motivo || null,
      } as any)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('Error canceling protocolo:', error)
      throw error
    }

    // Limpar sent_at e protocolo_id dos balancetes associados
    const { error: balancetesError } = await supabase
      .from('omnia_balancetes')
      .update({
        sent_at: null,
        protocolo_id: null,
      } as any)
      .eq('protocolo_id', id)

    if (balancetesError) {
      logger.error('Error clearing balancetes from protocolo:', balancetesError)
      throw balancetesError
    }

    logger.debug('Canceled protocolo:', data)
    const row = data as any
    return {
      id: row.id,
      numero: row.numero,
      data_envio: row.data_envio,
      quantidade_balancetes: row.quantidade_balancetes,
      cancelado: row.cancelado || false,
      cancelado_em: row.cancelado_em,
      cancelado_por: row.cancelado_por,
      motivo_cancelamento: row.motivo_cancelamento,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  },
}
