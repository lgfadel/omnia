import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { CrmOrigemList } from "@/components/crm-origem/CrmOrigemList";
import { CrmOrigemForm } from "@/components/crm-origem/CrmOrigemForm";
import { useCrmOrigensStore } from "@/store/crmOrigens.store";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { CrmOrigem } from "@/repositories/crmOrigensRepo.supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ConfigCrmOrigens = () => {
  const { toast } = useToast();
  const {
    origens,
    loading,
    error,
    loadOrigens,
    createOrigem,
    updateOrigem,
    deleteOrigem,
    clearError
  } = useCrmOrigensStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrigem, setEditingOrigem] = useState<CrmOrigem | null>(null);

  useEffect(() => {
    console.log('ConfigCrmOrigens: Component mounted, loading origens...')
    loadOrigens();
  }, [loadOrigens]);

  useEffect(() => {
    if (error) {
      console.error('ConfigCrmOrigens: Error detected:', error)
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const handleCreate = () => {
    console.log('ConfigCrmOrigens: Opening form for new origem')
    setEditingOrigem(null);
    setIsFormOpen(true);
  };

  const handleEdit = (origem: CrmOrigem) => {
    console.log('ConfigCrmOrigens: Opening form for editing origem:', origem.id)
    setEditingOrigem(origem);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: { name: string; color: string }) => {
    console.log('ConfigCrmOrigens: Form submitted with data:', data)
    
    try {
      if (editingOrigem) {
        console.log('ConfigCrmOrigens: Updating origem:', editingOrigem.id)
        await updateOrigem(editingOrigem.id, data);
        toast({
          title: "Sucesso",
          description: "Origem atualizada com sucesso!"
        });
      } else {
        console.log('ConfigCrmOrigens: Creating new origem')
        await createOrigem({ ...data, isDefault: false });
        toast({
          title: "Sucesso", 
          description: "Origem criada com sucesso!"
        });
      }
      setIsFormOpen(false);
      setEditingOrigem(null);
    } catch (error) {
      console.error('ConfigCrmOrigens: Error in form submission:', error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    console.log('ConfigCrmOrigens: Deleting origem:', id)
    
    try {
      await deleteOrigem(id);
      toast({
        title: "Sucesso",
        description: "Origem excluída com sucesso!"
      });
    } catch (error) {
      console.error('ConfigCrmOrigens: Error deleting origem:', error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    }
  };

  const handleFormCancel = () => {
    console.log('ConfigCrmOrigens: Form cancelled')
    setIsFormOpen(false);
    setEditingOrigem(null);
  };

  const breadcrumbItems = [
    { label: "Configurações", href: "/config" },
    { label: "CRM", href: "/config/crm" },
    { label: "Origens do Lead", href: "/config/crm/origens" }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia items={breadcrumbItems} />
        
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Origens do Lead</h1>
              <p className="text-muted-foreground">
                Gerencie as origens dos leads do seu CRM
              </p>
            </div>
          </div>

          <CrmOrigemList
            origens={origens}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
            isLoading={loading}
          />
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingOrigem ? "Editar Origem" : "Nova Origem"}
              </DialogTitle>
            </DialogHeader>
            <CrmOrigemForm
              origem={editingOrigem}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              isLoading={loading}
            />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ConfigCrmOrigens;