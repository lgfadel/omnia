import type { UserRef, Attachment, Comment, FIXTURE_TAREFAS, FIXTURE_USERS } from '@/data/fixtures';

export type TarefaPrioridade = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';

export interface Tarefa {
  id: string;
  title: string;
  description?: string;
  priority: TarefaPrioridade;
  dueDate?: Date;
  ticket?: string;
  statusId: string;
  assignedTo?: UserRef;
  createdBy?: UserRef;
  tags: string[];
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  attachments?: Attachment[];
  comments?: Comment[];
  isPrivate: boolean;
}

// Fixtures temporárias até que a migração do banco seja aplicada
const FIXTURE_TAREFAS_MOCK: Tarefa[] = [
  {
    id: 'T-0001',
    title: 'Implementar dashboard de métricas',
    description: 'Criar dashboard com gráficos de pizza e barras',
    priority: 'ALTA',
    dueDate: new Date('2025-02-15T00:00:00.000Z'),
    statusId: 'ts1', // Status "Aberto"
    assignedTo: { id: 'u1', name: 'Ana Souza', email: 'ana@exemplo.com', roles: ['SECRETARIO'], avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face' },
    createdBy: { id: 'u3', name: 'Marina Reis', email: 'marina@exemplo.com', roles: ['ADMIN', 'SECRETARIO'], avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' },
    tags: ['desenvolvimento', 'frontend'],
    commentCount: 1,
    createdAt: new Date('2025-01-15T00:00:00.000Z'),
    updatedAt: new Date('2025-01-15T00:00:00.000Z'),
    ticket: 'TCK-001',
    isPrivate: false
  },
  {
    id: 'T-0002',
    title: 'Configurar autenticação',
    description: 'Implementar login com Supabase',
    priority: 'ALTA',
    dueDate: new Date('2025-02-10T00:00:00.000Z'),
    statusId: 'ts3', // Status "Em Andamento"
    assignedTo: { id: 'u2', name: 'Carlos Lima', email: 'carlos@exemplo.com', roles: ['SECRETARIO'], avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' },
    createdBy: { id: 'u3', name: 'Marina Reis', email: 'marina@exemplo.com', roles: ['ADMIN', 'SECRETARIO'], avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' },
    tags: ['backend', 'segurança'],
    commentCount: 0,
    createdAt: new Date('2025-01-10T00:00:00.000Z'),
    updatedAt: new Date('2025-01-12T00:00:00.000Z'),
    ticket: 'TCK-002',
    isPrivate: false
  },
  {
    id: 'T-0003',
    title: 'Otimizar performance',
    description: 'Melhorar tempo de carregamento',
    priority: 'NORMAL',
    dueDate: new Date('2025-03-01T00:00:00.000Z'),
    statusId: 'ts4', // Status "Concluído"
    assignedTo: { id: 'u1', name: 'Ana Souza', email: 'ana@exemplo.com', roles: ['SECRETARIO'], avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face' },
    createdBy: { id: 'u3', name: 'Marina Reis', email: 'marina@exemplo.com', roles: ['ADMIN', 'SECRETARIO'], avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' },
    tags: ['performance', 'otimização'],
    commentCount: 2,
    createdAt: new Date('2025-01-05T00:00:00.000Z'),
    updatedAt: new Date('2025-01-20T00:00:00.000Z'),
    ticket: 'TCK-003',
    isPrivate: false
  }
];

export const tarefasRepoSupabase = {
  // Get all tasks or filter by optional parameters
  async list(filters?: {
    statusId?: string;
    assignedTo?: string;
    priority?: TarefaPrioridade;
    isPrivate?: boolean;
  }): Promise<Tarefa[]> {
    console.log('Loading tarefas from fixtures...', filters)
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100))
    
    let tarefas = [...FIXTURE_TAREFAS_MOCK]
    
    // Aplica filtros se fornecidos
    if (filters) {
      if (filters.statusId) {
        tarefas = tarefas.filter(t => t.statusId === filters.statusId)
      }
      if (filters.assignedTo) {
        tarefas = tarefas.filter(t => t.assignedTo?.id === filters.assignedTo)
      }
      if (filters.priority) {
        tarefas = tarefas.filter(t => t.priority === filters.priority)
      }
      if (filters.isPrivate !== undefined) {
        tarefas = tarefas.filter(t => t.isPrivate === filters.isPrivate)
      }
    }
    
    return tarefas
  },

  // Get a single task by ID
  async get(id: string): Promise<Tarefa | null> {
    console.log('Getting tarefa (mock):', id)
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return FIXTURE_TAREFAS_MOCK.find(t => t.id === id) || null
  },

  // Create a new task
  async create(data: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>): Promise<Tarefa> {
    console.log('Creating tarefa (mock):', data)
    
    const newTarefa: Tarefa = {
      id: 'T-' + Date.now().toString().slice(-4),
      ...data,
      commentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    return newTarefa
  },

  // Update an existing task
  async update(id: string, data: Partial<Omit<Tarefa, 'id' | 'createdAt'>>): Promise<Tarefa | null> {
    console.log('Updating tarefa (mock):', id, data)
    
    const existing = FIXTURE_TAREFAS_MOCK.find(t => t.id === id)
    if (!existing) return null
    
    return {
      ...existing,
      ...data,
      updatedAt: new Date()
    }
  },

  // Delete a task
  async remove(id: string): Promise<boolean> {
    console.log('Removing tarefa (mock):', id)
    
    // Por enquanto apenas simula remoção
    return true
  },

  // Get tasks for the current user (considering private tasks)
  async getMyTasks(userId: string): Promise<Tarefa[]> {
    console.log('Getting my tarefas (mock):', userId)
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Retorna tarefas onde o usuário é assignee, creator ou tarefas públicas
    return FIXTURE_TAREFAS_MOCK.filter(t => 
      !t.isPrivate || 
      t.assignedTo?.id === userId || 
      t.createdBy?.id === userId
    )
  },

  // Search tasks by title or description
  async search(query: string): Promise<Tarefa[]> {
    console.log('Searching tarefas (mock):', query)
    
    if (!query.trim()) return []
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const lowerQuery = query.toLowerCase()
    return FIXTURE_TAREFAS_MOCK.filter(t => 
      t.title.toLowerCase().includes(lowerQuery) ||
      t.description?.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }
}