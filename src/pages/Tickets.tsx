import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, ChevronDown, User } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia';
import { TabelaOmnia } from '@/components/ui/tabela-omnia';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { Badge } from '@/components/ui/badge';
import { useTarefasStore } from '@/store/tarefas.store';
import { useTarefaStatusStore } from '@/store/tarefaStatus.store';
import { Tarefa } from '@/repositories/tarefasRepo.supabase';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const columns = [
  { key: "title", label: "Título", width: "48" },
  { key: "priority", label: "Prioridade", width: "20" },
  { key: "dueDate", label: "Vencimento", width: "24" },
  { key: "assignedTo", label: "Responsável", width: "24" },
  { key: "statusId", label: "Status", width: "20" },
  { key: "commentCount", label: "Comentários", width: "16" }
];

export default function Tickets() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Tarefa[]>([]);
  const { 
    tarefas, 
    loading, 
    error, 
    loadTarefas, 
    searchTarefas,
    clearError,
    deleteTarefa,
    updateTarefa
  } = useTarefasStore();
  const { 
    statuses, 
    loadStatuses 
  } = useTarefaStatusStore();

  useEffect(() => {
    loadTarefas();
    loadStatuses();
  }, [loadTarefas, loadStatuses]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const handleSearch = async () => {
        const results = await searchTarefas(searchQuery);
        setFilteredTickets(results);
      };
      handleSearch();
    } else {
      setFilteredTickets(tarefas);
    }
  }, [searchQuery, tarefas, searchTarefas]);

  // Set up real-time listener
  useEffect(() => {
    const channel = supabase
      .channel('tarefas-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'omnia_tickets'
        },
        (payload) => {
          console.log('Nova tarefa criada:', payload);
          loadTarefas();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'omnia_tickets'
        },
        (payload) => {
          console.log('Tarefa atualizada:', payload);
          loadTarefas();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'omnia_tickets'
        },
        (payload) => {
          console.log('Tarefa excluída:', payload);
          loadTarefas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTarefas]);

  useEffect(() => {
    setFilteredTickets(tarefas);
  }, [tarefas]);

  const handleView = (id: string | number) => {
    navigate(`/tarefas/${id}`);
  };

  const handleDelete = async (id: string | number) => {
    if (confirm("Tem certeza que deseja excluir esta tarefa?")) {
      await deleteTarefa(String(id));
    }
  };

  const handleStatusChange = async (id: string | number, statusId: string) => {
    try {
      await updateTarefa(id.toString(), { statusId });
      loadTarefas();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleStatusFilterChange = (statusId: string) => {
    setStatusFilter(prev => 
      prev.includes(statusId) 
        ? prev.filter(id => id !== statusId)
        : [...prev, statusId]
    );
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

  // Transform data for table display 
  const tableData = filteredTickets.map(tarefa => {
    const currentStatus = statuses.find(s => s.id === tarefa.statusId);
    
    // Map status name to badge variant
    let mappedStatus: "nao-iniciado" | "em-andamento" | "concluido" = "nao-iniciado";
    
    if (currentStatus) {
      const statusName = currentStatus.name.toLowerCase();
      if (statusName.includes('andamento') || statusName.includes('progresso')) {
        mappedStatus = "em-andamento";
      } else if (statusName.includes('concluído') || statusName.includes('finalizado')) {
        mappedStatus = "concluido";
      } else {
        mappedStatus = "nao-iniciado";
      }
    }
    
    return {
      ...tarefa,
      priority: tarefa.priority,
      dueDate: tarefa.dueDate ? formatDueDate(tarefa.dueDate) : '-',
      assignedTo: tarefa.assignedTo?.name || 'Não atribuído',
      createdAt: new Date(tarefa.createdAt).toLocaleDateString('pt-BR'),
      commentCount: tarefa.commentCount || 0,
      status: mappedStatus,
      statusName: currentStatus?.name || "Status não encontrado",
      statusColor: currentStatus?.color || "#6B7280"
    };
  });

  // Sort data by status order_position (ascending), then by creation date (descending)
  const sortedData = [...tableData].sort((a, b) => {
    const aStatus = statuses.find(s => s.id === a.statusId);
    const bStatus = statuses.find(s => s.id === b.statusId);
    
    const aOrder = aStatus?.order || 999;
    const bOrder = bStatus?.order || 999;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    const aDate = new Date(a.createdAt);
    const bDate = new Date(b.createdAt);
    
    return bDate.getTime() - aDate.getTime();
  });

  // Group data by status for separators
  const groupedData: Array<{ type: 'separator' | 'data', statusName: string, statusColor?: string, data?: any, count?: number }> = [];
  let currentStatus = '';
  let currentStatusCount = 0;
  
  sortedData.forEach((row, index) => {
    if (row.statusName !== currentStatus) {
      currentStatus = row.statusName;
      currentStatusCount = sortedData.filter(r => r.statusName === currentStatus).length;
      groupedData.push({
        type: 'separator',
        statusName: row.statusName,
        statusColor: row.statusColor,
        count: currentStatusCount
      });
    }
    groupedData.push({
      type: 'data',
      statusName: row.statusName,
      data: row
    });
  });

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => {
              clearError();
              loadTarefas();
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
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Tarefas", isActive: true }
          ]} 
        />
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Tarefas</h1>
            <p className="text-muted-foreground">Gerencie tarefas e solicitações</p>
          </div>
          
          <Button 
            onClick={() => navigate('/tarefas/new')}
            className="bg-primary hover:bg-primary/90 px-6 py-3 text-base font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            Adicionar Tarefa
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por título, descrição ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[150px] justify-between h-10">
                      {statusFilter.length === 0 
                        ? "Todos os status" 
                        : statusFilter.length === 1 
                        ? statuses.find(s => s.id === statusFilter[0])?.name
                        : `${statusFilter.length} selecionados`
                      }
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {statuses.map((status) => (
                      <DropdownMenuCheckboxItem
                        key={status.id}
                        checked={statusFilter.includes(status.id)}
                        onCheckedChange={() => handleStatusFilterChange(status.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando tarefas...
            </div>
          ) : (
            <TabelaOmnia
              columns={columns}
              data={groupedData}
              onView={handleView}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              availableStatuses={statuses}
              grouped={true}
            />
          )}
        </div>
      </div>
    </Layout>
  );
};