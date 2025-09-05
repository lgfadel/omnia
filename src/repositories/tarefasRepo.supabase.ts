import { supabase } from '@/integrations/supabase/client';
import type { UserRef, Attachment, Comment } from '@/data/fixtures';

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

function transformTarefaFromDB(dbTarefa: any): Tarefa {
  return {
    id: dbTarefa.id,
    title: dbTarefa.title,
    description: dbTarefa.description,
    priority: dbTarefa.priority as TarefaPrioridade,
    dueDate: dbTarefa.due_date ? new Date(dbTarefa.due_date + 'T00:00:00') : undefined,
    ticket: dbTarefa.ticket,
    statusId: dbTarefa.status_id,
    assignedTo: dbTarefa.assigned_to_user ? {
      id: dbTarefa.assigned_to_user.id,
      name: dbTarefa.assigned_to_user.name,
      email: dbTarefa.assigned_to_user.email,
      roles: dbTarefa.assigned_to_user.roles,
      avatarUrl: dbTarefa.assigned_to_user.avatar_url,
      color: dbTarefa.assigned_to_user.color,
    } : undefined,
    createdBy: dbTarefa.created_by_user ? {
      id: dbTarefa.created_by_user.id,
      name: dbTarefa.created_by_user.name,
      email: dbTarefa.created_by_user.email,
      roles: dbTarefa.created_by_user.roles,
      avatarUrl: dbTarefa.created_by_user.avatar_url,
      color: dbTarefa.created_by_user.color,
    } : undefined,
    tags: dbTarefa.tags || [],
    commentCount: dbTarefa.comment_count || 0,
    createdAt: new Date(dbTarefa.created_at),
    updatedAt: new Date(dbTarefa.updated_at),
    isPrivate: dbTarefa.is_private || false,
  };
}

export const tarefasRepoSupabase = {
  // Get all tasks or filter by optional parameters
  async list(filters?: {
    statusId?: string;
    assignedTo?: string;
    priority?: TarefaPrioridade;
    isPrivate?: boolean;
  }): Promise<Tarefa[]> {
    console.log('Loading tarefas from database...', filters)
    
    let query = supabase
      .from('omnia_tickets' as any)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
          id, name, email, roles, avatar_url, color
        ),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(
          id, name, email, roles, avatar_url, color
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (filters) {
      if (filters.statusId) {
        query = query.eq('status_id', filters.statusId);
      }
      if (filters.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.isPrivate !== undefined) {
        query = query.eq('is_private', filters.isPrivate);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tarefas:', error);
      throw error;
    }

    return data?.map(transformTarefaFromDB) || [];
  },

  // Get a single task by ID
  async get(id: string): Promise<Tarefa | null> {
    console.log('Getting tarefa:', id)
    
    const { data, error } = await supabase
      .from('omnia_tickets' as any)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
          id, name, email, roles, avatar_url, color
        ),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(
          id, name, email, roles, avatar_url, color
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching tarefa:', error);
      throw error;
    }

    return data ? transformTarefaFromDB(data) : null;
  },

  // Create a new task
  async create(data: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>): Promise<Tarefa> {
    console.log('Creating tarefa:', data)
    
    const { data: user } = await supabase.auth.getUser();

    const { data: newTarefa, error } = await supabase
      .from('omnia_tickets' as any)
      .insert({
        title: data.title,
        description: data.description,
        priority: data.priority,
        due_date: data.dueDate ? data.dueDate.toISOString().split('T')[0] : null,
        ticket: data.ticket,
        status_id: data.statusId,
        assigned_to: data.assignedTo?.id,
        created_by: user?.user?.id,
        tags: data.tags,
        is_private: data.isPrivate,
      })
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
          id, name, email, roles, avatar_url, color
        ),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(
          id, name, email, roles, avatar_url, color
        )
      `)
      .single();

    if (error) {
      console.error('Error creating tarefa:', error);
      throw error;
    }

    return transformTarefaFromDB(newTarefa);
  },

  // Update an existing task
  async update(id: string, data: Partial<Omit<Tarefa, 'id' | 'createdAt'>>): Promise<Tarefa | null> {
    console.log('Updating tarefa:', id, data)
    
    const updateData: any = {};
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.due_date = data.dueDate ? data.dueDate.toISOString().split('T')[0] : null;
    if (data.ticket !== undefined) updateData.ticket = data.ticket;
    if (data.statusId !== undefined) updateData.status_id = data.statusId;
    if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo?.id;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isPrivate !== undefined) updateData.is_private = data.isPrivate;

    const { data: updatedTarefa, error } = await supabase
      .from('omnia_tickets' as any)
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
          id, name, email, roles, avatar_url, color
        ),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(
          id, name, email, roles, avatar_url, color
        )
      `)
      .single();

    if (error) {
      console.error('Error updating tarefa:', error);
      throw error;
    }

    return updatedTarefa ? transformTarefaFromDB(updatedTarefa) : null;
  },

  // Delete a task
  async remove(id: string): Promise<boolean> {
    console.log('Removing tarefa:', id)
    
    const { error } = await supabase
      .from('omnia_tickets' as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tarefa:', error);
      throw error;
    }

    return true;
  },

  // Get tasks for the current user (considering private tasks)
  async getMyTasks(userId: string): Promise<Tarefa[]> {
    console.log('Getting my tarefas:', userId)
    
    const { data, error } = await supabase
      .from('omnia_tickets' as any)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
          id, name, email, roles, avatar_url, color
        ),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(
          id, name, email, roles, avatar_url, color
        )
      `)
      .or(`is_private.eq.false,assigned_to.eq.${userId},created_by.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my tarefas:', error);
      throw error;
    }

    return data?.map(transformTarefaFromDB) || [];
  },

  // Search tasks by title or description
  async search(query: string): Promise<Tarefa[]> {
    console.log('Searching tarefas:', query)
    
    if (!query.trim()) return [];

    const { data, error } = await supabase
      .from('omnia_tickets' as any)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
          id, name, email, roles, avatar_url, color
        ),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(
          id, name, email, roles, avatar_url, color
        )
      `)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error searching tarefas:', error);
      throw error;
    }

    return data?.map(transformTarefaFromDB) || [];
  }
}