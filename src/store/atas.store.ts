
import { create } from 'zustand'
import { Ata, Status, Comment, Attachment } from '@/data/types'
import { atasRepoSupabase } from '@/repositories/atasRepo.supabase'
import { logger } from '../lib/logging';


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
  updateComment: (ataId: string, commentId: string, body: string) => Promise<Comment | null>
  removeComment: (ataId: string, commentId: string) => Promise<boolean>
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
    logger.debug('AtasStore: Loading atas with search:', search, 'statusFilter:', statusFilter)
    set({ loading: true, error: null })
    
    try {
      const atas = await atasRepoSupabase.list(search, statusFilter)
      logger.debug('AtasStore: Loaded atas:', atas)
      set({ atas, loading: false })
    } catch (error) {
      logger.error('AtasStore: Error loading atas:', error)
      set({ error: 'Erro ao carregar atas', loading: false })
    }
  },

  loadStatuses: async () => {
    logger.debug('AtasStore: Loading statuses...')
    
    try {
      const statuses = await atasRepoSupabase.getStatuses()
      logger.debug('AtasStore: Loaded statuses:', statuses)
      set({ statuses })
    } catch (error) {
      logger.error('AtasStore: Error loading statuses:', error)
      set({ error: 'Erro ao carregar status' })
    }
  },

  getAtaById: async (id: string) => {
    logger.debug('AtasStore: Getting ata by id:', id)
    set({ loading: true, error: null })
    
    try {
      const ata = await atasRepoSupabase.getById(id)
      logger.debug('AtasStore: Got ata:', ata)
      set({ loading: false })
      return ata
    } catch (error) {
      logger.error('AtasStore: Error getting ata:', error)
      set({ error: 'Erro ao carregar ata', loading: false })
      return null
    }
  },

  createAta: async (data) => {
    logger.debug('AtasStore: Creating ata:', data)
    set({ loading: true, error: null })
    
    try {
      const newAta = await atasRepoSupabase.create(data)
      const { atas } = get()
      set({ atas: [newAta, ...atas], loading: false })
      logger.debug('AtasStore: Created ata successfully')
      return newAta
    } catch (error) {
      logger.error('AtasStore: Error creating ata:', error)
      set({ error: 'Erro ao criar ata', loading: false })
      throw error
    }
  },

  updateAta: async (id: string, data) => {
    logger.debug('AtasStore: Updating ata:', id, data)
    set({ loading: true, error: null })
    
    try {
      const updatedAta = await atasRepoSupabase.update(id, data)
      if (updatedAta) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => ata.id === id ? updatedAta : ata)
        set({ atas: updatedAtas, loading: false })
        logger.debug('AtasStore: Updated ata successfully')
      }
      return updatedAta
    } catch (error) {
      logger.error('AtasStore: Error updating ata:', error)
      set({ error: 'Erro ao atualizar ata', loading: false })
      return null
    }
  },

  deleteAta: async (id: string) => {
    logger.debug('AtasStore: Deleting ata:', id)
    set({ loading: true, error: null })
    
    try {
      const success = await atasRepoSupabase.remove(id)
      if (success) {
        const { atas } = get()
        set({ atas: atas.filter(ata => ata.id !== id), loading: false })
        logger.debug('AtasStore: Deleted ata successfully')
      }
      return success
    } catch (error) {
      logger.error('AtasStore: Error deleting ata:', error)
      set({ error: 'Erro ao excluir ata', loading: false })
      return false
    }
  },

  addComment: async (ataId: string, comment) => {
    logger.debug('AtasStore: Adding comment to ata:', ataId, comment)
    
    try {
      const newComment = await atasRepoSupabase.addComment(ataId, comment)
      if (newComment) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => {
          if (ata.id === ataId) {
            return {
              ...ata,
              comments: [newComment, ...(ata.comments || [])],
              commentCount: (ata.commentCount || 0) + 1,
              updatedAt: new Date().toISOString()
            }
          }
          return ata
        })
        set({ atas: updatedAtas })
        logger.debug('AtasStore: Added comment successfully')
      }
      return newComment
    } catch (error) {
      logger.error('AtasStore: Error adding comment:', error)
      set({ error: 'Erro ao adicionar comentário' })
      return null
    }
  },

  updateComment: async (ataId: string, commentId: string, body: string) => {
    logger.debug('AtasStore: Updating comment:', commentId, 'in ata:', ataId)
    
    try {
      const updatedComment = await atasRepoSupabase.updateComment(commentId, body)
      if (updatedComment) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => {
          if (ata.id === ataId) {
            return {
              ...ata,
              comments: (ata.comments || []).map(comment => 
                comment.id === commentId ? updatedComment : comment
              ),
              updatedAt: new Date().toISOString()
            }
          }
          return ata
        })
        set({ atas: updatedAtas })
        logger.debug('AtasStore: Updated comment successfully')
      }
      return updatedComment
    } catch (error) {
      logger.error('AtasStore: Error updating comment:', error)
      set({ error: 'Erro ao atualizar comentário' })
      return null
    }
  },

  removeComment: async (ataId: string, commentId: string) => {
    logger.debug('AtasStore: Removing comment:', commentId, 'from ata:', ataId)
    
    try {
      const success = await atasRepoSupabase.removeComment(commentId)
      if (success) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => {
          if (ata.id === ataId) {
            return {
              ...ata,
              comments: (ata.comments || []).filter(comment => comment.id !== commentId),
              commentCount: Math.max(0, (ata.commentCount || 0) - 1),
              updatedAt: new Date().toISOString()
            }
          }
          return ata
        })
        set({ atas: updatedAtas })
        logger.debug('AtasStore: Removed comment successfully')
      }
      return success
    } catch (error) {
      logger.error('AtasStore: Error removing comment:', error)
      set({ error: 'Erro ao remover comentário' })
      return false
    }
  },

  addAttachment: async (ataId: string, attachment) => {
    logger.debug('AtasStore: Adding attachment to ata:', ataId, attachment)
    
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
        logger.debug('AtasStore: Added attachment successfully')
      }
      return newAttachment
    } catch (error) {
      logger.error('AtasStore: Error adding attachment:', error)
      set({ error: 'Erro ao adicionar anexo' })
      return null
    }
  },

  removeAttachment: async (attachmentId: string) => {
    logger.debug('AtasStore: Removing attachment:', attachmentId)
    
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
        logger.debug('AtasStore: Removed attachment successfully')
      }
      return success
    } catch (error) {
      logger.error('AtasStore: Error removing attachment:', error)
      set({ error: 'Erro ao remover anexo' })
      return false
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
