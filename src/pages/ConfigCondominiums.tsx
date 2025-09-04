import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { CondominiumList } from "@/components/condominiums/CondominiumList";
import { CondominiumForm } from "@/components/condominiums/CondominiumForm";
import { useCondominiumStore } from "@/store/condominiums.store";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Condominium } from "@/repositories/condominiumsRepo.supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ConfigCondominiums = () => {
  const { toast } = useToast();
  const {
    condominiums,
    loading,
    error,
    loadCondominiums,
    createCondominium,
    updateCondominium,
    deleteCondominium,
    clearError
  } = useCondominiumStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCondominium, setEditingCondominium] = useState<Condominium | null>(null);

  useEffect(() => {
    console.log('ConfigCondominiums: Component mounted, loading condominiums...')
    loadCondominiums();
  }, [loadCondominiums]);

  useEffect(() => {
    if (error) {
      console.error('ConfigCondominiums: Error detected:', error)
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const handleCreate = () => {
    console.log('ConfigCondominiums: Opening create form')
    setEditingCondominium(null);
    setIsFormOpen(true);
  };

  const handleEdit = (condominium: Condominium) => {
    console.log('ConfigCondominiums: Opening edit form for condominium:', condominium)
    setEditingCondominium(condominium);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: {
    name: string;
    cnpj?: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
    syndic_id?: string;
    manager_id?: string;
  }) => {
    console.log('ConfigCondominiums: Submitting form:', data)
    
    try {
      if (editingCondominium) {
        await updateCondominium(editingCondominium.id, data);
        toast({
          title: "Condomínio atualizado!",
          description: `O condomínio "${data.name}" foi atualizado com sucesso.`
        });
      } else {
        await createCondominium(data);
        toast({
          title: "Condomínio criado!",
          description: `O condomínio "${data.name}" foi criado com sucesso.`
        });
      }
      setIsFormOpen(false);
      setEditingCondominium(null);
    } catch (error) {
      console.error('ConfigCondominiums: Error submitting form:', error)
      toast({
        title: "Erro",
        description: editingCondominium ? "Erro ao atualizar condomínio" : "Erro ao criar condomínio",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    console.log('ConfigCondominiums: Deleting condominium:', id)
    
    try {
      await deleteCondominium(id);
      toast({
        title: "Condomínio excluído!",
        description: "O condomínio foi excluído com sucesso."
      });
    } catch (error) {
      console.error('ConfigCondominiums: Error deleting condominium:', error)
      toast({
        title: "Erro",
        description: "Erro ao excluir condomínio",
        variant: "destructive"
      });
    }
  };

  const handleFormCancel = () => {
    console.log('ConfigCondominiums: Form cancelled')
    setIsFormOpen(false);
    setEditingCondominium(null);
  };

  const breadcrumbItems = [
    { label: "Configurações", href: "/config" },
    { label: "Condomínios", isActive: true }
  ];

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <BreadcrumbOmnia items={breadcrumbItems} />
        
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-foreground">
            Configuração de Condomínios
          </h1>
          
          <CondominiumList
            condominiums={condominiums}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
            isLoading={loading}
          />
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCondominium ? "Editar Condomínio" : "Novo Condomínio"}
            </DialogTitle>
          </DialogHeader>
          <CondominiumForm
            condominium={editingCondominium || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
            isLoading={loading}
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ConfigCondominiums;