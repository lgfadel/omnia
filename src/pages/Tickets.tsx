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
import { useSecretariosStore } from '@/store/secretarios.store';
import { Tarefa } from '@/repositories/tarefasRepo.supabase';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { generateUserColor, getUserInitials } from '@/lib/userColors';
import { DueDateModal } from '@/components/ui/due-date-modal';

const columns = [
  { key: "title", label: "Título", width: "w-[30%]" },
  { key: "priority", label: "Prioridade", width: "w-[12%]" },
  { key: "dueDate", label: "Vencimento", width: "w-[15%]" },
  { key: "responsible", label: "Responsável", width: "w-[18%]" },
  { key: "statusId", label: "Status", width: "w-[15%]" },
  { key: "commentCount", label: "Comentários", width: "w-[10%]" }
];

export default function Tickets() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);
  const [filteredTickets, setFilteredTickets] = useState<Tarefa[]>([]);
  const [dueDateModalOpen, setDueDateModalOpen] = useState(false);
  const [selectedTaskForDueDate, setSelectedTaskForDueDate] = useState<{ id: string; title: string; currentDate?: Date | null }>({ id: '', title: '' });
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
  const { 
    secretarios, 
    loadSecretarios 
  } = useSecretariosStore();

  useEffect(() => {
    loadTarefas();
    loadStatuses();
    loadSecretarios();
  }, [loadTarefas, loadStatuses, loadSecretarios]);


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

  // Filter tasks based on search, status, and "my tasks" filter
  useEffect(() => {
    let filtered = tarefas;

    // Apply "my tasks" filter
    if (showOnlyMyTasks && userProfile) {
      filtered = filtered.filter(task => task.assignedTo?.id === userProfile.id);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.ticket?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(task => statusFilter.includes(task.statusId));
    }

    // Apply completed tasks filter
    if (!showCompletedTasks) {
      filtered = filtered.filter(task => {
        const currentStatus = statuses.find(s => s.id === task.statusId);
        if (!currentStatus) return true;
        const statusName = currentStatus.name.toLowerCase();
        return !(statusName.includes('concluído') || statusName.includes('finalizado'));
      });
    }

    setFilteredTickets(filtered);
  }, [tarefas, searchQuery, statusFilter, showOnlyMyTasks, userProfile, showCompletedTasks, statuses]);

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

  const handleResponsibleChange = async (id: string | number, userId: string) => {
    try {
      const selectedUser = secretarios.find(user => user.id === userId);
      if (selectedUser) {
        await updateTarefa(id.toString(), { assignedTo: selectedUser });
        loadTarefas();
      }
    } catch (error) {
      console.error('Erro ao atualizar responsável:', error);
    }
  };

  const handleDueDateClick = (taskId: string, currentDate?: Date) => {
    const task = tarefas.find(t => t.id === taskId);
    if (task) {
      setSelectedTaskForDueDate({
        id: taskId,
        title: task.title,
        currentDate: currentDate || null
      });
      setDueDateModalOpen(true);
    }
  };

  const handleDueDateSave = async (newDate: Date | null) => {
    try {
      await updateTarefa(selectedTaskForDueDate.id, { dueDate: newDate });
      loadTarefas();
    } catch (error) {
      console.error('Erro ao atualizar data de vencimento:', error);
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
    return date.toLocaleDateString('pt-BR');
  };

  const formatDueDateWithStyle = (date?: Date) => {
    if (!date) return '-';
    
    const now = new Date();
    const compareDate = new Date(date);
    // Set time to start of day for accurate comparison
    now.setHours(0, 0, 0, 0);
    compareDate.setHours(0, 0, 0, 0);
    const isOverdue = compareDate < now;
    
    return (
      <span className={isOverdue ? 'text-destructive font-medium' : ''}>
        {date.toLocaleDateString('pt-BR')}
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
      dueDate: tarefa.dueDate ? formatDueDateWithStyle(tarefa.dueDate) : '-',
      dueDateOriginal: tarefa.dueDate, // Keep original date for click handler
      assignedTo: tarefa.assignedTo?.name || 'Não atribuído',
      responsible: tarefa.assignedTo, // Keep the full object for avatar rendering
      createdAt: new Date(tarefa.createdAt).toLocaleDateString('pt-BR'),
      commentCount: tarefa.commentCount || 0,
      status: mappedStatus,
      statusName: currentStatus?.name || "Status não encontrado",
      statusColor: currentStatus?.color || "#6B7280"
    };
  });

  // Sort data by status order_position (ascending), then by priority (high to low), then by due date (ascending)
  const sortedData = [...tableData].sort((a, b) => {
    const aStatus = statuses.find(s => s.id === a.statusId);
    const bStatus = statuses.find(s => s.id === b.statusId);
    
    const aOrder = aStatus?.order || 999;
    const bOrder = bStatus?.order || 999;
    
    // First sort by status order
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // Then sort by priority (alta=1, media=2, baixa=3)
    const priorityOrder = { 'alta': 1, 'media': 2, 'baixa': 3 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Finally sort by due date (earliest first, null dates last)
     const aOriginalTask = filteredTickets.find(t => t.id === a.id);
     const bOriginalTask = filteredTickets.find(t => t.id === b.id);
     const aDate = aOriginalTask?.dueDate ? new Date(aOriginalTask.dueDate) : null;
     const bDate = bOriginalTask?.dueDate ? new Date(bOriginalTask.dueDate) : null;
    
    if (aDate && bDate) {
      return aDate.getTime() - bDate.getTime();
    }
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    
    // If both have no due date, sort by creation date (newest first)
    const aCreated = new Date(a.createdAt);
    const bCreated = new Date(b.createdAt);
    return bCreated.getTime() - aCreated.getTime();
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
              
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
                className={`rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-medium self-center transition-all duration-200 ${
                  showOnlyMyTasks 
                    ? 'shadow-lg ring-2 ring-yellow-300 ring-offset-1' 
                    : 'shadow-sm hover:shadow-md'
                }`}
                style={{
                  backgroundColor: showOnlyMyTasks ? '#FBBF24' : '#F3F4F6',
                  borderColor: showOnlyMyTasks ? '#FBBF24' : '#D1D5DB',
                  color: showOnlyMyTasks ? 'white' : '#6B7280'
                }}
              >
                {userProfile ? getUserInitials(userProfile.name) : <User className="w-3 h-3" />}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                className={`h-8 px-3 text-xs font-medium transition-all duration-200 ${
                  showCompletedTasks 
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {showCompletedTasks ? 'Ocultar Concluídas' : 'Mostrar Concluídas'}
              </Button>
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
              onResponsibleChange={handleResponsibleChange}
              onDueDateClick={handleDueDateClick}
              availableStatuses={statuses}
              availableUsers={secretarios}
              grouped={true}
            />
          )}
        </div>
      </div>
      
      <DueDateModal
        isOpen={dueDateModalOpen}
        onClose={() => setDueDateModalOpen(false)}
        onSave={handleDueDateSave}
        currentDate={selectedTaskForDueDate.currentDate}
        taskTitle={selectedTaskForDueDate.title}
      />
    </Layout>
  );
};