import { Layout } from '@/components/layout/Layout';
import { StatusList } from '@/components/status/StatusList';
import { StatusForm } from '@/components/status/StatusForm';
import { useTicketStatusStore } from '@/store/ticketStatus.store';
import { TicketStatus } from '@/repositories/ticketStatusRepo.supabase';

export default function ConfigTicketStatus() {
  const { 
    statuses, 
    loading, 
    error, 
    loadStatuses, 
    createStatus, 
    updateStatus, 
    deleteStatus, 
    reorderStatuses 
  } = useTicketStatusStore();

  const handleCreateStatus = async (data: { name: string; color: string }) => {
    await createStatus({
      name: data.name,
      color: data.color,
      order: 0,
    });
  };

  const handleUpdateStatus = async (id: string, statusData: Partial<Omit<TicketStatus, 'id'>>) => {
    return await updateStatus(id, statusData);
  };

  const handleDeleteStatus = async (id: string) => {
    return await deleteStatus(id);
  };

  const handleReorderStatuses = async (newStatuses: TicketStatus[]) => {
    await reorderStatuses(newStatuses);
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
            <StatusForm 
              onSubmit={handleCreateStatus}
              onCancel={() => {}}
              isLoading={loading}
            />
          </div>
          
          <div>
            <StatusList
              statuses={statuses}
              isLoading={loading}
              onUpdate={handleUpdateStatus}
              onDelete={handleDeleteStatus}
              onReorder={handleReorderStatuses}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}