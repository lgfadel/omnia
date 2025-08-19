import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabelaEureka } from '@/components/ui/tabela-eureka';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { Badge } from '@/components/ui/badge';
import { useTicketsStore } from '@/store/tickets.store';
import { useTicketStatusStore } from '@/store/ticketStatus.store';
import { Ticket } from '@/repositories/ticketsRepo.supabase';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Tickets() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const { 
    tickets, 
    loading, 
    error, 
    loadTickets, 
    searchTickets,
    clearError 
  } = useTicketsStore();
  const { 
    statuses, 
    loadStatuses 
  } = useTicketStatusStore();

  useEffect(() => {
    loadTickets();
    loadStatuses();
  }, [loadTickets, loadStatuses]);

  // Set up real-time listener
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'omnia_tickets'
        },
        () => {
          loadTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTickets]);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchTickets(searchQuery);
    } else {
      setFilteredTickets(tickets);
    }
  }, [searchQuery, tickets, searchTickets]);

  const getStatusById = (statusId: string) => {
    return statuses.find(s => s.id === statusId);
  };

  const formatDueDate = (date?: Date) => {
    if (!date) return '-';
    
    const now = new Date();
    const isOverdue = date < now;
    
    return (
      <span className={isOverdue ? 'text-destructive font-medium' : ''}>
        {formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}
      </span>
    );
  };

  const columns = [
    {
      key: 'title',
      label: 'Título',
      sortable: true,
    },
    {
      key: 'priority',
      label: 'Prioridade',
      sortable: true,
    },
    {
      key: 'dueDate',
      label: 'Vencimento',
      sortable: true,
    },
    {
      key: 'assignedTo',
      label: 'Responsável',
    },
    {
      key: 'statusId',
      label: 'Status',
    },
    {
      key: 'commentCount',
      label: 'Comentários',
    },
  ];

  const adaptedTickets = filteredTickets.map(ticket => {
    const status = getStatusById(ticket.statusId);
    return {
      id: ticket.id,
      title: ticket.title,
      priority: ticket.priority,
      dueDate: ticket.dueDate ? formatDueDate(ticket.dueDate) : '-',
      assignedTo: ticket.assignedTo?.name || 'Não atribuído',
      statusId: status?.name || '-',
      commentCount: ticket.commentCount || 0,
      ticket: ticket.ticket,
    };
  });

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => {
              clearError();
              loadTickets();
            }}>
              Tentar Novamente
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Tickets</h1>
            <p className="text-muted-foreground">
              Gerencie tickets e solicitações
            </p>
          </div>
          
          <Link to="/tickets/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Ticket
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por título, descrição ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Button variant="outline" size="default">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>

        <div className="bg-background rounded-lg border">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-muted-foreground">Nenhum ticket encontrado</p>
              <p className="text-sm text-muted-foreground">Crie seu primeiro ticket para começar</p>
            </div>
          ) : (
            <TabelaEureka
              data={adaptedTickets}
              columns={columns}
              onView={(id) => window.location.href = `/tickets/${id}`}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}