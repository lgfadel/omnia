import { create } from 'zustand'
import { CrmLead, CrmComment, CrmAttachment, ViaCepResponse, crmLeadsRepo } from '@/repositories/crmLeadsRepo.supabase'
import { toast } from '@/hooks/use-toast'
import { logger } from '../lib/logging';


interface CrmLeadsState {
  leads: CrmLead[]
  comments: CrmComment[]
  attachments: CrmAttachment[]
  loading: boolean
  filters: {
    status?: CrmLead['status'] | string[]
    assignedTo?: string
    search?: string
  }
  
  // Pagination
  pagination: {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  
  // Actions
  fetchLeads: (page?: number, pageSize?: number) => Promise<void>
  fetchLeadById: (id: string) => Promise<CrmLead | null>
  createLead: (lead: Partial<CrmLead>) => Promise<void>
  updateLead: (id: string, updates: Partial<CrmLead>) => Promise<void>
  deleteLead: (id: string) => Promise<void>
  
  // Comments
  fetchComments: (leadId: string) => Promise<void>
  createComment: (comment: Partial<CrmComment>) => Promise<void>
  
  // Attachments
  fetchAttachments: (leadId: string) => Promise<void>
  
  // Filters
  setFilters: (filters: Partial<CrmLeadsState['filters']>) => void
  clearFilters: () => void
  
  // Pagination actions
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  
  // Address search
  searchAddress: (cep: string) => Promise<ViaCepResponse | null>
}

export const useCrmLeadsStore = create<CrmLeadsState>((set, get) => ({
  leads: [],
  comments: [],
  attachments: [],
  loading: false,
  filters: {},
  pagination: {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  },

  fetchLeads: async (page?: number, pageSize?: number) => {
    set({ loading: true })
    try {
      const { filters, pagination } = get()
      const currentPage = page || pagination.currentPage
      const currentPageSize = pageSize || pagination.pageSize
      
      let leads: CrmLead[] = await crmLeadsRepo.getAll()
      
      // Aplicar filtros sequencialmente
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          // Filtro múltiplo: inclui leads que tenham qualquer um dos status selecionados
          if (filters.status.length > 0) {
            leads = leads.filter(lead => filters.status!.includes(lead.status))
          }
        } else {
          // Filtro único: compatibilidade com implementação anterior
          leads = leads.filter(lead => lead.status === filters.status)
        }
      }
      
      if (filters.assignedTo) {
        leads = leads.filter(lead => {
          // Verifica se responsavel_negociacao é um objeto com id ou uma string
          if (typeof lead.responsavel_negociacao === 'object' && lead.responsavel_negociacao?.id) {
            return lead.responsavel_negociacao.id === filters.assignedTo
          } else if (typeof lead.responsavel_negociacao === 'string') {
            return lead.responsavel_negociacao === filters.assignedTo
          }
          return false
        })
      }
      
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase()
        leads = leads.filter(lead => 
          lead.cliente.toLowerCase().includes(searchTerm) ||
          lead.administradora_atual?.toLowerCase().includes(searchTerm) ||
          lead.observacoes?.toLowerCase().includes(searchTerm)
        )
      }

      // Aplicar paginação local
      const totalItems = leads.length
      const totalPages = Math.ceil(totalItems / currentPageSize)
      const startIndex = (currentPage - 1) * currentPageSize
      const endIndex = startIndex + currentPageSize
      const paginatedLeads = leads.slice(startIndex, endIndex)

      set({ 
        leads: paginatedLeads,
        pagination: {
          currentPage,
          pageSize: currentPageSize,
          totalItems,
          totalPages
        }
      })
    } catch (error) {
      logger.error('Erro ao carregar leads:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar leads',
        variant: 'destructive'
      })
    } finally {
      set({ loading: false })
    }
  },

  fetchLeadById: async (id: string) => {
    try {
      const lead = await crmLeadsRepo.getById(id)
      return lead
    } catch (error) {
      logger.error('Erro ao carregar lead:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar lead',
        variant: 'destructive'
      })
      return null
    }
  },

  createLead: async (leadData: Partial<CrmLead>) => {
    set({ loading: true })
    try {
      await crmLeadsRepo.create(leadData)
      toast({
        title: 'Sucesso',
        description: 'Lead criado com sucesso'
      })
      get().fetchLeads()
    } catch (error) {
      logger.error('Erro ao criar lead:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao criar lead',
        variant: 'destructive'
      })
    } finally {
      set({ loading: false })
    }
  },

  updateLead: async (id: string, updates: Partial<CrmLead>) => {
    try {
      await crmLeadsRepo.update(id, updates)
      toast({
        title: 'Sucesso',
        description: 'Lead atualizado com sucesso'
      })
      get().fetchLeads()
    } catch (error) {
      logger.error('Erro ao atualizar lead:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar lead',
        variant: 'destructive'
      })
    }
  },

  deleteLead: async (id: string) => {
    try {
      await crmLeadsRepo.delete(id)
      toast({
        title: 'Sucesso',
        description: 'Lead excluído com sucesso'
      })
      get().fetchLeads()
    } catch (error) {
      logger.error('Erro ao excluir lead:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao excluir lead',
        variant: 'destructive'
      })
    }
  },

  fetchComments: async (leadId: string) => {
    try {
      const comments = await crmLeadsRepo.getComments(leadId)
      set({ comments })
    } catch (error) {
      logger.error('Erro ao carregar comentários:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar comentários',
        variant: 'destructive'
      })
    }
  },

  createComment: async (commentData: Partial<CrmComment>) => {
    try {
      await crmLeadsRepo.createComment(commentData)
      if (commentData.lead_id) {
        get().fetchComments(commentData.lead_id)
      }
      toast({
        title: 'Sucesso',
        description: 'Comentário adicionado com sucesso'
      })
    } catch (error) {
      logger.error('Erro ao criar comentário:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao adicionar comentário',
        variant: 'destructive'
      })
    }
  },

  fetchAttachments: async (leadId: string) => {
    try {
      const attachments = await crmLeadsRepo.getAttachments(leadId)
      set({ attachments })
    } catch (error) {
      logger.error('Erro ao carregar anexos:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar anexos',
        variant: 'destructive'
      })
    }
  },

  setFilters: (newFilters: Partial<CrmLeadsState['filters']>) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }))
    get().fetchLeads()
  },

  clearFilters: () => {
    set({ filters: {} })
    get().fetchLeads()
  },

  setPage: (page: number) => {
    set(state => ({
      pagination: { ...state.pagination, currentPage: page }
    }))
    get().fetchLeads(page)
  },

  setPageSize: (pageSize: number) => {
    set(state => ({
      pagination: { ...state.pagination, pageSize, currentPage: 1 }
    }))
    get().fetchLeads(1, pageSize)
  },

  searchAddress: async (cep: string): Promise<ViaCepResponse | null> => {
    try {
      return await crmLeadsRepo.searchByCep(cep)
    } catch (error) {
      logger.error('Erro ao buscar endereço:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado ao buscar CEP'
      
      toast({
        title: 'Erro ao buscar CEP',
        description: errorMessage,
        variant: 'destructive'
      })
      throw error
    }
  }
}))