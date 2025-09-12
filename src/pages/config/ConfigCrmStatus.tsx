import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { CrmStatusList } from "@/components/crm-status/CrmStatusList";
import { CrmStatusForm } from "@/components/crm-status/CrmStatusForm";
import { useCrmStatusStore } from "@/store/crmStatus.store";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Status } from "@/data/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";

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
    console.log('ConfigCrmStatus: Component mounted, loading statuses...')
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    if (error) {
      console.error('ConfigCrmStatus: Error detected:', error)
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const handleCreate = () => {
    console.log('ConfigCrmStatus: Opening create form')
    setEditingStatus(null);
    setIsFormOpen(true);
  };

  const handleEdit = (status: Status) => {
    console.log('ConfigCrmStatus: Opening edit form for status:', status)
    setEditingStatus(status);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: { name: string; color: string }) => {
    console.log('ConfigCrmStatus: Submitting form:', data)
    
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
      console.error('ConfigCrmStatus: Error submitting form:', error)
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
    console.log('ConfigCrmStatus: Deleting status:', id)
    
    try {
      const success = await deleteStatus(id);
      if (success) {
        toast({
          title: "Status excluído!",
          description: "O status foi excluído com sucesso."
        });
      }
    } catch (error) {
      console.error('ConfigCrmStatus: Error deleting status:', error)
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
    console.log('ConfigCrmStatus: Reordering statuses:', reorderedStatuses)
    
    try {
      await reorderStatuses(reorderedStatuses);
      toast({
        title: "Status reordenados!",
        description: "A ordem dos status foi atualizada com sucesso."
      });
    } catch (error) {
      console.error('ConfigCrmStatus: Error reordering statuses:', error)
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
    console.log('ConfigCrmStatus: Closing form')
    setIsFormOpen(false);
    setEditingStatus(null);
  };

  console.log('ConfigCrmStatus: Rendering with statuses:', statuses, 'loading:', loading)

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