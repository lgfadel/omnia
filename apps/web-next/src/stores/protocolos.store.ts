import { create } from 'zustand'
import { protocolosRepoSupabase, type Protocolo } from '@/repositories/protocolosRepo.supabase'
import { balancetesRepoSupabase, type Balancete } from '@/repositories/balancetesRepo.supabase'
import { logger } from '@/lib/logging'
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler'

interface ProtocolosStore {
  protocolos: Protocolo[]
  loading: boolean
  error: string | null

  loadProtocolos: () => Promise<void>
  cancelarProtocolo: (id: string, canceladoPor?: string, motivo?: string) => Promise<Protocolo>
  getBalancetesDoProtocolo: (protocoloId: string) => Promise<Balancete[]>
  clearError: () => void
}

export const useProtocolosStore = create<ProtocolosStore>((set, get) => ({
  protocolos: [],
  loading: false,
  error: null,

  loadProtocolos: async () => {
    logger.debug('ProtocolosStore: Loading protocolos...')
    set({ loading: true, error: null })

    try {
      const protocolos = await protocolosRepoSupabase.list()
      set({ protocolos, loading: false })
      logger.debug('ProtocolosStore: Loaded protocolos:', protocolos.length)
    } catch (error) {
      logger.error('ProtocolosStore: Error loading protocolos:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('read', 'protocolos', 'omnia_protocolos')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  cancelarProtocolo: async (id: string, canceladoPor?: string, motivo?: string) => {
    logger.debug('ProtocolosStore: Canceling protocolo:', id)
    set({ loading: true, error: null })

    try {
      const protocolo = await protocolosRepoSupabase.cancelar(id, canceladoPor, motivo)
      
      // Atualiza a lista de protocolos
      const { protocolos } = get()
      const updatedList = protocolos.map(p => p.id === id ? protocolo : p)
      
      set({ protocolos: updatedList, loading: false })
      logger.debug('ProtocolosStore: Canceled protocolo successfully')
      return protocolo
    } catch (error) {
      logger.error('ProtocolosStore: Error canceling protocolo:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'protocolo', 'omnia_protocolos')
      )
      set({ error: treatedError.message, loading: false })
      throw error
    }
  },

  getBalancetesDoProtocolo: async (protocoloId: string) => {
    logger.debug('ProtocolosStore: Getting balancetes for protocolo:', protocoloId)

    try {
      const balancetes = await balancetesRepoSupabase.getByProtocoloId(protocoloId)
      logger.debug('ProtocolosStore: Got balancetes:', balancetes.length)
      return balancetes
    } catch (error) {
      logger.error('ProtocolosStore: Error getting balancetes:', error)
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
