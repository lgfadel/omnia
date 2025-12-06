import { supabase } from '@/integrations/supabase/client';
import { logger } from '../lib/logging';


export interface TarefaStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

function transformTarefaStatusFromDB(dbTarefaStatus: any): TarefaStatus {
  return {
    id: dbTarefaStatus.id,
    name: dbTarefaStatus.name,
    color: dbTarefaStatus.color,
    order: dbTarefaStatus.order_position,
    isDefault: dbTarefaStatus.is_default,
    createdAt: dbTarefaStatus.created_at ? new Date(dbTarefaStatus.created_at) : undefined,
    updatedAt: dbTarefaStatus.updated_at ? new Date(dbTarefaStatus.updated_at) : undefined,
  };
}

export const tarefaStatusRepoSupabase = {
  async list(): Promise<TarefaStatus[]> {
    logger.debug('Loading tarefa statuses from database...')
    
    const { data, error } = await supabase
      .from('omnia_ticket_statuses' as any)
      .select('*')
      .order('order_position');

    if (error) {
      logger.error('Erro ao buscar status de tickets:', error);
      throw error;
    }

    return data?.map(transformTarefaStatusFromDB) || [];
  },

  async create(data: Omit<TarefaStatus, 'id'>): Promise<TarefaStatus> {
    logger.debug('Creating tarefa status:', data)
    
    // Get the next order position
    const { data: lastStatus } = await supabase
      .from('omnia_ticket_statuses' as any)
      .select('order_position')
      .order('order_position', { ascending: false })
      .limit(1) as any;

    const nextOrder = lastStatus && lastStatus.length > 0 ? lastStatus[0].order_position + 1 : 1;

    const { data: newStatus, error } = await supabase
      .from('omnia_ticket_statuses' as any)
      .insert({
        name: data.name,
        color: data.color,
        order_position: nextOrder,
        is_default: data.isDefault || false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Erro ao criar status de ticket:', error);
      throw error;
    }

    return transformTarefaStatusFromDB(newStatus);
  },

  async update(id: string, data: Partial<Omit<TarefaStatus, 'id'>>): Promise<TarefaStatus | null> {
    logger.debug(`Updating tarefa status: ${id}`, data)
    
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.order !== undefined) updateData.order_position = data.order;
    if (data.isDefault !== undefined) updateData.is_default = data.isDefault;

    const { data: updatedStatus, error } = await supabase
      .from('omnia_ticket_statuses' as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Erro ao atualizar status de ticket:', error);
      throw error;
    }

    return updatedStatus ? transformTarefaStatusFromDB(updatedStatus) : null;
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing tarefa status: ${id}`)
    
    // Check if it's a default status
    const { data: status } = await supabase
      .from('omnia_ticket_statuses' as any)
      .select('is_default')
      .eq('id', id)
      .maybeSingle();

    if ((status as any)?.is_default) {
      throw new Error('Não é possível deletar um status padrão');
    }

    const { error } = await supabase
      .from('omnia_ticket_statuses' as any)
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Erro ao deletar status de ticket:', error);
      throw error;
    }

    return true;
  },

  async reorder(statuses: TarefaStatus[]): Promise<void> {
    logger.debug('Reordering tarefa statuses:', statuses)
    
    const updates = statuses.map((status, index) => ({
      id: status.id,
      order_position: index + 1,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('omnia_ticket_statuses' as any)
        .update({ order_position: update.order_position })
        .eq('id', update.id);

      if (error) {
        logger.error('Erro ao reordenar status de tickets:', error);
        throw error;
      }
    }
  }
}