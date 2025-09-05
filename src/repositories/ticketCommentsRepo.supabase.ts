export interface TicketComment {
  id: string
  ticket_id: string
  body: string
  created_by?: string
  author_id: string
  created_at: string
}

export const ticketCommentsRepoSupabase = {
  async list(ticketId: string): Promise<TicketComment[]> {
    console.log('Loading ticket comments from fixtures...', ticketId)
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Por enquanto retorna array vazio
    return []
  },

  async create(comment: Omit<TicketComment, 'id' | 'created_at'>): Promise<TicketComment> {
    console.log('Creating ticket comment (mock):', comment)
    
    // Por enquanto apenas simula criação
    const newComment: TicketComment = {
      id: 'tc-' + Date.now(),
      ...comment,
      created_at: new Date().toISOString()
    }
    
    return newComment
  },

  async update(id: string, body: string): Promise<TicketComment | null> {
    console.log('Updating ticket comment (mock):', id, body)
    
    // Por enquanto apenas simula update
    return null
  },

  async remove(id: string): Promise<boolean> {
    console.log('Deleting ticket comment (mock):', id)
    
    // Por enquanto apenas simula deleção
    return true
  }
}