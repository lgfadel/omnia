export interface TarefaStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Fixtures temporárias até que a migração do banco seja aplicada
const FIXTURE_TAREFA_STATUSES: TarefaStatus[] = [
  { id: 'ts1', name: 'Aberto', color: '#f59e0b', order: 1, isDefault: true },
  { id: 'ts2', name: 'Aguardando', color: '#fbbf24', order: 2 },
  { id: 'ts3', name: 'Em Andamento', color: '#3b82f6', order: 3 },
  { id: 'ts4', name: 'Concluído', color: '#10b981', order: 4 },
]

export const tarefaStatusRepoSupabase = {
  async list(): Promise<TarefaStatus[]> {
    console.log('Loading tarefa statuses from fixtures...')
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return FIXTURE_TAREFA_STATUSES
  },

  async create(data: Omit<TarefaStatus, 'id'>): Promise<TarefaStatus> {
    console.log('Creating tarefa status (mock):', data)
    
    // Por enquanto apenas simula criação
    const newStatus: TarefaStatus = {
      id: 'mock-' + Date.now(),
      ...data,
      order: data.order || FIXTURE_TAREFA_STATUSES.length + 1
    }
    
    return newStatus
  },

  async update(id: string, data: Partial<Omit<TarefaStatus, 'id'>>): Promise<TarefaStatus | null> {
    console.log('Updating tarefa status (mock):', id, data)
    
    // Por enquanto apenas simula update
    const existing = FIXTURE_TAREFA_STATUSES.find(s => s.id === id)
    if (!existing) return null
    
    return {
      ...existing,
      ...data
    }
  },

  async remove(id: string): Promise<boolean> {
    console.log('Removing tarefa status (mock):', id)
    
    // Por enquanto apenas simula remoção
    return true
  },

  async reorder(statuses: TarefaStatus[]): Promise<void> {
    console.log('Reordering tarefa statuses (mock):', statuses)
    
    // Por enquanto apenas simula reordenação
    return
  }
}