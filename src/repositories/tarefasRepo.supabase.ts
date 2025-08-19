import { supabase } from '@/integrations/supabase/client';
import type { UserRef, Attachment, Comment } from '@/data/fixtures';

export type TarefaPrioridade = 'ALTA' | 'NORMAL' | 'BAIXA';

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
}

function transformTarefaFromDB(dbTarefa: any): Tarefa {
  return {
    id: dbTarefa.id,
    title: dbTarefa.title,
    description: dbTarefa.description,
    priority: dbTarefa.priority as TarefaPrioridade,
    dueDate: dbTarefa.due_date ? new Date(dbTarefa.due_date) : undefined,
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
  };
}

export const tarefasRepoSupabase = {
  async list(): Promise<Tarefa[]> {
    const { data, error } = await supabase
      .from('omnia_tickets')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar tarefas:', error);
      throw error;
    }

    return data?.map(transformTarefaFromDB) || [];
  },

  async getById(id: string): Promise<Tarefa | null> {
    const { data, error } = await supabase
      .from('omnia_tickets')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Erro ao buscar tarefa:', error);
      throw error;
    }

    return data ? transformTarefaFromDB(data) : null;
  },

  async create(tarefa: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>): Promise<Tarefa> {
    const { data: currentUser } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('omnia_tickets')
      .insert({
        title: tarefa.title,
        description: tarefa.description,
        priority: tarefa.priority,
        due_date: tarefa.dueDate?.toISOString().split('T')[0],
        ticket: tarefa.ticket,
        status_id: tarefa.statusId,
        assigned_to: tarefa.assignedTo?.id,
        created_by: currentUser?.user?.id,
        tags: tarefa.tags,
      })
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar tarefa:', error);
      throw error;
    }

    return transformTarefaFromDB(data);
  },

  async update(id: string, tarefa: Partial<Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>>): Promise<Tarefa | null> {
    const updateData: any = {};
    
    if (tarefa.title !== undefined) updateData.title = tarefa.title;
    if (tarefa.description !== undefined) updateData.description = tarefa.description;
    if (tarefa.priority !== undefined) updateData.priority = tarefa.priority;
    if (tarefa.dueDate !== undefined) {
      updateData.due_date = tarefa.dueDate?.toISOString().split('T')[0] || null;
    }
    if (tarefa.ticket !== undefined) updateData.ticket = tarefa.ticket;
    if (tarefa.statusId !== undefined) updateData.status_id = tarefa.statusId;
    if (tarefa.assignedTo !== undefined) updateData.assigned_to = tarefa.assignedTo?.id || null;
    if (tarefa.tags !== undefined) updateData.tags = tarefa.tags;

    const { data, error } = await supabase
      .from('omnia_tickets')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar tarefa:', error);
      throw error;
    }

    return data ? transformTarefaFromDB(data) : null;
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_tickets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar tarefa:', error);
      throw error;
    }

    return true;
  },

  async search(query: string): Promise<Tarefa[]> {
    const { data, error } = await supabase
      .from('omnia_tickets')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,ticket.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar tarefas:', error);
      throw error;
    }

    return data?.map(transformTarefaFromDB) || [];
  },
};