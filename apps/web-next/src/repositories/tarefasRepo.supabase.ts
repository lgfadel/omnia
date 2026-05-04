import { supabase } from "@/integrations/supabase/client";
import type { UserRef, Attachment, Comment } from '@/data/types';
import type { TablesUpdate } from '@/integrations/supabase/db-types';
import {
  addRecurrenceInterval,
  canGenerateOccurrence,
  type RecurrenceEndType,
  type RecurrenceFrequency,
} from '@/lib/recurrence';
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

export interface TarefaRecurrence {
  id?: string;
  enabled: boolean;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: Date;
  endType: RecurrenceEndType;
  endDate?: Date;
  occurrenceLimit?: number;
  generatedOccurrences?: number;
  nextOccurrenceDate?: Date;
  isActive?: boolean;
}

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
  recurrenceId?: string;
  recurrenceOccurrence?: number;
  recurrence?: TarefaRecurrence;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- error from untyped query
const isMissingColumnError = (error: any, column: string) => {
  return error?.code === 'PGRST204' && typeof error?.message === 'string' && error.message.includes(`'${column}'`)
}

const dateToDb = (date?: Date | null) => date ? date.toISOString().split('T')[0] : null

const tarefaSelect = `
  *,
  recurrence:omnia_ticket_recurrences!omnia_tickets_recurrence_id_fkey(
    id,
    frequency,
    interval,
    start_date,
    end_type,
    end_date,
    occurrence_limit,
    generated_occurrences,
    next_occurrence_date,
    is_active
  ),
  assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
    id, name, email, roles, avatar_url, color
  ),
  created_by_user:omnia_users!omnia_tickets_created_by_fkey(
    id, name, email, roles, avatar_url, color
  )
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase nested join result
function transformRecurrenceFromDB(dbRecurrence: any): TarefaRecurrence | undefined {
  if (!dbRecurrence) return undefined

  return {
    id: dbRecurrence.id,
    enabled: Boolean(dbRecurrence.is_active),
    frequency: dbRecurrence.frequency as RecurrenceFrequency,
    interval: dbRecurrence.interval,
    startDate: new Date(dbRecurrence.start_date + 'T00:00:00'),
    endType: dbRecurrence.end_type as RecurrenceEndType,
    endDate: dbRecurrence.end_date ? new Date(dbRecurrence.end_date + 'T00:00:00') : undefined,
    occurrenceLimit: dbRecurrence.occurrence_limit ?? undefined,
    generatedOccurrences: dbRecurrence.generated_occurrences,
    nextOccurrenceDate: dbRecurrence.next_occurrence_date ? new Date(dbRecurrence.next_occurrence_date + 'T00:00:00') : undefined,
    isActive: dbRecurrence.is_active,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- from('omnia_tickets' as any) + JOIN select
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
    recurrenceId: dbTarefa.recurrence_id ?? undefined,
    recurrenceOccurrence: dbTarefa.recurrence_occurrence ?? undefined,
    recurrence: transformRecurrenceFromDB(dbTarefa.recurrence),
  };
}

function buildRecurrenceInsertData(
  data: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>,
  omniaUserId: string,
) {
  const recurrence = data.recurrence
  if (!recurrence?.enabled) return null

  const startDate = recurrence.startDate || data.dueDate
  if (!startDate) {
    throw new Error('Data inicial é obrigatória para tarefas recorrentes')
  }

  const nextOccurrenceDate = addRecurrenceInterval(startDate, recurrence.frequency, recurrence.interval)
  const shouldGenerateNext = canGenerateOccurrence({
    nextOccurrenceDate,
    endType: recurrence.endType,
    endDate: recurrence.endDate,
    occurrenceLimit: recurrence.occurrenceLimit,
    generatedOccurrences: 1,
  })

  return {
    frequency: recurrence.frequency,
    interval: Math.max(1, recurrence.interval || 1),
    start_date: dateToDb(startDate),
    end_type: recurrence.endType,
    end_date: recurrence.endType === 'ON_DATE' ? dateToDb(recurrence.endDate) : null,
    occurrence_limit: recurrence.endType === 'AFTER_COUNT' ? recurrence.occurrenceLimit : null,
    generated_occurrences: 1,
    next_occurrence_date: shouldGenerateNext ? dateToDb(nextOccurrenceDate) : null,
    is_active: shouldGenerateNext,
    title: data.title,
    description: data.description,
    priority: data.priority,
    status_id: data.statusId,
    assigned_to: data.assignedTo?.id,
    created_by: omniaUserId,
    oportunidade_id: data.oportunidadeId,
    tags: data.tags,
    is_private: data.isPrivate,
    ticket_octa: data.ticketOcta,
  }
}

function buildRecurrenceUpdateData(data: Partial<Omit<Tarefa, 'id' | 'createdAt'>>) {
  const recurrence = data.recurrence
  if (!recurrence) return null

  if (!recurrence.enabled) {
    return {
      is_active: false,
      next_occurrence_date: null,
    }
  }

  const startDate = recurrence.startDate || data.dueDate
  if (!startDate) {
    throw new Error('Data inicial é obrigatória para tarefas recorrentes')
  }

  const generatedOccurrences = recurrence.generatedOccurrences ?? 1
  const nextOccurrenceDate = recurrence.nextOccurrenceDate
    ?? addRecurrenceInterval(startDate, recurrence.frequency, recurrence.interval)
  const shouldGenerateNext = canGenerateOccurrence({
    nextOccurrenceDate,
    endType: recurrence.endType,
    endDate: recurrence.endDate,
    occurrenceLimit: recurrence.occurrenceLimit,
    generatedOccurrences,
  })

  return {
    frequency: recurrence.frequency,
    interval: Math.max(1, recurrence.interval || 1),
    start_date: dateToDb(startDate),
    end_type: recurrence.endType,
    end_date: recurrence.endType === 'ON_DATE' ? dateToDb(recurrence.endDate) : null,
    occurrence_limit: recurrence.endType === 'AFTER_COUNT' ? recurrence.occurrenceLimit : null,
    next_occurrence_date: shouldGenerateNext ? dateToDb(nextOccurrenceDate) : null,
    is_active: shouldGenerateNext,
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
    ...(data.statusId !== undefined ? { status_id: data.statusId } : {}),
    ...(data.assignedTo !== undefined ? { assigned_to: data.assignedTo?.id } : {}),
    ...('oportunidadeId' in data ? { oportunidade_id: data.oportunidadeId || null } : {}),
    ...(data.tags !== undefined ? { tags: data.tags } : {}),
    ...(data.isPrivate !== undefined ? { is_private: data.isPrivate } : {}),
    ...(data.ticketOcta !== undefined ? { ticket_octa: data.ticketOcta?.trim() || null } : {}),
  }
}

async function isFinalStatus(statusId?: string) {
  if (!statusId) return false

  const { data, error } = await supabase
    .from('omnia_ticket_statuses' as any)
    .select('name,is_final')
    .eq('id', statusId)
    .maybeSingle()

  if (error) {
    logger.error('Erro ao verificar status final:', error)
    return false
  }

  const statusData = data as { name?: string | null; is_final?: boolean | null } | null
  const statusName = String(statusData?.name ?? '').toLowerCase()
  return Boolean(statusData?.is_final) || statusName.includes('conclu') || statusName.includes('finaliz')
}

async function generateNextRecurrenceOccurrence(tarefa: Tarefa | null) {
  if (!tarefa?.recurrence?.isActive || !tarefa.recurrence.nextOccurrenceDate) return

  const { error } = await supabase.rpc('generate_omnia_ticket_recurrences' as any, {
    p_run_date: dateToDb(tarefa.recurrence.nextOccurrenceDate),
  })

  if (error) {
    logger.error('Erro ao gerar próxima ocorrência recorrente:', error)
  }
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
      .select(tarefaSelect)
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
      .select(tarefaSelect)
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

    const recurrenceInsertData = buildRecurrenceInsertData(data, omniaUserId)
    let recurrenceId: string | undefined

    if (recurrenceInsertData) {
      const { data: recurrenceData, error: recurrenceError } = await supabase
        .from('omnia_ticket_recurrences' as any)
        .insert(recurrenceInsertData)
        .select('id')
        .single()

      if (recurrenceError) {
        logger.error('❌ Error creating tarefa recurrence:', recurrenceError);
        throw recurrenceError;
      }

      recurrenceId = (recurrenceData as unknown as { id: string }).id
    }

    const insertData = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: recurrenceInsertData?.start_date ?? dateToDb(data.dueDate),
      ticket_octa: data.ticketOcta,
      status_id: data.statusId,
      assigned_to: data.assignedTo?.id,
      created_by: omniaUserId,
      oportunidade_id: data.oportunidadeId,
      tags: data.tags,
      is_private: data.isPrivate,
      recurrence_id: recurrenceId,
      recurrence_occurrence: recurrenceId ? 1 : null,
    };

    let newTarefa: any
    let error: any

    ;({ data: newTarefa, error } = await supabase
      .from('omnia_tickets' as any)
      .insert(insertData)
      .select(tarefaSelect)
      .single())

    if (error && isMissingColumnError(error, 'ticket_octa')) {
      const legacyInsertData: any = { ...insertData }
      delete legacyInsertData.ticket_octa
      legacyInsertData.ticket = data.ticketOcta

      ;({ data: newTarefa, error } = await supabase
        .from('omnia_tickets' as any)
        .insert(legacyInsertData)
        .select(tarefaSelect)
        .single())
    }

    if (error) {
      if (recurrenceId) {
        await supabase.from('omnia_ticket_recurrences' as any).delete().eq('id', recurrenceId)
      }
      logger.error('❌ Error creating tarefa:', error);
      logger.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    if (recurrenceId) {
      await supabase
        .from('omnia_ticket_recurrences' as any)
        .update({ template_ticket_id: newTarefa.id })
        .eq('id', recurrenceId)
    }

    return tarefasRepoSupabase.get(newTarefa.id) as Promise<Tarefa>;
  },

  // Update an existing task
  async update(id: string, data: Partial<Omit<Tarefa, 'id' | 'createdAt'>>): Promise<Tarefa | null> {
    const updateData: TablesUpdate<'omnia_tickets'> = {};
    const expectedTicketOcta = data.ticketOcta !== undefined
      ? (data.ticketOcta.trim() || undefined)
      : undefined;
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.due_date = data.dueDate ? data.dueDate.toISOString().split('T')[0] : null;
    if (data.ticketOcta !== undefined) {
      const normalizedTicketOcta = data.ticketOcta.trim();
      updateData.ticket_octa = normalizedTicketOcta || null;
    }
    if (data.statusId !== undefined) updateData.status_id = data.statusId;
    if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo?.id;
    // Sempre incluir oportunidade_id se estiver presente no data, mesmo que seja undefined (para permitir NULL)
    if ('oportunidadeId' in data) updateData.oportunidade_id = data.oportunidadeId || null;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isPrivate !== undefined) updateData.is_private = data.isPrivate;

    const beforeUpdateTarefa = data.recurrence ? await tarefasRepoSupabase.get(id) : null;

    let error: any

    ;({ error } = await supabase
      .from('omnia_tickets' as any)
      .update(updateData)
      .eq('id', id))

    if (error && data.ticketOcta !== undefined && isMissingColumnError(error, 'ticket_octa')) {
      const legacyUpdateData: any = { ...updateData }
      delete legacyUpdateData.ticket_octa
      legacyUpdateData.ticket = updateData.ticket_octa

      ;({ error } = await supabase
        .from('omnia_tickets' as any)
        .update(legacyUpdateData)
        .eq('id', id))
    }

    if (error) {
      logger.error('❌ Error updating tarefa:', error);
      logger.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    const refreshedTarefa = await tarefasRepoSupabase.get(id);

    if (data.recurrence) {
      const recurrenceUpdateData = buildRecurrenceUpdateData(data)
      const recurrenceId = beforeUpdateTarefa?.recurrenceId || refreshedTarefa?.recurrenceId

      if (recurrenceUpdateData && recurrenceId) {
        const { error: recurrenceError } = await supabase
          .from('omnia_ticket_recurrences' as any)
          .update(recurrenceUpdateData)
          .eq('id', recurrenceId)

        if (recurrenceError) {
          logger.error('❌ Error updating tarefa recurrence:', recurrenceError);
          throw recurrenceError;
        }
      } else if (recurrenceUpdateData && data.recurrence.enabled && refreshedTarefa) {
        const recurrenceInsertData = buildRecurrenceInsertData({
          ...refreshedTarefa,
          recurrence: data.recurrence,
        }, refreshedTarefa.createdBy?.id || await getCurrentOmniaUserId())

        if (recurrenceInsertData) {
          const { data: newRecurrence, error: recurrenceError } = await supabase
            .from('omnia_ticket_recurrences' as any)
            .insert({
              ...recurrenceInsertData,
              template_ticket_id: id,
            })
            .select('id')
            .single()

          if (recurrenceError) {
            logger.error('❌ Error creating tarefa recurrence:', recurrenceError);
            throw recurrenceError;
          }

          await supabase
            .from('omnia_tickets' as any)
            .update({ recurrence_id: (newRecurrence as unknown as { id: string }).id, recurrence_occurrence: 1 })
            .eq('id', id)
        }
      }
    }

    const refreshedAfterRecurrence = data.recurrence ? await tarefasRepoSupabase.get(id) : refreshedTarefa;

    if (data.statusId && await isFinalStatus(data.statusId)) {
      await generateNextRecurrenceOccurrence(refreshedAfterRecurrence);
    }

    if (data.ticketOcta !== undefined) {
      const refreshedTicketOcta = refreshedAfterRecurrence?.ticketOcta?.trim() || undefined;
      if (refreshedTicketOcta !== expectedTicketOcta) {
        const verificationError = {
          code: 'UPDATE_NOT_APPLIED',
          message: 'A atualização foi enviada, mas o valor não foi persistido no banco.',
          details: JSON.stringify({
            id,
            field: 'ticket_octa',
            expected: expectedTicketOcta ?? null,
            actual: refreshedTicketOcta ?? null,
          }),
        };
        logger.error('❌ Ticket update verification failed:', verificationError);
        throw verificationError;
      }
    }

    return refreshedAfterRecurrence;
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
      .select(tarefaSelect)
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
      .select(tarefaSelect)
      .or(searchConditions)
      .order('created_at', { ascending: false })
      .limit(20))

    if (error && (isMissingColumnError(error, 'ticket_octa') || isMissingColumnError(error, 'ticket_id'))) {
      // Fallback para schema antigo (sem ticket_octa/ticket_id)
      ;({ data, error } = await supabase
        .from('omnia_tickets' as any)
        .select(tarefaSelect)
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
