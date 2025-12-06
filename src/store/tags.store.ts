import { create } from 'zustand';
import { Tag, tagsRepoSupabase } from '@/repositories/tagsRepo.supabase';
import { logger } from '../lib/logging';


interface TagsStore {
  tags: Tag[];
  loading: boolean;
  error: string | null;

  // Actions
  loadTags: () => Promise<void>;
  searchTags: (query: string) => Promise<Tag[]>;
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
      logger.debug('TagsStore: Loaded tags:', tags);
      set({ tags, loading: false });
    } catch (error) {
      logger.error('TagsStore: Error loading tags:', error);
      set({ error: 'Erro ao carregar tags', loading: false });
    }
  },

  searchTags: async (query: string) => {
    try {
      const tags = await tagsRepoSupabase.search(query);
      logger.debug('TagsStore: Search results:', tags);
      return tags;
    } catch (error) {
      logger.error('TagsStore: Error searching tags:', error);
      return [];
    }
  },

  createTag: async (data) => {
    set({ loading: true, error: null });
    try {
      const newTag = await tagsRepoSupabase.create(data);
      logger.debug('TagsStore: Created tag:', newTag);
      
      set(state => ({
        tags: [...state.tags, newTag],
        loading: false
      }));
      
      return newTag;
    } catch (error) {
      logger.error('TagsStore: Error creating tag:', error);
      set({ error: 'Erro ao criar tag', loading: false });
      throw error;
    }
  },

  updateTag: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const updatedTag = await tagsRepoSupabase.update(id, data);
      if (updatedTag) {
        logger.debug('TagsStore: Updated tag:', updatedTag);
        
        set(state => ({
          tags: state.tags.map(tag => 
            tag.id === id ? updatedTag : tag
          ),
          loading: false
        }));
      }
    } catch (error) {
      logger.error('TagsStore: Error updating tag:', error);
      set({ error: 'Erro ao atualizar tag', loading: false });
      throw error;
    }
  },

  deleteTag: async (id) => {
    set({ loading: true, error: null });
    try {
      await tagsRepoSupabase.remove(id);
      logger.debug('TagsStore: Deleted tag:', id);
      
      set(state => ({
        tags: state.tags.filter(tag => tag.id !== id),
        loading: false
      }));
    } catch (error) {
      logger.error('TagsStore: Error deleting tag:', error);
      set({ error: 'Erro ao excluir tag', loading: false });
      throw error;
    }
  },

  getOrCreateTag: async (name, color) => {
    try {
      const tag = await tagsRepoSupabase.getOrCreate(name, color);
      logger.debug('TagsStore: Got or created tag:', tag);
      
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
      logger.error('TagsStore: Error getting or creating tag:', error);
      throw error;
    }
  }
}));