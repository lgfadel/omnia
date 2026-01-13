"use client";

import { logger } from '@/lib/logging'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, ChevronDown, User, Lock, Check } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia';
import { TabelaOmnia } from '@/components/ui/tabela-omnia';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useAdmissoesStore } from '@/store/admissoes.store';
import { useAdmissaoStatusStore } from '@/store/admissaoStatus.store';
import { useSecretariosStore } from '@/store/secretarios.store';
import { useTagsStore } from '@/store/tags.store';
import { Admissao, AdmissaoPrioridade } from '@/repositories/admissoesRepo.supabase';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { generateUserColor, getUserInitials } from '@/lib/userColors';
import { DueDateModal } from '@/components/ui/due-date-modal';
import { UserRef } from '@/data/types';

// Type for table row data
type AdmissaoTableRow = Omit<Admissao, 'dueDate' | 'assignedTo'> & {
  dueDate: React.ReactNode;
  dueDateOriginal?: Date | null;
  assignedTo: string;
  responsible: UserRef | undefined;
  ticketIdDisplay: string;
  status: "nao-iniciado" | "em-andamento" | "concluido";
  statusName: string;
  statusColor: string;
  isPrivate: boolean;
};

// Type for grouped data
type GroupedDataItem = {
  type: 'separator' | 'data';
  statusName: string;
  statusColor?: string;
  data?: AdmissaoTableRow;
  count?: number;
};

const columns = [
  { key: "ticketIdDisplay", label: "#", width: "w-[8%]" },
  { key: "title", label: "Título", width: "w-[30%]" },
  { key: "priority", label: "Prioridade", width: "w-[12%]" },
  { key: "dueDate", label: "Vencimento", width: "w-[15%]" },
  { key: "responsible", label: "Responsável", width: "w-[18%]" },
  { key: "ticketOcta", label: "Ticket", width: "w-[10%]" },
  { key: "statusId", label: "Status", width: "w-[15%]" },
  { key: "commentCount", label: "Comentários", width: "w-[10%]" },
  { key: "attachmentCount", label: "Anexos", width: "w-[8%]" }
];

export default function Admissoes() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(true);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [showPrivateTasks, setShowPrivateTasks] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [filteredAdmissoes, setFilteredAdmissoes] = useState<Admissao[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  
  const { 
    admissoes, 
    loading, 
    error, 
    loadAdmissoes, 
    searchAdmissoes,
    clearError,
    deleteAdmissao,
    updateAdmissao
  } = useAdmissoesStore();
  const { 
    statuses, 
    loadStatuses 
  } = useAdmissaoStatusStore();
  const { 
    secretarios, 
    loadSecretarios 
  } = useSecretariosStore();
  const { 
    tags, 
    loadTags 
  } = useTagsStore();

  useEffect(() => {
    loadAdmissoes();
    loadStatuses();
    loadSecretarios();
    loadTags();
  }, [loadAdmissoes, loadStatuses, loadSecretarios, loadTags]);

  // Set up real-time listener for admissoes, comments and attachments
  useEffect(() => {
    const channel = supabase
      .channel('admissoes-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'omnia_admissoes'
        },
        (payload) => {
          console.log('Nova admissão criada:', payload);
          loadAdmissoes();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'omnia_admissoes'
        },
        (payload) => {
          console.log('Admissão atualizada:', payload);
          loadAdmissoes();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'omnia_admissoes'
        },
        (payload) => {
          console.log('Admissão excluída:', payload);
          loadAdmissoes();
        }
      )
      // Listen for comment changes to update counters
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'omnia_admissao_comments'
        },
        (payload) => {
          console.log('Comentário alterado:', payload);
          loadAdmissoes();
        }
      )
      // Listen for attachment changes to update counters
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'omnia_admissao_attachments'
        },
        (payload) => {
          console.log('Anexo alterado:', payload);
          loadAdmissoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAdmissoes]);

  // Filter admissoes based on search query and filters
  useEffect(() => {
    let filtered = admissoes;

    if (showOnlyMyTasks && userProfile) {
      filtered = filtered.filter(task => task.assignedTo?.id === userProfile.id);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const normalized = query.replace(/^#/, '')
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.ticketOcta?.toLowerCase().includes(query) ||
        (task.ticketId != null && String(task.ticketId).includes(normalized))
      );
    }

    if (statusFilter.length > 0) {
      filtered = filtered.filter(task => statusFilter.includes(task.statusId));
    }

    if (!showCompletedTasks) {
      filtered = filtered.filter(task => {
        const currentStatus = statuses.find(s => s.id === task.statusId);
        if (!currentStatus) return true;
        const statusName = currentStatus.name.toLowerCase();
        return !(statusName.includes('concluído') || statusName.includes('finalizado'));
      });
    }

    if (showPrivateTasks) {
      filtered = filtered.filter(task => task.isPrivate === true);
    }

    if (selectedTagFilter) {
      filtered = filtered.filter(task => 
        task.tags && task.tags.includes(selectedTagFilter)
      );
    }

    setFilteredAdmissoes(filtered);
  }, [admissoes, searchQuery, statusFilter, showOnlyMyTasks, userProfile, showCompletedTasks, showPrivateTasks, selectedTagFilter, statuses]);

  const handleView = (id: string | number) => {
    router.push(`/admissoes/${id}`);
  };

  const handleDelete = (id: string | number) => {
    const task = admissoes.find(t => t.id === String(id));
    if (task) {
      setTaskToDelete({ id: String(id), title: task.title });
      setDeleteConfirmOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (taskToDelete) {
      await deleteAdmissao(taskToDelete.id);
      setDeleteConfirmOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleStatusChange = async (id: string | number, statusId: string) => {
    try {
      await updateAdmissao(id.toString(), { statusId });
      loadAdmissoes();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleResponsibleChange = async (id: string | number, userId: string) => {
    try {
      const task = admissoes.find(t => t.id === id.toString());
      const selectedUser = secretarios.find(user => user.id === userId);
      
      if (selectedUser) {
        if (task?.isPrivate) {
          logger.warn('Não é possível alterar responsável de admissoes privadas');
          return;
        }
        
        await updateAdmissao(id.toString(), { assignedTo: selectedUser });
        loadAdmissoes();
      }
    } catch (error) {
      logger.error('Erro ao atualizar responsável:', error);
    }
  };

  const handleDueDateSave = async (newDate: Date | null, taskId: string) => {
    try {
      await updateAdmissao(taskId, { dueDate: newDate ?? undefined });
      loadAdmissoes();
    } catch (error) {
      console.error('Erro ao atualizar data de vencimento:', error);
    }
  };

  const handleTagClick = (tagName: string) => {
    setSelectedTagFilter(selectedTagFilter === tagName ? null : tagName);
  };

  const handlePriorityChange = async (id: string | number, newPriority: string) => {
    try {
      await updateAdmissao(id.toString(), { priority: newPriority as AdmissaoPrioridade });
      loadAdmissoes();
    } catch (error) {
      console.error('Erro ao atualizar prioridade:', error);
    }
  };

  const handleStatusFilterChange = (statusId: string) => {
    setStatusFilter(prev => 
      prev.includes(statusId) 
        ? prev.filter(id => id !== statusId)
        : [...prev, statusId]
    );
  };

  const handleSelectAllStatus = () => {
    const allStatusIds = statuses.map(status => status.id)
    const isAllSelected = allStatusIds.every(id => statusFilter.includes(id))
    
    if (isAllSelected) {
      setStatusFilter([])
    } else {
      setStatusFilter(allStatusIds)
    }
  };

  // Transform data for table display 
  const tableData = filteredAdmissoes.map(tarefa => {
    const currentStatus = statuses.find(s => s.id === tarefa.statusId);
    
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
      dueDate: (
        <DueDateModal
          onSave={(newDate) => handleDueDateSave(newDate, tarefa.id)}
          currentDate={tarefa.dueDate}
          taskTitle={tarefa.title}
        />
      ),
      dueDateOriginal: tarefa.dueDate ?? null,
      assignedTo: tarefa.assignedTo?.name || 'Não atribuído',
      responsible: tarefa.assignedTo,
      ticketIdDisplay: tarefa.ticketId != null ? `#${tarefa.ticketId}` : '',
      ticketOcta: tarefa.ticketOcta || '',
      commentCount: tarefa.commentCount || 0,
      attachmentCount: tarefa.attachmentCount || 0,
      status: mappedStatus,
      statusName: currentStatus?.name || "Status não encontrado",
      statusColor: currentStatus?.color || "#6B7280",
      isPrivate: tarefa.isPrivate || false
    };
  });

  // Sort data
  const sortedData = [...tableData].sort((a, b) => {
    const aStatus = statuses.find(s => s.id === a.statusId);
    const bStatus = statuses.find(s => s.id === b.statusId);
    
    const aOrder = aStatus?.order || 999;
    const bOrder = bStatus?.order || 999;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    const priorityOrder = { 'alta': 1, 'media': 2, 'baixa': 3 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    const aOriginalTask = filteredAdmissoes.find(t => t.id === a.id);
    const bOriginalTask = filteredAdmissoes.find(t => t.id === b.id);
    const aDate = aOriginalTask?.dueDate ? new Date(aOriginalTask.dueDate) : null;
    const bDate = bOriginalTask?.dueDate ? new Date(bOriginalTask.dueDate) : null;
    
    if (aDate && bDate) {
      return aDate.getTime() - bDate.getTime();
    }
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    
    const aCreated = new Date(a.createdAt);
    const bCreated = new Date(b.createdAt);
    return bCreated.getTime() - aCreated.getTime();
  });

  // Group data by status for separators
  const groupedData: GroupedDataItem[] = [];
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
              loadAdmissoes();
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
            { label: "Admissões", isActive: true }
          ]} 
        />
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admissões</h1>
          </div>
          
          <Button 
            onClick={() => router.push('/admissoes/new')}
            className="bg-primary hover:bg-primary/90 w-12 h-12 p-0 rounded-lg flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por título, descrição, nº ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-10 px-3 flex items-center justify-center transition-all duration-200 bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuCheckboxItem
                    checked={statuses.length > 0 && statuses.every(status => statusFilter.includes(status.id))}
                    onCheckedChange={handleSelectAllStatus}
                    className="font-medium"
                  >
                    Selecionar todos
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
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
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                className={`h-10 px-3 text-xs font-medium transition-all duration-200 ${
                  showCompletedTasks 
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Check className={`w-4 h-4 ${
                  showCompletedTasks ? 'text-green-600' : 'text-gray-400'
                }`} />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrivateTasks(!showPrivateTasks)}
                className={`h-10 px-3 text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                  showPrivateTasks 
                    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Lock className="w-3 h-3" />
              </Button>
              
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
                className={`rounded-full w-10 h-10 p-0 flex items-center justify-center text-xs font-medium self-center transition-all duration-200 ${
                  showOnlyMyTasks 
                    ? 'shadow-lg ring-2 ring-offset-1' 
                    : 'shadow-sm hover:shadow-md'
                }`}
                style={{
                  backgroundColor: showOnlyMyTasks 
                    ? (userProfile ? (userProfile.color || generateUserColor(userProfile.id, userProfile.name)) : '#FBBF24')
                    : '#F3F4F6',
                  borderColor: showOnlyMyTasks 
                    ? (userProfile ? (userProfile.color || generateUserColor(userProfile.id, userProfile.name)) : '#FBBF24')
                    : '#D1D5DB',
                  color: showOnlyMyTasks ? 'white' : '#6B7280',
                  ...(showOnlyMyTasks && userProfile && {
                    '--tw-ring-color': (userProfile.color || generateUserColor(userProfile.id, userProfile.name)) + '50'
                  })
                }}
              >
                {userProfile ? getUserInitials(userProfile.name) : <User className="w-3 h-3" />}
              </Button>
            </div>
          </div>
          
          {selectedTagFilter && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-600">Filtrando por tag:</span>
              <Badge
                variant="secondary"
                className="text-xs px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: tags.find(tag => tag.name === selectedTagFilter)?.color ? 
                    `${tags.find(tag => tag.name === selectedTagFilter)?.color}20` : undefined,
                  borderColor: tags.find(tag => tag.name === selectedTagFilter)?.color || undefined,
                  color: tags.find(tag => tag.name === selectedTagFilter)?.color || undefined
                }}
                onClick={() => setSelectedTagFilter(null)}
              >
                {selectedTagFilter} ✕
              </Badge>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando admissoes...
            </div>
          ) : (
            <TabelaOmnia
              columns={columns}
              data={groupedData}
              onView={handleView}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onResponsibleChange={handleResponsibleChange}
              onPriorityChange={handlePriorityChange}
              onTagClick={handleTagClick}
              availableStatuses={statuses}
              availableUsers={secretarios}
              availableTags={tags}
              grouped={true}
            />
          )}
        </div>
      </div>
      
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tarefa "{taskToDelete?.title}"?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
