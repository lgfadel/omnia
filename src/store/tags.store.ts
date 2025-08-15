import { create } from 'zustand';
import { Tag, tagsRepoSupabase } from '@/repositories/tagsRepo.supabase';

interface TagsStore {
  tags: Tag[];
  loading: boolean;
  error: string | null;

  // Actions
  loadTags: () => Promise<void>;
  createTag: (data: Pick<Tag, 'name' | 'color'>) => Promise<Tag>;
  updateTag: (id: string, data: Partial<Pick<Tag, 'name' | 'color'>>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  getOrCreateTag: (name: string, color?: string) => Promise<Tag>;
  clearError: () => void;
}

export const useTagsStore = create<TagsStore>((set, get) => ({
  tags: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  loadTags: async () => {
    set({ loading: true, error: null });
    try {
      const tags = await tagsRepoSupabase.list();
      console.log('TagsStore: Loaded tags:', tags);
      set({ tags, loading: false });
    } catch (error) {
      console.error('TagsStore: Error loading tags:', error);
      set({ error: 'Erro ao carregar tags', loading: false });
    }
  },

  createTag: async (data) => {
    set({ loading: true, error: null });
    try {
      const newTag = await tagsRepoSupabase.create(data);
      console.log('TagsStore: Created tag:', newTag);
      
      set(state => ({
        tags: [...state.tags, newTag],
        loading: false
      }));
      
      return newTag;
    } catch (error) {
      console.error('TagsStore: Error creating tag:', error);
      set({ error: 'Erro ao criar tag', loading: false });
      throw error;
    }
  },

  updateTag: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const updatedTag = await tagsRepoSupabase.update(id, data);
      if (updatedTag) {
        console.log('TagsStore: Updated tag:', updatedTag);
        
        set(state => ({
          tags: state.tags.map(tag => 
            tag.id === id ? updatedTag : tag
          ),
          loading: false
        }));
      }
    } catch (error) {
      console.error('TagsStore: Error updating tag:', error);
      set({ error: 'Erro ao atualizar tag', loading: false });
      throw error;
    }
  },

  deleteTag: async (id) => {
    set({ loading: true, error: null });
    try {
      await tagsRepoSupabase.remove(id);
      console.log('TagsStore: Deleted tag:', id);
      
      set(state => ({
        tags: state.tags.filter(tag => tag.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('TagsStore: Error deleting tag:', error);
      set({ error: 'Erro ao excluir tag', loading: false });
      throw error;
    }
  },

  getOrCreateTag: async (name, color = '#6366f1') => {
    try {
      const tag = await tagsRepoSupabase.getOrCreate(name, color);
      console.log('TagsStore: Got or created tag:', tag);
      
      // Add to store if not already present
      set(state => {
        const existingTag = state.tags.find(t => t.id === tag.id);
        if (!existingTag) {
          return {
            tags: [...state.tags, tag]
          };
        }
        return state;
      });
      
      return tag;
    } catch (error) {
      console.error('TagsStore: Error getting or creating tag:', error);
      throw error;
    }
  }
}));