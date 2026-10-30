import { supabase } from "@/integrations/supabase/client";
import type { Tables } from '@/integrations/supabase/db-types';
import { generateUniqueTagColor } from "@/utils/tagColors";
import { logger } from '../lib/logging';

type DbTag = Tables<'omnia_tags'>

const transformTagFromDB = (tag: DbTag): Tag => ({
  id: tag.id,
  name: tag.name,
  color: tag.color,
  createdAt: tag.created_at,
  createdBy: tag.created_by ?? undefined,
  updatedAt: tag.updated_at ?? tag.created_at,
});

const getCurrentOmniaUserId = async () => {
  const { data } = await supabase.auth.getUser();
  const authUserId = data.user?.id;

  if (!authUserId) {
    throw new Error('Usuário autenticado não encontrado');
  }

  const { data: omniaUser, error } = await supabase
    .from('omnia_users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single();

  if (error || !omniaUser?.id) {
    throw new Error('Usuário não encontrado na tabela omnia_users');
  }

  return omniaUser.id;
};

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
}

export const tagsRepoSupabase = {
  // Get all tags
  async list(): Promise<Tag[]> {
    logger.debug('Loading tags from database...')
    
    const { data, error } = await supabase
      .from('omnia_tags')
      .select('*')
      .order('name');

    if (error) {
      logger.error('Error fetching tags:', error);
      throw error;
    }

    return (data ?? []).map(transformTagFromDB);
  },

  // Create a new tag
  async create(data: Pick<Tag, 'name' | 'color'>): Promise<Tag> {
    logger.debug('➕ TagsRepo: Creating tag:', data);
    
    const omniaUserId = await getCurrentOmniaUserId();
    logger.debug('👤 TagsRepo: Omnia user:', omniaUserId);
    
    const insertData = {
      name: data.name,
      color: data.color,
      created_by: omniaUserId
    };
    
    logger.debug('💾 TagsRepo: Inserting data:', insertData);
    
    const { data: newTag, error } = await supabase
      .from('omnia_tags')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error('❌ TagsRepo: Error creating tag:', error);
      throw error;
    }

    logger.debug('✅ TagsRepo: Tag created successfully:', newTag);

    return transformTagFromDB(newTag);
  },

  // Update a tag
  async update(id: string, data: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag | null> {
    logger.debug(`Updating tag: ${id}`, data)
    
    const { data: updatedTag, error } = await supabase
      .from('omnia_tags')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating tag:', error);
      throw error;
    }

    return updatedTag ? transformTagFromDB(updatedTag) : null;
  },

  // Delete a tag
  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing tag: ${id}`)
    
    const { error } = await supabase
      .from('omnia_tags')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting tag:', error);
      throw error;
    }

    return true;
  },

  // Search tags by name (for autocomplete)
  async search(query: string): Promise<Tag[]> {
    if (!query.trim()) {
      return [];
    }

    logger.debug(`Searching tags: ${query}`)

    const { data, error } = await supabase
      .from('omnia_tags')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(10);

    if (error) {
      logger.error('Error searching tags:', error);
      throw error;
    }

    return (data ?? []).map(transformTagFromDB);
  },

  // Get or create a tag by name (for dynamic creation)
  async getOrCreate(name: string, color?: string): Promise<Tag> {
    logger.debug(`🏷️ TagsRepo: Getting or creating tag: ${name}`, { color });
    
    // First try to find existing tag
    const { data: existingTag, error: findError } = await supabase
      .from('omnia_tags')
      .select('*')
      .eq('name', name)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      logger.error('❌ TagsRepo: Error finding tag:', findError);
      throw findError;
    }

    if (existingTag) {
      logger.debug('✅ TagsRepo: Found existing tag:', existingTag);
      return transformTagFromDB(existingTag);
    }

    // If no color provided, generate a unique one
    if (!color) {
      logger.debug('🎨 TagsRepo: No color provided, generating unique color...');
      // Get all existing tags to check for color conflicts
      const allTags = await this.list();
      const usedColors = allTags.map(tag => tag.color);
      logger.debug('🎨 TagsRepo: Used colors:', usedColors);
      
      color = generateUniqueTagColor(usedColors);
      logger.debug(`🎨 TagsRepo: Generated color: ${color}`);
    }

    // Create new tag
    logger.debug(`➕ TagsRepo: Creating new tag with color: ${color}`);
    return await this.create({ name, color });
  }
}