import { Ata, Comment, Attachment, FIXTURE_ATAS, FIXTURE_STATUSES } from "@/data/fixtures"

// Simulate network latency
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms))

// Mock database - in memory
let atas: Ata[] = [...FIXTURE_ATAS]
let nextId = 4

export const atasRepoMock = {
  async list(search?: string, statusFilter?: string[]): Promise<Ata[]> {
    await delay()
    
    let filtered = [...atas]
    
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(ata => 
        ata.title.toLowerCase().includes(searchLower) ||
        ata.id.toLowerCase().includes(searchLower) ||
        ata.description?.toLowerCase().includes(searchLower)
      )
    }
    
    if (statusFilter && statusFilter.length > 0) {
      filtered = filtered.filter(ata => statusFilter.includes(ata.statusId))
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async getById(id: string): Promise<Ata | null> {
    await delay()
    return atas.find(ata => ata.id === id) || null
  },

  async create(data: Omit<Ata, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>): Promise<Ata> {
    await delay()
    
    const now = new Date().toISOString()
    const newAta: Ata = {
      ...data,
      id: `A-${String(nextId).padStart(4, '0')}`,
      createdAt: now,
      updatedAt: now,
      commentCount: data.comments?.length || 0,
      attachments: data.attachments || [],
      comments: data.comments || []
    }
    
    nextId++
    atas.unshift(newAta)
    return newAta
  },

  async update(id: string, data: Partial<Omit<Ata, 'id' | 'createdAt'>>): Promise<Ata | null> {
    await delay()
    
    const index = atas.findIndex(ata => ata.id === id)
    if (index === -1) return null
    
    const updatedAta = {
      ...atas[index],
      ...data,
      updatedAt: new Date().toISOString(),
      commentCount: data.comments?.length || atas[index].commentCount || 0
    }
    
    atas[index] = updatedAta
    return updatedAta
  },

  async remove(id: string): Promise<boolean> {
    await delay()
    
    const index = atas.findIndex(ata => ata.id === id)
    if (index === -1) return false
    
    atas.splice(index, 1)
    return true
  },

  async addComment(ataId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment | null> {
    await delay()
    
    const ata = atas.find(a => a.id === ataId)
    if (!ata) return null
    
    const newComment: Comment = {
      ...comment,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
      attachments: comment.attachments || []
    }
    
    if (!ata.comments) ata.comments = []
    ata.comments.push(newComment)
    ata.commentCount = ata.comments.length
    ata.updatedAt = new Date().toISOString()
    
    return newComment
  },

  async addAttachment(ataId: string, attachment: Omit<Attachment, 'id' | 'createdAt'>): Promise<Attachment | null> {
    await delay()
    
    const ata = atas.find(a => a.id === ataId)
    if (!ata) return null
    
    const newAttachment: Attachment = {
      ...attachment,
      id: `att-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    
    if (!ata.attachments) ata.attachments = []
    ata.attachments.push(newAttachment)
    ata.updatedAt = new Date().toISOString()
    
    return newAttachment
  },

  async getStatuses() {
    await delay(100)
    return FIXTURE_STATUSES
  }
}