import { Status, FIXTURE_STATUSES } from "@/data/fixtures"

// Por enquanto usando fixtures até que a migração do banco seja aplicada
export const statusRepoSupabase = {
  async list(): Promise<Status[]> {
    console.log('Loading statuses from fixtures...')
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return FIXTURE_STATUSES
  },

  async create(data: Omit<Status, 'id'>): Promise<Status> {
    console.log('Creating status (mock):', data)
    
    // Por enquanto apenas simula criação
    const newStatus: Status = {
      id: 'mock-' + Date.now(),
      ...data,
      order: data.order || FIXTURE_STATUSES.length + 1
    }
    
    return newStatus
  },

  async update(id: string, data: Partial<Omit<Status, 'id'>>): Promise<Status | null> {
    console.log('Updating status (mock):', id, data)
    
    // Por enquanto apenas simula update
    const existing = FIXTURE_STATUSES.find(s => s.id === id)
    if (!existing) return null
    
    return {
      ...existing,
      ...data
    }
  },

  async remove(id: string): Promise<boolean> {
    console.log('Removing status (mock):', id)
    
    // Por enquanto apenas simula remoção
    return true
  },

  async reorder(statuses: Status[]): Promise<void> {
    console.log('Reordering statuses (mock):', statuses)
    
    // Por enquanto apenas simula reordenação
    return
  }
}