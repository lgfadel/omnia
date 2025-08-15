import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { StatusList } from "@/components/status/StatusList";
import { StatusForm } from "@/components/status/StatusForm";
import { useStatusStore } from "@/store/status.store";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Status } from "@/data/fixtures";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
const ConfigStatus = () => {
  const {
    toast
  } = useToast();
  const {
    statuses,
    loading,
    loadStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses
  } = useStatusStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);
  const handleCreate = () => {
    setEditingStatus(null);
    setIsFormOpen(true);
  };
  const handleEdit = (status: Status) => {
    setEditingStatus(status);
    setIsFormOpen(true);
  };
  const handleFormSubmit = async (data: {
    name: string;
    color: string;
  }) => {
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
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o status. Tente novamente.",
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
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir o status. Tente novamente.",
        variant: "destructive"
      });
    }
  };
  const handleReorder = async (reorderedStatuses: Status[]) => {
    try {
      await reorderStatuses(reorderedStatuses);
      toast({
        title: "Status reordenados!",
        description: "A ordem dos status foi atualizada com sucesso."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao reordenar os status. Tente novamente.",
        variant: "destructive"
      });
    }
  };
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingStatus(null);
  };
  return <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia items={[{
        label: "Configurações",
        href: "/config"
      }, {
        label: "Status",
        isActive: true
      }]} />
        
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuração de Status</h1>
          
        </div>

        <StatusList statuses={statuses} onEdit={handleEdit} onDelete={handleDelete} onCreate={handleCreate} onReorder={handleReorder} isLoading={loading} />

        <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingStatus ? "Editar Status" : "Novo Status"}
              </DialogTitle>
            </DialogHeader>
            <StatusForm status={editingStatus || undefined} onSubmit={handleFormSubmit} onCancel={handleCloseForm} isLoading={loading} />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>;
};
export default ConfigStatus;