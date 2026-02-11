import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/db-types';
import { logger } from '../lib/logging';

export interface RescisaoStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

function transformRescisaoStatusFromDB(dbStatus: Tables<'omnia_rescisao_statuses'>): RescisaoStatus {
  return {
    id: dbStatus.id,
    name: dbStatus.name,
    color: dbStatus.color,
    order: dbStatus.order_position,
    isDefault: dbStatus.is_default ?? undefined,
    createdAt: dbStatus.created_at ? new Date(dbStatus.created_at) : undefined,
    updatedAt: dbStatus.updated_at ? new Date(dbStatus.updated_at) : undefined,
  };
}

export const rescisaoStatusRepoSupabase = {
  async list(): Promise<RescisaoStatus[]> {
    logger.debug('Loading rescisão statuses from database...')
    
    const { data, error } = await supabase
      .from('omnia_rescisao_statuses')
      .select('*')
      .order('order_position');

    if (error) {
      logger.error('Erro ao buscar status de rescisão:', error);
      throw error;
    }

    return data?.map(transformRescisaoStatusFromDB) || [];
  },

  async create(data: Omit<RescisaoStatus, 'id'>): Promise<RescisaoStatus> {
    logger.debug('Creating rescisão status:', data)
    
    const { data: lastStatus } = await supabase
      .from('omnia_rescisao_statuses')
      .select('order_position')
      .order('order_position', { ascending: false })
      .limit(1);

    const nextOrder = lastStatus && lastStatus.length > 0 ? lastStatus[0].order_position + 1 : 1;

    const { data: newStatus, error } = await supabase
      .from('omnia_rescisao_statuses')
      .insert({
        name: data.name,
        color: data.color,
        order_position: nextOrder,
        is_default: data.isDefault || false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Erro ao criar status de rescisão:', error);
      throw error;
    }

    return transformRescisaoStatusFromDB(newStatus);
  },

  async update(id: string, data: Partial<Omit<RescisaoStatus, 'id'>>): Promise<RescisaoStatus | null> {
    logger.debug(`Updating rescisão status: ${id}`, data)
    
    const updateData: TablesUpdate<'omnia_rescisao_statuses'> = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.order !== undefined) updateData.order_position = data.order;
    if (data.isDefault !== undefined) updateData.is_default = data.isDefault;

    const { data: updatedStatus, error } = await supabase
      .from('omnia_rescisao_statuses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Erro ao atualizar status de rescisão:', error);
      throw error;
    }

    return updatedStatus ? transformRescisaoStatusFromDB(updatedStatus) : null;
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing rescisão status: ${id}`)
    
    const { data: status } = await supabase
      .from('omnia_rescisao_statuses')
      .select('is_default')
      .eq('id', id)
      .maybeSingle();

    if (status?.is_default) {
      throw new Error('Não é possível deletar um status padrão');
    }

    const { error } = await supabase
      .from('omnia_rescisao_statuses')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Erro ao deletar status de rescisão:', error);
      throw error;
    }

    return true;
  },

  async reorder(statuses: RescisaoStatus[]): Promise<void> {
    logger.debug('Reordering rescisão statuses:', statuses)
    
    const updates = statuses.map((status, index) => ({
      id: status.id,
      order_position: index + 1,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('omnia_rescisao_statuses')
        .update({ order_position: update.order_position })
        .eq('id', update.id);

      if (error) {
        logger.error('Erro ao reordenar status de rescisão:', error);
        throw error;
      }
    }
  }
}
