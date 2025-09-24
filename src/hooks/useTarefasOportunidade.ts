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
  assigned_to: string | null;
  assigned_to_user?: {
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
    if (!oportunidadeId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Buscar tickets sem join para evitar problemas de tipagem
      const { data: ticketsData, error: ticketsError } = await (supabase as any)
        .from('omnia_tickets')
        .select('id, title, due_date, priority, status_id, created_at, assigned_to')
        .eq('oportunidade_id', oportunidadeId)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      // Buscar usuários separadamente se necessário
      const userIds = ticketsData?.map(ticket => ticket.assigned_to).filter(Boolean) || [];
      let usersData: any[] = [];
      
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('omnia_users')
          .select('id, name, email, avatar_url, color')
          .in('id', userIds);
        
        if (usersError) throw usersError;
        usersData = users || [];
      }

      // Combinar dados manualmente
      const data = ticketsData?.map(ticket => ({
        ...ticket,
        assigned_to_user: ticket.assigned_to 
          ? usersData.find(user => user.id === ticket.assigned_to)
          : null
      }));

      if (!data) {
        throw new Error('Nenhum dado retornado');
      }

      // Função para mapear status para cores específicas
      const getStatusColor = (statusId: string): string => {
        switch (statusId) {
          case 'ABERTO':
            return '#ef4444'; // Vermelho - Aberto
          case 'EM_ANDAMENTO':
            return '#f59e0b'; // Laranja - Em Andamento
          case 'AGUARDANDO':
            return '#6b7280'; // Cinza - Aguardando
          case 'RESOLVIDO':
          case 'CONCLUIDO':
            return '#10b981'; // Verde - Resolvido/Concluído
          case 'FECHADO':
            return '#374151'; // Cinza escuro - Fechado
          default:
            return '#ef4444'; // Vermelho como padrão (Aberto)
        }
      };

      // Função para mapear status para labels
      const getStatusLabel = (statusId: string): string => {
        switch (statusId) {
          case 'ABERTO':
            return 'Aberto';
          case 'EM_ANDAMENTO':
            return 'Em Andamento';
          case 'AGUARDANDO':
            return 'Aguardando';
          case 'RESOLVIDO':
            return 'Resolvido';
          case 'CONCLUIDO':
            return 'Concluído';
          case 'FECHADO':
            return 'Fechado';
          default:
            return 'Aberto';
        }
      };

      const transformedTarefas: TarefaOportunidade[] = (data || []).map((item: TicketData) => ({
        id: item.id,
        title: item.title,
        dueDate: item.due_date ? new Date(item.due_date + 'T00:00:00') : undefined,
        status: item.status_id,
        statusColor: getStatusColor(item.status_id),
        statusLabel: getStatusLabel(item.status_id),
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