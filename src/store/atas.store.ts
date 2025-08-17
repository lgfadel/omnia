
import { create } from 'zustand'
import { Ata, Status, Comment, Attachment } from '@/data/fixtures'
import { atasRepoSupabase } from '@/repositories/atasRepo.supabase'

interface AtasStore {
  atas: Ata[]
  statuses: Status[]
  loading: boolean
  error: string | null
  
  // Actions
  loadAtas: (search?: string, statusFilter?: string[]) => Promise<void>
  loadStatuses: () => Promise<void>
  getAtaById: (id: string) => Promise<Ata | null>
  createAta: (data: Omit<Ata, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>) => Promise<Ata>
  updateAta: (id: string, data: Partial<Omit<Ata, 'id' | 'createdAt'>>) => Promise<Ata | null>
  deleteAta: (id: string) => Promise<boolean>
  addComment: (ataId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => Promise<Comment | null>
  addAttachment: (ataId: string, attachment: Omit<Attachment, 'id' | 'createdAt'>) => Promise<Attachment | null>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  clearError: () => void
}

export const useAtasStore = create<AtasStore>((set, get) => ({
  atas: [],
  statuses: [],
  loading: false,
  error: null,

  loadAtas: async (search?: string, statusFilter?: string[]) => {
    console.log('AtasStore: Loading atas with search:', search, 'statusFilter:', statusFilter)
    set({ loading: true, error: null })
    
    try {
      const atas = await atasRepoSupabase.list(search, statusFilter)
      console.log('AtasStore: Loaded atas:', atas)
      set({ atas, loading: false })
    } catch (error) {
      console.error('AtasStore: Error loading atas:', error)
      set({ error: 'Erro ao carregar atas', loading: false })
    }
  },

  loadStatuses: async () => {
    console.log('AtasStore: Loading statuses...')
    
    try {
      const statuses = await atasRepoSupabase.getStatuses()
      console.log('AtasStore: Loaded statuses:', statuses)
      set({ statuses })
    } catch (error) {
      console.error('AtasStore: Error loading statuses:', error)
      set({ error: 'Erro ao carregar status' })
    }
  },

  getAtaById: async (id: string) => {
    console.log('AtasStore: Getting ata by id:', id)
    set({ loading: true, error: null })
    
    try {
      const ata = await atasRepoSupabase.getById(id)
      console.log('AtasStore: Got ata:', ata)
      set({ loading: false })
      return ata
    } catch (error) {
      console.error('AtasStore: Error getting ata:', error)
      set({ error: 'Erro ao carregar ata', loading: false })
      return null
    }
  },

  createAta: async (data) => {
    console.log('AtasStore: Creating ata:', data)
    set({ loading: true, error: null })
    
    try {
      const newAta = await atasRepoSupabase.create(data)
      const { atas } = get()
      set({ atas: [newAta, ...atas], loading: false })
      console.log('AtasStore: Created ata successfully')
      return newAta
    } catch (error) {
      console.error('AtasStore: Error creating ata:', error)
      set({ error: 'Erro ao criar ata', loading: false })
      throw error
    }
  },

  updateAta: async (id: string, data) => {
    console.log('AtasStore: Updating ata:', id, data)
    set({ loading: true, error: null })
    
    try {
      const updatedAta = await atasRepoSupabase.update(id, data)
      if (updatedAta) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => ata.id === id ? updatedAta : ata)
        set({ atas: updatedAtas, loading: false })
        console.log('AtasStore: Updated ata successfully')
      }
      return updatedAta
    } catch (error) {
      console.error('AtasStore: Error updating ata:', error)
      set({ error: 'Erro ao atualizar ata', loading: false })
      return null
    }
  },

  deleteAta: async (id: string) => {
    console.log('AtasStore: Deleting ata:', id)
    set({ loading: true, error: null })
    
    try {
      const success = await atasRepoSupabase.remove(id)
      if (success) {
        const { atas } = get()
        set({ atas: atas.filter(ata => ata.id !== id), loading: false })
        console.log('AtasStore: Deleted ata successfully')
      }
      return success
    } catch (error) {
      console.error('AtasStore: Error deleting ata:', error)
      set({ error: 'Erro ao excluir ata', loading: false })
      return false
    }
  },

  addComment: async (ataId: string, comment) => {
    console.log('AtasStore: Adding comment to ata:', ataId, comment)
    
    try {
      const newComment = await atasRepoSupabase.addComment(ataId, comment)
      if (newComment) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => {
          if (ata.id === ataId) {
            return {
              ...ata,
              comments: [...(ata.comments || []), newComment],
              commentCount: (ata.commentCount || 0) + 1,
              updatedAt: new Date().toISOString()
            }
          }
          return ata
        })
        set({ atas: updatedAtas })
        console.log('AtasStore: Added comment successfully')
      }
      return newComment
    } catch (error) {
      console.error('AtasStore: Error adding comment:', error)
      set({ error: 'Erro ao adicionar comentário' })
      return null
    }
  },

  addAttachment: async (ataId: string, attachment) => {
    console.log('AtasStore: Adding attachment to ata:', ataId, attachment)
    
    try {
      const newAttachment = await atasRepoSupabase.addAttachment(ataId, attachment)
      if (newAttachment) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => {
          if (ata.id === ataId) {
            return {
              ...ata,
              attachments: [...(ata.attachments || []), newAttachment],
              updatedAt: new Date().toISOString()
            }
          }
          return ata
        })
        set({ atas: updatedAtas })
        console.log('AtasStore: Added attachment successfully')
      }
      return newAttachment
    } catch (error) {
      console.error('AtasStore: Error adding attachment:', error)
      set({ error: 'Erro ao adicionar anexo' })
      return null
    }
  },

  removeAttachment: async (attachmentId: string) => {
    console.log('AtasStore: Removing attachment:', attachmentId)
    
    try {
      const success = await atasRepoSupabase.removeAttachment(attachmentId)
      if (success) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => {
          if (ata.attachments && ata.attachments.some(att => att.id === attachmentId)) {
            return {
              ...ata,
              attachments: ata.attachments.filter(att => att.id !== attachmentId),
              updatedAt: new Date().toISOString()
            }
          }
          return ata
        })
        set({ atas: updatedAtas })
        console.log('AtasStore: Removed attachment successfully')
      }
      return success
    } catch (error) {
      console.error('AtasStore: Error removing attachment:', error)
      set({ error: 'Erro ao remover anexo' })
      return false
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
