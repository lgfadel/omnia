"use client";

import { Layout } from '@/components/layout/Layout';
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia';
import { TicketStatusList } from '@/components/tickets/TicketStatusList';
import { TicketStatusForm } from '@/components/tickets/TicketStatusForm';
import { useTarefaStatusStore } from '@/store/tarefaStatus.store';
import { TarefaStatus } from '@/repositories/tarefaStatusRepo.supabase';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { handleSupabaseError, createErrorContext } from '@/lib/errorHandler';

export default function ConfigTicketStatus() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<TarefaStatus | null>(null);
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

  const handleCreate = () => {
    setEditingStatus(null);
    setIsFormOpen(true);
  };

  const handleEdit = (status: TarefaStatus) => {
    setEditingStatus(status);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: { name: string; color: string }) => {
    try {
      if (editingStatus) {
        await updateStatus(editingStatus.id, data);
        toast({
          title: "Status atualizado!",
          description: `O status "${data.name}" foi atualizado com sucesso.`
        });
      } else {
        await createStatus({
          name: data.name,
          color: data.color,
          order: statuses.length + 1,
        });
        toast({
          title: "Status criado!",
          description: `O status "${data.name}" foi criado com sucesso.`
        });
      }
      setIsFormOpen(false);
      setEditingStatus(null);
    } catch (error) {
      const treatedError = handleSupabaseError(
        error,
        createErrorContext(editingStatus ? 'update' : 'create', 'status de tarefa', 'omnia_tarefa_status')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const success = await deleteStatus(id);
      if (success) {
        toast({
          title: "Status excluído!",
          description: "O status foi excluído com sucesso."
        });
      }
    } catch (error) {
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'status de tarefa', 'omnia_tarefa_status')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleReorder = async (reorderedStatuses: TarefaStatus[]) => {
    try {
      await reorderStatuses(reorderedStatuses);
      toast({
        title: "Status reordenados!",
        description: "A ordem dos status foi atualizada com sucesso."
      });
    } catch (error) {
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'status de tarefa', 'omnia_tarefa_status')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingStatus(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Configurações", href: "/config" },
            { label: "Status de Tickets", isActive: true }
          ]} 
        />
        
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuração de Status de Tickets</h1>
        </div>

        <TicketStatusList
          statuses={statuses}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreate={handleCreate}
          onReorder={handleReorder}
          isLoading={loading}
        />

        <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingStatus ? "Editar Status" : "Novo Status"}
              </DialogTitle>
            </DialogHeader>
            <TicketStatusForm
              status={editingStatus || undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleCloseForm}
              isLoading={loading}
            />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
