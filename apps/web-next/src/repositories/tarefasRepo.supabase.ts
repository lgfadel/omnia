import { supabase } from "@/integrations/supabase/client";
import type { UserRef, Attachment, Comment } from '@/data/types';
import { logger } from '../lib/logging';

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

export type TarefaPrioridade = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';

export interface Tarefa {
  id: string;
  title: string;
  description?: string;
  priority: TarefaPrioridade;
  dueDate?: Date;
  ticketOcta?: string;
  ticketId?: number;
  statusId: string;
  assignedTo?: UserRef;
  createdBy?: UserRef;
  oportunidadeId?: string;
  tags: string[];
  commentCount: number;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
  attachments?: Attachment[];
  comments?: Comment[];
  isPrivate: boolean;
}

const isMissingColumnError = (error: any, column: string) => {
  return error?.code === 'PGRST204' && typeof error?.message === 'string' && error.message.includes(`'${column}'`)
}

function transformTarefaFromDB(dbTarefa: any): Tarefa {
  return {
    id: dbTarefa.id,
    title: dbTarefa.title,
    description: dbTarefa.description,
    priority: dbTarefa.priority as TarefaPrioridade,
    dueDate: dbTarefa.due_date ? new Date(dbTarefa.due_date + 'T00:00:00') : undefined,
    ticketOcta: dbTarefa.ticket_octa ?? dbTarefa.ticket,
    ticketId: dbTarefa.ticket_id ?? undefined,
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
    oportunidadeId: dbTarefa.oportunidade_id || undefined,
    tags: dbTarefa.tags || [],
    commentCount: dbTarefa.comment_count || 0,
    attachmentCount: dbTarefa.attachment_count || 0,
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
    logger.debug('Loading tarefas from database...', filters)
    
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
      logger.error('Error fetching tarefas:', error);
      throw error;
    }

    return data?.map(transformTarefaFromDB) || [];
  },

  // Get a single task by ID
  async get(id: string): Promise<Tarefa | null> {
    logger.debug('Getting tarefa:', id)
    
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
      logger.error('Error fetching tarefa:', error);
      throw error;
    }

    return data ? transformTarefaFromDB(data) : null;
  },

  // Create a new task
  async create(data: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>): Promise<Tarefa> {
    logger.debug('Creating tarefa:', data)
    
    const omniaUserId = await getCurrentOmniaUserId();

    const insertData = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: data.dueDate ? data.dueDate.toISOString().split('T')[0] : null,
      ticket_octa: data.ticketOcta,
      status_id: data.statusId,
      assigned_to: data.assignedTo?.id,
      created_by: omniaUserId,
      oportunidade_id: data.oportunidadeId,
      tags: data.tags,
      is_private: data.isPrivate,
    };

    let newTarefa: any
    let error: any

    ;({ data: newTarefa, error } = await supabase
      .from('omnia_tickets' as any)
      .insert(insertData)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
          id, name, email, roles, avatar_url, color
        ),
        created_by_user:omnia_users!omnia_tickets_created_by_fkey(
          id, name, email, roles, avatar_url, color
        )
      `)
      .single())

    if (error && isMissingColumnError(error, 'ticket_octa')) {
      const legacyInsertData: any = { ...insertData }
      delete legacyInsertData.ticket_octa
      legacyInsertData.ticket = data.ticketOcta

      ;({ data: newTarefa, error } = await supabase
        .from('omnia_tickets' as any)
        .insert(legacyInsertData)
        .select(`
          *,
          assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
            id, name, email, roles, avatar_url, color
          ),
          created_by_user:omnia_users!omnia_tickets_created_by_fkey(
            id, name, email, roles, avatar_url, color
          )
        `)
        .single())
    }

    if (error) {
      logger.error('❌ Error creating tarefa:', error);
      logger.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    return transformTarefaFromDB(newTarefa);
  },

  // Update an existing task
  async update(id: string, data: Partial<Omit<Tarefa, 'id' | 'createdAt'>>): Promise<Tarefa | null> {
    const updateData: any = {};
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.due_date = data.dueDate ? data.dueDate.toISOString().split('T')[0] : null;
    if (data.ticketOcta !== undefined) updateData.ticket_octa = data.ticketOcta;
    if (data.statusId !== undefined) updateData.status_id = data.statusId;
    if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo?.id;
    // Sempre incluir oportunidade_id se estiver presente no data, mesmo que seja undefined (para permitir NULL)
    if ('oportunidadeId' in data) updateData.oportunidade_id = data.oportunidadeId || null;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isPrivate !== undefined) updateData.is_private = data.isPrivate;

    let updatedTarefa: any
    let error: any

    ;({ data: updatedTarefa, error } = await supabase
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
      .single())

    if (error && data.ticketOcta !== undefined && isMissingColumnError(error, 'ticket_octa')) {
      const legacyUpdateData: any = { ...updateData }
      delete legacyUpdateData.ticket_octa
      legacyUpdateData.ticket = data.ticketOcta

      ;({ data: updatedTarefa, error } = await supabase
        .from('omnia_tickets' as any)
        .update(legacyUpdateData)
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
        .single())
    }

    if (error) {
      logger.error('❌ Error updating tarefa:', error);
      logger.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    return updatedTarefa ? transformTarefaFromDB(updatedTarefa) : null;
  },

  // Delete a task
  async remove(id: string): Promise<boolean> {
    logger.debug('Removing tarefa:', id)
    
    const { error } = await supabase
      .from('omnia_tickets' as any)
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting tarefa:', error);
      throw error;
    }

    return true;
  },

  // Get tasks for the current user (considering private tasks)
  async getMyTasks(userId: string): Promise<Tarefa[]> {
    logger.debug('Getting my tarefas:', userId)
    
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
      logger.error('Error fetching my tarefas:', error);
      throw error;
    }

    return data?.map(transformTarefaFromDB) || [];
  },

  // Search tasks by title or description
  async search(query: string): Promise<Tarefa[]> {
    logger.debug('Searching tarefas:', query)
    
    if (!query.trim()) return [];

    const normalizedQuery = query.trim().replace(/^#/, '')
    const queryAsNumber = /^\d+$/.test(normalizedQuery) ? Number.parseInt(normalizedQuery, 10) : null

    const searchConditions = [
      `title.ilike.%${query}%,description.ilike.%${query}%,ticket_octa.ilike.%${query}%`,
      queryAsNumber !== null ? `ticket_id.eq.${queryAsNumber}` : null,
    ].filter(Boolean).join(',')

    let data: any
    let error: any

    ;({ data, error } = await supabase
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
      .or(searchConditions)
      .order('created_at', { ascending: false })
      .limit(20))

    if (error && (isMissingColumnError(error, 'ticket_octa') || isMissingColumnError(error, 'ticket_id'))) {
      // Fallback para schema antigo (sem ticket_octa/ticket_id)
      ;({ data, error } = await supabase
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
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,ticket.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20))
    }

    if (error) {
      logger.error('Error searching tarefas:', error);
      throw error;
    }

    return data?.map(transformTarefaFromDB) || [];
  }
}