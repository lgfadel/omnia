import { supabase } from '@/integrations/supabase/client';
import type { UserRef, Attachment, Comment } from '@/data/fixtures';

export type TicketPriority = 'ALTA' | 'NORMAL' | 'BAIXA';

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  priority: TicketPriority;
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

function transformTicketFromDB(dbTicket: any): Ticket {
  return {
    id: dbTicket.id,
    title: dbTicket.title,
    description: dbTicket.description,
    priority: dbTicket.priority as TicketPriority,
    dueDate: dbTicket.due_date ? new Date(dbTicket.due_date) : undefined,
    ticket: dbTicket.ticket,
    statusId: dbTicket.status_id,
    assignedTo: dbTicket.assigned_to_user ? {
      id: dbTicket.assigned_to_user.id,
      name: dbTicket.assigned_to_user.name,
      email: dbTicket.assigned_to_user.email,
      roles: dbTicket.assigned_to_user.roles,
      avatarUrl: dbTicket.assigned_to_user.avatar_url,
      color: dbTicket.assigned_to_user.color,
    } : undefined,
    createdBy: dbTicket.created_by_user ? {
      id: dbTicket.created_by_user.id,
      name: dbTicket.created_by_user.name,
      email: dbTicket.created_by_user.email,
      roles: dbTicket.created_by_user.roles,
      avatarUrl: dbTicket.created_by_user.avatar_url,
      color: dbTicket.created_by_user.color,
    } : undefined,
    tags: dbTicket.tags || [],
    commentCount: dbTicket.comment_count || 0,
    createdAt: new Date(dbTicket.created_at),
    updatedAt: new Date(dbTicket.updated_at),
  };
}

export const ticketsRepoSupabase = {
  async list(): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('omnia_tickets')
      .select(`
        *,
        assigned_to_user:assigned_to(id, name, email, roles, avatar_url, color),
        created_by_user:created_by(id, name, email, roles, avatar_url, color)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar tickets:', error);
      throw error;
    }

    return data?.map(transformTicketFromDB) || [];
  },

  async getById(id: string): Promise<Ticket | null> {
    const { data, error } = await supabase
      .from('omnia_tickets')
      .select(`
        *,
        assigned_to_user:assigned_to(id, name, email, roles, avatar_url, color),
        created_by_user:created_by(id, name, email, roles, avatar_url, color)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Erro ao buscar ticket:', error);
      throw error;
    }

    return data ? transformTicketFromDB(data) : null;
  },

  async create(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>): Promise<Ticket> {
    const { data: currentUser } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('omnia_tickets')
      .insert({
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        due_date: ticket.dueDate?.toISOString().split('T')[0],
        ticket: ticket.ticket,
        status_id: ticket.statusId,
        assigned_to: ticket.assignedTo?.id,
        created_by: currentUser?.user?.id,
        tags: ticket.tags,
      })
      .select(`
        *,
        assigned_to_user:assigned_to(id, name, email, roles, avatar_url, color),
        created_by_user:created_by(id, name, email, roles, avatar_url, color)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar ticket:', error);
      throw error;
    }

    return transformTicketFromDB(data);
  },

  async update(id: string, ticket: Partial<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>>): Promise<Ticket | null> {
    const updateData: any = {};
    
    if (ticket.title !== undefined) updateData.title = ticket.title;
    if (ticket.description !== undefined) updateData.description = ticket.description;
    if (ticket.priority !== undefined) updateData.priority = ticket.priority;
    if (ticket.dueDate !== undefined) {
      updateData.due_date = ticket.dueDate?.toISOString().split('T')[0] || null;
    }
    if (ticket.ticket !== undefined) updateData.ticket = ticket.ticket;
    if (ticket.statusId !== undefined) updateData.status_id = ticket.statusId;
    if (ticket.assignedTo !== undefined) updateData.assigned_to = ticket.assignedTo?.id || null;
    if (ticket.tags !== undefined) updateData.tags = ticket.tags;

    const { data, error } = await supabase
      .from('omnia_tickets')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        assigned_to_user:assigned_to(id, name, email, roles, avatar_url, color),
        created_by_user:created_by(id, name, email, roles, avatar_url, color)
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar ticket:', error);
      throw error;
    }

    return data ? transformTicketFromDB(data) : null;
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_tickets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar ticket:', error);
      throw error;
    }

    return true;
  },

  async search(query: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('omnia_tickets')
      .select(`
        *,
        assigned_to_user:assigned_to(id, name, email, roles, avatar_url, color),
        created_by_user:created_by(id, name, email, roles, avatar_url, color)
      `)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,ticket.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar tickets:', error);
      throw error;
    }

    return data?.map(transformTicketFromDB) || [];
  },
};