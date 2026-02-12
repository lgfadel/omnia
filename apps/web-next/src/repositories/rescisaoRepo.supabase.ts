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

export type RescisaoPrioridade = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';

export interface Rescisao {
  id: string;
  title: string;
  description?: string;
  priority: RescisaoPrioridade;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JOIN select returns nested relations, not flat Row
function transformRescisaoFromDB(dbRescisao: any): Rescisao {
  return {
    id: dbRescisao.id,
    title: dbRescisao.title,
    description: dbRescisao.description || undefined,
    priority: dbRescisao.priority as RescisaoPrioridade,
    dueDate: dbRescisao.due_date ? new Date(dbRescisao.due_date + 'T00:00:00') : undefined,
    ticketOcta: dbRescisao.ticket_octa || undefined,
    ticketId: dbRescisao.ticket_id,
    statusId: dbRescisao.status_id,
    assignedTo: dbRescisao.assigned_to_user ? {
      id: dbRescisao.assigned_to_user.id,
      name: dbRescisao.assigned_to_user.name,
      email: dbRescisao.assigned_to_user.email,
      roles: dbRescisao.assigned_to_user.roles || [],
      avatarUrl: dbRescisao.assigned_to_user.avatar_url || undefined,
      color: dbRescisao.assigned_to_user.color || '#3B82F6',
    } : undefined,
    createdBy: dbRescisao.created_by_user ? {
      id: dbRescisao.created_by_user.id,
      name: dbRescisao.created_by_user.name,
      email: dbRescisao.created_by_user.email,
      roles: dbRescisao.created_by_user.roles || [],
      avatarUrl: dbRescisao.created_by_user.avatar_url || undefined,
      color: dbRescisao.created_by_user.color || '#3B82F6',
    } : undefined,
    tags: dbRescisao.tags || [],
    commentCount: dbRescisao.comment_count || 0,
    attachmentCount: dbRescisao.attachment_count || 0,
    createdAt: new Date(dbRescisao.created_at),
    updatedAt: new Date(dbRescisao.updated_at),
    isPrivate: dbRescisao.is_private || false,
  };
}

export const rescisaoRepoSupabase = {
  async list(): Promise<Rescisao[]> {
    logger.debug('Loading rescisões from database...')
    
    const { data, error } = await supabase
      .from('omnia_rescisoes')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_demissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_demissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar rescisões:', error);
      throw error;
    }

    return data?.map(transformRescisaoFromDB) || [];
  },

  async get(id: string): Promise<Rescisao | null> {
    logger.debug(`Getting rescisão: ${id}`)
    
    const { data, error } = await supabase
      .from('omnia_rescisoes')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_demissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_demissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Erro ao buscar rescisão:', error);
      throw error;
    }

    return data ? transformRescisaoFromDB(data) : null;
  },

  async create(rescisaoData: Omit<Rescisao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>): Promise<Rescisao> {
    logger.debug('Creating rescisão:', rescisaoData)
    
    const createdById = await getCurrentOmniaUserId();

    const insertData: TablesInsert<'omnia_rescisoes'> = {
      title: rescisaoData.title,
      description: rescisaoData.description || null,
      priority: rescisaoData.priority,
      due_date: rescisaoData.dueDate ? rescisaoData.dueDate.toISOString().split('T')[0] : null,
      ticket_octa: rescisaoData.ticketOcta || null,
      status_id: rescisaoData.statusId,
      assigned_to: rescisaoData.assignedTo?.id || null,
      created_by: createdById,
      tags: rescisaoData.tags || [],
      is_private: rescisaoData.isPrivate || false,
    };

    const { data, error } = await supabase
      .from('omnia_rescisoes')
      .insert(insertData)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_demissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_demissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .single();

    if (error) {
      logger.error('Erro ao criar rescisão:', error);
      throw error;
    }

    return transformRescisaoFromDB(data);
  },

  async update(id: string, rescisaoData: Partial<Omit<Rescisao, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'attachmentCount'>>): Promise<Rescisao | null> {
    logger.debug(`Updating rescisão: ${id}`, rescisaoData)
    
    const updateData: TablesUpdate<'omnia_rescisoes'> = {};

    if (rescisaoData.title !== undefined) updateData.title = rescisaoData.title;
    if (rescisaoData.description !== undefined) updateData.description = rescisaoData.description || null;
    if (rescisaoData.priority !== undefined) updateData.priority = rescisaoData.priority;
    if (rescisaoData.dueDate !== undefined) updateData.due_date = rescisaoData.dueDate ? rescisaoData.dueDate.toISOString().split('T')[0] : null;
    if (rescisaoData.ticketOcta !== undefined) updateData.ticket_octa = rescisaoData.ticketOcta || null;
    if (rescisaoData.statusId !== undefined) updateData.status_id = rescisaoData.statusId;
    if (rescisaoData.assignedTo !== undefined) updateData.assigned_to = rescisaoData.assignedTo?.id || null;
    if (rescisaoData.tags !== undefined) updateData.tags = rescisaoData.tags;
    if (rescisaoData.isPrivate !== undefined) updateData.is_private = rescisaoData.isPrivate;

    const { data, error } = await supabase
      .from('omnia_rescisoes')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_demissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_demissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .single();

    if (error) {
      logger.error('Erro ao atualizar rescisão:', error);
      throw error;
    }

    return data ? transformRescisaoFromDB(data) : null;
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing rescisão: ${id}`)
    
    const { error } = await supabase
      .from('omnia_rescisoes')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Erro ao deletar rescisão:', error);
      throw error;
    }

    return true;
  },

  async search(query: string): Promise<Rescisao[]> {
    logger.debug(`Searching rescisões: ${query}`)
    
    const { data, error } = await supabase
      .from('omnia_rescisoes')
      .select(`
        *,
        assigned_to_user:omnia_users!omnia_demissoes_assigned_to_fkey(id, name, email, roles, avatar_url, color),
        created_by_user:omnia_users!omnia_demissoes_created_by_fkey(id, name, email, roles, avatar_url, color)
      `)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,ticket_octa.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar rescisões:', error);
      throw error;
    }

    return data?.map(transformRescisaoFromDB) || [];
  }
};
