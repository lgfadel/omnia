"use client";

import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TabelaOmnia } from "@/components/ui/tabela-omnia";
import { CondominiumForm } from "@/components/condominiums/CondominiumForm";
import { useCondominiumStore } from "@/stores/condominiums.store";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo } from "react";
import { Condominium } from "@/repositories/condominiumsRepo.supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";
import { logger } from '@/lib/logging';
import { formatAddress } from "@/lib/formatAddress";
import { Badge } from "@/components/ui/badge";

const columns = [
  { key: "name", label: "Nome", width: "w-[35%]" },
  { key: "cnpj", label: "CNPJ", width: "w-[20%]" },
  { key: "syndic_name", label: "Síndico", width: "w-[20%]" },
  { key: "phone", label: "Telefone", width: "w-[15%]" },
  { key: "active", label: "Status", width: "w-[10%]" },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'syndic_name' | 'phone' } | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    logger.debug('ConfigCondominiums: Component mounted, loading condominiums...')
    loadCondominiums();
  }, [loadCondominiums]);

  useEffect(() => {
    if (error) {
      logger.error(`ConfigCondominiums: Error detected: ${error}`)
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const handleCreate = () => {
    logger.debug('ConfigCondominiums: Opening create form')
    setEditingCondominium(null);
    setIsFormOpen(true);
  };

  const handleEdit = (condominium: Condominium) => {
    logger.debug(`ConfigCondominiums: Opening edit form for condominium: ${condominium.id}`)
    setEditingCondominium(condominium);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: {
    name: string;
    address?: string | null;
  }) => {
    logger.debug('ConfigCondominiums: Submitting form')
    
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
      logger.error(`ConfigCondominiums: Error submitting form: ${error}`)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext(
          editingCondominium ? 'update' : 'create',
          'condomínio',
          'omnia_condominiums'
        )
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = (id: string | number) => {
    const condominium = condominiums.find(c => c.id === id);
    if (condominium) {
      setItemToDelete({ id: String(id), name: condominium.name });
      setDeleteConfirmOpen(true);
    }
  };

  const handleCellClick = (id: string, field: 'syndic_name' | 'phone', currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue === '-' ? '' : currentValue);
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    const condominium = condominiums.find(c => c.id === editingCell.id);
    if (!condominium) {
      setEditingCell(null);
      return;
    }

    const currentValue = editingCell.field === 'syndic_name' ? condominium.syndic_name : condominium.phone;
    
    // Only update if value changed
    if (editValue !== currentValue && editValue !== (currentValue || '')) {
      try {
        await updateCondominium(editingCell.id, {
          [editingCell.field]: editValue || null
        });
        toast({
          title: "Sucesso",
          description: `${editingCell.field === 'syndic_name' ? 'Síndico' : 'Telefone'} atualizado com sucesso.`,
        });
      } catch (error) {
        logger.error('Error updating condominium field:', error);
      }
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const formatPhoneInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  };

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      logger.debug(`ConfigCondominiums: Deleting condominium: ${itemToDelete.id}`)
      
      try {
        await deleteCondominium(itemToDelete.id);
        toast({
          title: "Condomínio excluído!",
          description: "O condomínio foi excluído com sucesso."
        });
        setDeleteConfirmOpen(false);
        setItemToDelete(null);
      } catch (error) {
        logger.error(`ConfigCondominiums: Error deleting condominium: ${error}`)
        const treatedError = handleSupabaseError(
          error,
          createErrorContext('delete', 'condomínio', 'omnia_condominiums')
        );
        toast({
          title: "Erro",
          description: treatedError.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleFormCancel = () => {
    logger.debug('ConfigCondominiums: Form cancelled')
    setIsFormOpen(false);
    setEditingCondominium(null);
  };

  const handleView = (id: string | number) => {
    const condominium = condominiums.find(c => c.id === String(id));
    if (condominium) {
      handleEdit(condominium);
    }
  };

  const breadcrumbItems = [
    { label: "Configurações", href: "/config" },
    { label: "Condomínios", isActive: true }
  ];

  // Filter and format data for table
  const tableData = useMemo(() => {
    let filtered = condominiums.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.cnpj?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Apply status filter - show only active by default
    filtered = filtered.filter(c => {
      // Consider active only if explicitly true
      const isActive = c.active === true;
      const isInactive = c.active === false || c.active === null || c.active === undefined;
      
      if (showOnlyActive) {
        return isActive;
      } else {
        return isInactive;
      }
    });

    return filtered.map(c => {
      const isEditingSyndic = editingCell?.id === c.id && editingCell?.field === 'syndic_name';
      const isEditingPhone = editingCell?.id === c.id && editingCell?.field === 'phone';
      
      return {
        id: c.id,
        name: c.name,
        cnpj: c.cnpj ? c.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "-",
        syndic_name: isEditingSyndic ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleCellKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full px-2 py-1 border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Nome do síndico"
          />
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleCellClick(c.id, 'syndic_name', c.syndic_name || '-');
            }}
            className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            title="Clique para editar"
          >
            {c.syndic_name || "-"}
          </div>
        ),
        phone: isEditingPhone ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(formatPhoneInput(e.target.value))}
            onBlur={handleCellBlur}
            onKeyDown={handleCellKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full px-2 py-1 border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="(00) 00000-0000"
            maxLength={15}
          />
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleCellClick(c.id, 'phone', c.phone ? c.phone.replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3") : '-');
            }}
            className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            title="Clique para editar"
          >
            {c.phone ? c.phone.replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3") : "-"}
          </div>
        ),
        active: c.active,
      };
    });
  }, [condominiums, searchQuery, showOnlyActive, editingCell, editValue]);

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia items={breadcrumbItems} />
        
        {/* Header: título + botão criar */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Condomínios</h1>
          <Button 
            onClick={handleCreate}
            className="bg-primary hover:bg-primary/90 w-12 h-12 p-0 rounded-lg"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlyActive(!showOnlyActive)}
              className={`rounded-full w-10 h-10 p-0 flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                showOnlyActive 
                  ? 'bg-green-500 border-green-500 text-white hover:bg-green-600 shadow-lg ring-2 ring-green-200 ring-offset-1' 
                  : 'bg-gray-200 border-gray-300 text-gray-600 hover:bg-gray-300 shadow-sm'
              }`}
              title={showOnlyActive ? "Mostrando apenas ativos" : "Mostrando apenas inativos"}
            >
              {showOnlyActive ? "A" : "I"}
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando...
            </div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>
                {searchQuery 
                  ? `Nenhum condomínio encontrado para "${searchQuery}".`
                  : `Nenhum condomínio ${showOnlyActive ? 'ativo' : 'inativo'} encontrado.`
                }
              </p>
            </div>
          ) : (
            <TabelaOmnia
              columns={columns}
              data={tableData}
              onView={handleView}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Dialog de formulário */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl">
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

      {/* AlertDialog de confirmação de exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o condomínio "{itemToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default ConfigCondominiums;
