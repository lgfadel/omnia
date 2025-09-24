import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TarefaOportunidade {
  id: string;
  title: string;
  dueDate?: Date;
  status: string;
  statusColor: string;
  statusLabel: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    color?: string;
  };
  priority: 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';
  createdAt: Date;
}

interface TicketData {
  id: string;
  title: string;
  due_date: string | null;
  priority: 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';
  status_id: string;
  created_at: string;
  assigned_to_user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    color: string | null;
  } | null;
}

export function useTarefasOportunidade(oportunidadeId: string) {
  const [tarefas, setTarefas] = useState<TarefaOportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTarefas = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await (supabase
        .from('omnia_tickets')
        .select(`
          id,
          title,
          due_date,
          priority,
          status_id,
          created_at,
          assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(
            id,
            name,
            email,
            avatar_url,
            color
          )
        `)
        .eq('oportunidade_id', oportunidadeId)
        .order('created_at', { ascending: false }) as any);

      if (supabaseError) {
        throw supabaseError;
      }

      const transformedTarefas: TarefaOportunidade[] = (data as TicketData[] || []).map((item) => ({
        id: item.id,
        title: item.title,
        dueDate: item.due_date ? new Date(item.due_date + 'T00:00:00') : undefined,
        status: item.status_id,
        statusColor: item.status_id === 'ABERTO' ? '#ef4444' : 
                    item.status_id === 'EM_ANDAMENTO' ? '#f59e0b' : 
                    item.status_id === 'CONCLUIDO' ? '#10b981' : '#6b7280',
        statusLabel: item.status_id === 'ABERTO' ? 'Aberto' : 
                    item.status_id === 'EM_ANDAMENTO' ? 'Em Andamento' : 
                    item.status_id === 'CONCLUIDO' ? 'Concluído' : 'Pendente',
        assignedTo: item.assigned_to_user ? {
          id: item.assigned_to_user.id,
          name: item.assigned_to_user.name,
          email: item.assigned_to_user.email,
          avatarUrl: item.assigned_to_user.avatar_url || undefined,
          color: item.assigned_to_user.color || undefined,
        } : undefined,
        priority: item.priority,
        createdAt: new Date(item.created_at),
      }));

      setTarefas(transformedTarefas);
    } catch (err) {
      console.error('Erro ao buscar tarefas da oportunidade:', err);
      setError('Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (oportunidadeId) {
      fetchTarefas();
    }
  }, [oportunidadeId]);

  return {
    tarefas,
    loading,
    error,
    refetch: fetchTarefas,
  };
}