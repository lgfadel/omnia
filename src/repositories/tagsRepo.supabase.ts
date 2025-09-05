export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
}

// Fixtures temporárias até que a migração do banco seja aplicada
const FIXTURE_TAGS: Tag[] = [
  { id: 't1', name: 'Desenvolvimento', color: '#3b82f6', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 't2', name: 'Frontend', color: '#10b981', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 't3', name: 'Backend', color: '#f59e0b', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 't4', name: 'Bug', color: '#ef4444', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 't5', name: 'Melhoria', color: '#8b5cf6', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }
]

export const tagsRepoSupabase = {
  // Get all tags
  async list(): Promise<Tag[]> {
    console.log('Loading tags from fixtures...')
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return FIXTURE_TAGS
  },

  // Create a new tag
  async create(data: Pick<Tag, 'name' | 'color'>): Promise<Tag> {
    console.log('Creating tag (mock):', data)
    
    // Por enquanto apenas simula criação
    const newTag: Tag = {
      id: 'mock-' + Date.now(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    return newTag
  },

  // Update a tag
  async update(id: string, data: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag | null> {
    console.log('Updating tag (mock):', id, data)
    
    // Por enquanto apenas simula update
    const existing = FIXTURE_TAGS.find(t => t.id === id)
    if (!existing) return null
    
    return {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString()
    }
  },

  // Delete a tag
  async remove(id: string): Promise<boolean> {
    console.log('Removing tag (mock):', id)
    
    // Por enquanto apenas simula remoção
    return true
  },

  // Search tags by name (for autocomplete)
  async search(query: string): Promise<Tag[]> {
    if (!query.trim()) {
      return []
    }

    console.log('Searching tags (mock):', query)
    
    // Por enquanto filtra os fixtures
    return FIXTURE_TAGS.filter(tag => 
      tag.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10)
  },

  // Get or create a tag by name (for dynamic creation)
  async getOrCreate(name: string, color: string = '#6366f1'): Promise<Tag> {
    console.log('Getting or creating tag (mock):', name)
    
    // Primeiro tenta encontrar existente
    const existing = FIXTURE_TAGS.find(tag => 
      tag.name.toLowerCase() === name.toLowerCase()
    )
    
    if (existing) {
      return existing
    }
    
    // Cria novo se não encontrou
    return this.create({ name, color })
  }
}