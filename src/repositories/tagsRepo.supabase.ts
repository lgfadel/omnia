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
    console.log('Loading tags from database...')
    
    const { data, error } = await supabase
      .from('omnia_tags' as any)
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }

    return (data as any).map((tag: any) => ({
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
    console.log('Creating tag:', data)
    
    const { data: user } = await supabase.auth.getUser()
    
    // Get the omnia_users.id for the current authenticated user
    const { data: omniaUser } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', user?.user?.id)
      .single();
    
    if (!omniaUser) {
      throw new Error('Usuário não encontrado na tabela omnia_users')
    }
    
    const { data: newTag, error } = await supabase
      .from('omnia_tags' as any)
      .insert({
        name: data.name,
        color: data.color,
        created_by: omniaUser?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tag:', error);
      throw error;
    }

    return {
      id: (newTag as any).id,
      name: (newTag as any).name,
      color: (newTag as any).color,
      createdAt: (newTag as any).created_at,
      createdBy: (newTag as any).created_by,
      updatedAt: (newTag as any).updated_at
    };
  },

  // Update a tag
  async update(id: string, data: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag | null> {
    console.log('Updating tag:', id, data)
    
    const { data: updatedTag, error } = await supabase
      .from('omnia_tags' as any)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tag:', error);
      throw error;
    }

    return updatedTag ? {
      id: (updatedTag as any).id,
      name: (updatedTag as any).name,
      color: (updatedTag as any).color,
      createdAt: (updatedTag as any).created_at,
      createdBy: (updatedTag as any).created_by,
      updatedAt: (updatedTag as any).updated_at
    } : null;
  },

  // Delete a tag
  async remove(id: string): Promise<boolean> {
    console.log('Removing tag:', id)
    
    const { error } = await supabase
      .from('omnia_tags' as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }

    return true;
  },

  // Search tags by name (for autocomplete)
  async search(query: string): Promise<Tag[]> {
    if (!query.trim()) {
      return [];
    }

    console.log('Searching tags:', query)

    const { data, error } = await supabase
      .from('omnia_tags' as any)
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(10);

    if (error) {
      console.error('Error searching tags:', error);
      throw error;
    }

    return (data as any).map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.created_at,
      createdBy: tag.created_by,
      updatedAt: tag.updated_at
    }));
  },

  // Get or create a tag by name (for dynamic creation)
  async getOrCreate(name: string, color: string = '#6366f1'): Promise<Tag> {
    console.log('Getting or creating tag:', name)
    
    // First try to find existing tag
    const { data: existingTag, error: findError } = await supabase
      .from('omnia_tags' as any)
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (findError) {
      console.error('Error finding tag:', findError);
      throw findError;
    }

    if (existingTag) {
      return {
        id: (existingTag as any).id,
        name: (existingTag as any).name,
        color: (existingTag as any).color,
        createdAt: (existingTag as any).created_at,
        createdBy: (existingTag as any).created_by,
        updatedAt: (existingTag as any).updated_at
      };
    }

    // Create new tag if not found
    return this.create({ name, color });
  }
}