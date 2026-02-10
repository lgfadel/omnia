"use client";

import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { CrmStatusList } from "@/components/crm-status/CrmStatusList";
import { CrmStatusForm } from "@/components/crm-status/CrmStatusForm";
import { useCrmStatusStore } from "@/stores/crmStatus.store";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Status } from "@/data/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";
import { logger } from '@/lib/logging';

const ConfigCrmStatus = () => {
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
  } = useCrmStatusStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);

  useEffect(() => {
    logger.debug('ConfigCrmStatus: Component mounted, loading statuses...')
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    if (error) {
      logger.error(`ConfigCrmStatus: Error detected: ${error}`)
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const handleCreate = () => {
    logger.debug('ConfigCrmStatus: Opening create form')
    setEditingStatus(null);
    setIsFormOpen(true);
  };

  const handleEdit = (status: Status) => {
    logger.debug(`ConfigCrmStatus: Opening edit form for status: ${status.id}`)
    setEditingStatus(status);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: { name: string; color: string }) => {
    logger.debug('ConfigCrmStatus: Submitting form')
    
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
      logger.error(`ConfigCrmStatus: Error submitting form: ${error}`)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext(editingStatus ? 'update' : 'create', 'status CRM', 'omnia_crm_statuses')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    logger.debug(`ConfigCrmStatus: Deleting status: ${id}`)
    
    try {
      const success = await deleteStatus(id);
      if (success) {
        toast({
          title: "Status excluído!",
          description: "O status foi excluído com sucesso."
        });
      }
    } catch (error) {
      logger.error(`ConfigCrmStatus: Error deleting status: ${error}`)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('delete', 'status CRM', 'omnia_crm_statuses')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleReorder = async (reorderedStatuses: Status[]) => {
    logger.debug('ConfigCrmStatus: Reordering statuses')
    
    try {
      await reorderStatuses(reorderedStatuses);
      toast({
        title: "Status reordenados!",
        description: "A ordem dos status foi atualizada com sucesso."
      });
    } catch (error) {
      logger.error(`ConfigCrmStatus: Error reordering statuses: ${error}`)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'status CRM', 'omnia_crm_statuses')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleCloseForm = () => {
    logger.debug('ConfigCrmStatus: Closing form')
    setIsFormOpen(false);
    setEditingStatus(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Configurações", href: "/config" },
            { label: "Status CRM", isActive: true }
          ]} 
        />
        
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuração de Status CRM</h1>
        </div>

        <CrmStatusList
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
            <CrmStatusForm
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

export default ConfigCrmStatus;
