import { Layout } from '@/components/layout/Layout';
import { TicketStatusList } from '@/components/tickets/TicketStatusList';
import { TicketStatusForm } from '@/components/tickets/TicketStatusForm';
import { useTarefaStatusStore } from '@/store/tarefaStatus.store';
import { TarefaStatus } from '@/repositories/tarefaStatusRepo.supabase';
import { useState, useEffect } from 'react';

export default function ConfigTicketStatus() {
  const [editingStatus, setEditingStatus] = useState<TarefaStatus | undefined>(undefined);
  const { 
    statuses, 
    loading, 
    error, 
    loadStatuses, 
    createStatus, 
    updateStatus, 
    deleteStatus, 
    reorderStatuses 
  } = useTarefaStatusStore();

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const handleCreateStatus = async (data: { name: string; color: string }) => {
    await createStatus({
      name: data.name,
      color: data.color,
      order: 0,
    });
  };

  const handleUpdateStatus = async (id: string, statusData: Partial<Omit<TarefaStatus, 'id'>>) => {
    return await updateStatus(id, statusData);
  };

  const handleDeleteStatus = async (id: string) => {
    return await deleteStatus(id);
  };

  const handleReorderStatuses = async (newStatuses: TarefaStatus[]) => {
    await reorderStatuses(newStatuses);
  };

  const handleEditStatus = (status: TarefaStatus) => {
    setEditingStatus(status);
  };

  const handleEditSubmit = async (data: { name: string; color: string }) => {
    if (editingStatus) {
      await updateStatus(editingStatus.id, data);
      setEditingStatus(undefined);
    }
  };

  const handleEditCancel = () => {
    setEditingStatus(undefined);
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            Configurar Status de Tickets
          </h1>
          <p className="text-muted-foreground">
            Gerencie os status disponíveis para tickets do sistema
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <TicketStatusForm 
              status={editingStatus}
              onSubmit={editingStatus ? handleEditSubmit : handleCreateStatus}
              onCancel={handleEditCancel}
              isLoading={loading}
            />
          </div>
          
          <div>
            <TicketStatusList
              statuses={statuses}
              onEdit={handleEditStatus}
              onDelete={handleDeleteStatus}
              onCreate={() => setEditingStatus(undefined)}
              onReorder={handleReorderStatuses}
              isLoading={loading}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}