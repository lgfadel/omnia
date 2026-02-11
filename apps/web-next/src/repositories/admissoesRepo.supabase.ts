import { supabase } from "@/integrations/supabase/client";
import type { UserRef } from '@/data/types';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/db-types';
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

export type AdmissaoPrioridade = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';

export interface Admissao {
  id: string;
  title: string;
  description?: string;
  priority: AdmissaoPrioridade;
  dueDate?: Date;
  ticketOcta?: string;
  ticketId?: number;
  statusId: string;
  assignedTo?: UserRef;
  createdBy?: UserRef;
  tags: string[];
  commentCount: number;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
  isPrivate: boolean;
}

const isMissingColumnError = (error: any, column: string) => {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('column') && msg.includes(column) && (msg.includes('does not exist') || msg.includes('not found'));
};

function transformAdmissaoFromDB(dbAdmissao: any): Admissao {
  return {
    id: dbAdmissao.id,
    title: dbAdmissao.title,
    description: dbAdmissao.description || undefined,
    priority: dbAdmissao.priority as AdmissaoPrioridade,
    dueDate: dbAdmissao.due_date ? new Date(dbAdmissao.due_date + 'T00:00:00') : undefined,
    ticketOcta: dbAdmissao.ticket_octa || undefined,
    ticketId: dbAdmissao.ticket_id,
    statusId: dbAdmissao.status_id,
    assignedTo: dbAdmissao.assigned_to_user ? {
      id: dbAdmissao.assigned_to_user.id,
      name: dbAdmissao.assigned_to_user.name,
      email: dbAdmissao.assigned_to_user.email,
      roles: dbAdmissao.assigned_to_user.roles || [],
      avatarUrl: dbAdmissao.assigned_to_user.avatar_url || undefined,
      color: dbAdmissao.assigned_to_user.color || '#3B82F6',
    } : undefined,
    createdBy: dbAdmissao.created_by_user ? {
      id: dbAdmissao.created_by_user.id,
      name: dbAdmissao.created_by_user.name,
      email: dbAdmissao.created_by_user.email,
      roles: dbAdmissao.created_by_user.roles || [],
      avatarUrl: dbAdmissao.created_by_user.avatar_url || undefined,
      color: dbAdmissao.created_by_user.color || '#3B82F6',
    } : undefined,
    tags: dbAdmissao.tags || [],
    commentCount: dbAdmissao.comment_count || 0,
    attachmentCount: dbAdmissao.attachment_count || 0,
    createdAt: new Date(dbAdmissao.created_at),
    updatedAt: new Date(dbAdmissao.updated_at),
    isPrivate: dbAdmissao.is_private || false,
  };
}

export const admissoesRepoSupabase = {
  async list(): Promise<Admissao[]> {
    logger.debug('Loading admissões from database...')
    
    const { data, error } = await supabase
      .from('omnia_admissoes')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_admissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_admissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar admissões:', error);
      throw error;
    }

    return data?.map(transformAdmissaoFromDB) || [];
  },

  async get(id: string): Promise<Admissao | null> {
    logger.debug(`Getting admissão: ${id}`)
    
    const { data, error } = await supabase
      .from('omnia_admissoes')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_admissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_admissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Erro ao buscar admissão:', error);
      throw error;
    }

    return data ? transformAdmissaoFromDB(data) : null;
  },

  async create(admissaoData: Omit<Admissao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>): Promise<Admissao> {
    logger.debug('Creating admissão:', admissaoData)
    
    const createdById = await getCurrentOmniaUserId();

    const insertData: TablesInsert<'omnia_admissoes'> = {
      title: admissaoData.title,
      description: admissaoData.description || null,
      priority: admissaoData.priority,
      due_date: admissaoData.dueDate ? admissaoData.dueDate.toISOString().split('T')[0] : null,
      ticket_octa: admissaoData.ticketOcta || null,
      status_id: admissaoData.statusId,
      assigned_to: admissaoData.assignedTo?.id || null,
      created_by: createdById,
      tags: admissaoData.tags || [],
      is_private: admissaoData.isPrivate || false,
    };

    const { data, error } = await supabase
      .from('omnia_admissoes')
      .insert(insertData)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_admissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_admissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .single();

    if (error) {
      logger.error('Erro ao criar admissão:', error);
      throw error;
    }

    return transformAdmissaoFromDB(data);
  },

  async update(id: string, admissaoData: Partial<Omit<Admissao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>>): Promise<Admissao | null> {
    logger.debug(`Updating admissão: ${id}`, admissaoData)
    
    const updateData: TablesUpdate<'omnia_admissoes'> = {};

    if (admissaoData.title !== undefined) updateData.title = admissaoData.title;
    if (admissaoData.description !== undefined) updateData.description = admissaoData.description || null;
    if (admissaoData.priority !== undefined) updateData.priority = admissaoData.priority;
    if (admissaoData.dueDate !== undefined) updateData.due_date = admissaoData.dueDate ? admissaoData.dueDate.toISOString().split('T')[0] : null;
    if (admissaoData.ticketOcta !== undefined) updateData.ticket_octa = admissaoData.ticketOcta || null;
    if (admissaoData.statusId !== undefined) updateData.status_id = admissaoData.statusId;
    if (admissaoData.assignedTo !== undefined) updateData.assigned_to = admissaoData.assignedTo?.id || null;
    if (admissaoData.tags !== undefined) updateData.tags = admissaoData.tags;
    if (admissaoData.isPrivate !== undefined) updateData.is_private = admissaoData.isPrivate;

    const { data, error } = await supabase
      .from('omnia_admissoes')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_admissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_admissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .single();

    if (error) {
      logger.error('Erro ao atualizar admissão:', error);
      throw error;
    }

    return data ? transformAdmissaoFromDB(data) : null;
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing admissão: ${id}`)
    
    const { error } = await supabase
      .from('omnia_admissoes')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Erro ao deletar admissão:', error);
      throw error;
    }

    return true;
  },

  async search(query: string): Promise<Admissao[]> {
    logger.debug(`Searching admissões: ${query}`)
    
    const { data, error } = await supabase
      .from('omnia_admissoes')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_admissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_admissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,ticket_octa.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar admissões:', error);
      throw error;
    }

    return data?.map(transformAdmissaoFromDB) || [];
  }
};
