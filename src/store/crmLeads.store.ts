import { create } from 'zustand'
import { CrmLead, CrmComment, CrmAttachment, crmLeadsRepo } from '@/repositories/crmLeadsRepo.supabase'
import { toast } from '@/hooks/use-toast'

interface CrmLeadsState {
  leads: CrmLead[]
  comments: CrmComment[]
  attachments: CrmAttachment[]
  loading: boolean
  filters: {
    status?: CrmLead['status']
    assignedTo?: string
    search?: string
  }
  
  // Actions
  fetchLeads: () => Promise<void>
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
  
  // Address search
  searchAddress: (cep: string) => Promise<any>
}

export const useCrmLeadsStore = create<CrmLeadsState>((set, get) => ({
  leads: [],
  comments: [],
  attachments: [],
  loading: false,
  filters: {},

  fetchLeads: async () => {
    set({ loading: true })
    try {
      const { filters } = get()
      let leads: CrmLead[]

      if (filters.status) {
        leads = await crmLeadsRepo.filterByStatus(filters.status)
      } else if (filters.assignedTo) {
        leads = await crmLeadsRepo.filterByAssignedUser(filters.assignedTo)
      } else if (filters.search) {
        leads = await crmLeadsRepo.searchByCompany(filters.search)
      } else {
        leads = await crmLeadsRepo.getAll()
      }

      set({ leads })
    } catch (error) {
      console.error('Erro ao carregar leads:', error)
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
      console.error('Erro ao carregar lead:', error)
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
      console.error('Erro ao criar lead:', error)
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
      console.error('Erro ao atualizar lead:', error)
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
      console.error('Erro ao excluir lead:', error)
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
      console.error('Erro ao carregar comentários:', error)
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
      console.error('Erro ao criar comentário:', error)
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
      console.error('Erro ao carregar anexos:', error)
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

  searchAddress: async (cep: string) => {
    try {
      return await crmLeadsRepo.searchByCep(cep)
    } catch (error) {
      console.error('Erro ao buscar endereço:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao buscar endereço pelo CEP',
        variant: 'destructive'
      })
      throw error
    }
  }
}))