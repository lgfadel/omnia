import { supabase } from "@/integrations/supabase/client";

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
    const { data, error } = await supabase
      .from('omnia_tags')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }

    return data.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.created_at,
      createdBy: tag.created_by,
      updatedAt: tag.updated_at
    }));
  },

  // Create a new tag
  async create(data: Pick<Tag, 'name' | 'color'>): Promise<Tag> {
    const { data: newTag, error } = await supabase
      .from('omnia_tags')
      .insert({
        name: data.name,
        color: data.color,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tag:', error);
      throw error;
    }

    return {
      id: newTag.id,
      name: newTag.name,
      color: newTag.color,
      createdAt: newTag.created_at,
      createdBy: newTag.created_by,
      updatedAt: newTag.updated_at
    };
  },

  // Update a tag
  async update(id: string, data: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag | null> {
    const { data: updatedTag, error } = await supabase
      .from('omnia_tags')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tag:', error);
      throw error;
    }

    return updatedTag ? {
      id: updatedTag.id,
      name: updatedTag.name,
      color: updatedTag.color,
      createdAt: updatedTag.created_at,
      createdBy: updatedTag.created_by,
      updatedAt: updatedTag.updated_at
    } : null;
  },

  // Delete a tag
  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_tags')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }

    return true;
  },

  // Get or create a tag by name (for dynamic creation)
  async getOrCreate(name: string, color: string = '#6366f1'): Promise<Tag> {
    // First try to find existing tag
    const { data: existingTag, error: findError } = await supabase
      .from('omnia_tags')
      .select('*')
      .eq('name', name)
      .single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error finding tag:', findError);
      throw findError;
    }

    if (existingTag) {
      return {
        id: existingTag.id,
        name: existingTag.name,
        color: existingTag.color,
        createdAt: existingTag.created_at,
        createdBy: existingTag.created_by,
        updatedAt: existingTag.updated_at
      };
    }

    // Create new tag if not found
    return this.create({ name, color });
  }
};