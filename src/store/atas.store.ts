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
}

export const useAtasStore = create<AtasStore>((set, get) => ({
  atas: [],
  statuses: [],
  loading: false,
  error: null,

  loadAtas: async (search?: string, statusFilter?: string[]) => {
    set({ loading: true, error: null })
    try {
      const atas = await atasRepoSupabase.list(search, statusFilter)
      set({ atas, loading: false })
    } catch (error) {
      set({ error: 'Erro ao carregar atas', loading: false })
    }
  },

  loadStatuses: async () => {
    try {
      const statuses = await atasRepoSupabase.getStatuses()
      set({ statuses })
    } catch (error) {
      set({ error: 'Erro ao carregar status' })
    }
  },

  getAtaById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const ata = await atasRepoSupabase.getById(id)
      set({ loading: false })
      return ata
    } catch (error) {
      set({ error: 'Erro ao carregar ata', loading: false })
      return null
    }
  },

  createAta: async (data) => {
    set({ loading: true, error: null })
    try {
      const newAta = await atasRepoSupabase.create(data)
      const { atas } = get()
      set({ atas: [newAta, ...atas], loading: false })
      return newAta
    } catch (error) {
      set({ error: 'Erro ao criar ata', loading: false })
      throw error
    }
  },

  updateAta: async (id: string, data) => {
    set({ loading: true, error: null })
    try {
      const updatedAta = await atasRepoSupabase.update(id, data)
      if (updatedAta) {
        const { atas } = get()
        const updatedAtas = atas.map(ata => ata.id === id ? updatedAta : ata)
        set({ atas: updatedAtas, loading: false })
      }
      return updatedAta
    } catch (error) {
      set({ error: 'Erro ao atualizar ata', loading: false })
      return null
    }
  },

  deleteAta: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const success = await atasRepoSupabase.remove(id)
      if (success) {
        const { atas } = get()
        set({ atas: atas.filter(ata => ata.id !== id), loading: false })
      }
      return success
    } catch (error) {
      set({ error: 'Erro ao excluir ata', loading: false })
      return false
    }
  },

  addComment: async (ataId: string, comment) => {
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
      }
      return newComment
    } catch (error) {
      set({ error: 'Erro ao adicionar comentário' })
      return null
    }
  },

  addAttachment: async (ataId: string, attachment) => {
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
      }
      return newAttachment
    } catch (error) {
      set({ error: 'Erro ao adicionar anexo' })
      return null
    }
  }
}))