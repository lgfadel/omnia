"use client";

import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { StatusList } from "@/components/status/StatusList";
import { StatusForm } from "@/components/status/StatusForm";
import { useStatusStore } from "@/stores/status.store";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Status } from "@/data/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";
import { logger } from '@/lib/logging';

const ConfigStatus = () => {
  const { toast } = useToast();
  const {
    statuses,
    loading,
    error,
    loadStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
    clearError
  } = useStatusStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);

  useEffect(() => {
    logger.debug('ConfigStatus: Component mounted, loading statuses...')
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    if (error) {
      logger.error('ConfigStatus: Error detected:', error)
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const handleCreate = () => {
    logger.debug('ConfigStatus: Opening create form')
    setEditingStatus(null);
    setIsFormOpen(true);
  };

  const handleEdit = (status: Status) => {
    logger.debug('ConfigStatus: Opening edit form for status:', status)
    setEditingStatus(status);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: { name: string; color: string }) => {
    logger.debug('ConfigStatus: Submitting form:', data)
    
    try {
      if (editingStatus) {
        await updateStatus(editingStatus.id, data);
        toast({
          title: "Status atualizado!",
          description: `O status "${data.name}" foi atualizado com sucesso.`
        });
      } else {
        await createStatus({
          ...data,
          order: statuses.length + 1
        });
        toast({
          title: "Status criado!",
          description: `O status "${data.name}" foi criado com sucesso.`
        });
      }
      setIsFormOpen(false);
      setEditingStatus(null);
    } catch (error) {
      logger.error('ConfigStatus: Error submitting form:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext(editingStatus ? 'update' : 'create', 'status', 'omnia_status')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    logger.debug('ConfigStatus: Deleting status:', id)
    
    try {
      const success = await deleteStatus(id);
      if (success) {
        toast({
          title: "Status excluído!",
          description: "O status foi excluído com sucesso."
        });
      }
    } catch (error) {
      logger.error('ConfigStatus: Error deleting status:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'status', 'omnia_status')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleReorder = async (reorderedStatuses: Status[]) => {
    logger.debug('ConfigStatus: Reordering statuses:', reorderedStatuses)
    
    try {
      await reorderStatuses(reorderedStatuses);
      toast({
        title: "Status reordenados!",
        description: "A ordem dos status foi atualizada com sucesso."
      });
    } catch (error) {
      logger.error('ConfigStatus: Error reordering statuses:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'status', 'omnia_status')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleCloseForm = () => {
    logger.debug('ConfigStatus: Closing form')
    setIsFormOpen(false);
    setEditingStatus(null);
  };

  logger.debug(`ConfigStatus: Rendering with ${statuses.length} statuses, loading: ${loading}`)

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Configurações", href: "/config" },
            { label: "Status", isActive: true }
          ]} 
        />
        
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuração de Status</h1>
        </div>

        <StatusList
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
            <StatusForm
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
};

export default ConfigStatus;
