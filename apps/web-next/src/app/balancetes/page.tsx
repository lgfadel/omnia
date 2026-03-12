"use client";

import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TabelaOmnia } from "@/components/ui/tabela-omnia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBalancetesStore } from "@/stores/balancetes.store";
import { useCondominiumStore } from "@/stores/condominiums.store";
import { useAuthStore } from "@/stores/auth.store";
import { BalanceteForm } from "@/components/balancetes/BalanceteForm";
import { CondominiumSelect } from "@/components/condominiums/CondominiumSelect";
import type { Balancete } from "@/repositories/balancetesRepo.supabase";
import { useToast } from "@/hooks/use-toast";

const columns = [
  { key: "condominium_name", label: "Condomínio", width: "w-[28%]" },
  { key: "competencia", label: "Competência", width: "w-[14%]", sortable: true },
  { key: "received_at", label: "Dt Recebimento", width: "w-[14%]", sortable: true },
  { key: "volumes", label: "Volumes", width: "w-[10%]" },
  { key: "observations", label: "Observações", width: "w-[24%]" },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export default function BalancetesPage() {
  const { toast } = useToast();
  const {
    balancetes,
    loading,
    loadBalancetes,
    createBalancete,
    updateBalancete,
    deleteBalancete,
  } = useBalancetesStore();
  const { condominiums, loadCondominiums } = useCondominiumStore();
  const { userProfile } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [condominiumFilter, setCondominiumFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingBalancete, setEditingBalancete] = useState<Balancete | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [balanceteToDelete, setBalanceteToDelete] = useState<Balancete | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadBalancetes();
    loadCondominiums();
  }, [loadBalancetes, loadCondominiums]);

  const filteredData = useMemo(() => {
    let data = balancetes;

    if (condominiumFilter) {
      data = data.filter((b) => b.condominium_id === condominiumFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      data = data.filter(
        (b) =>
          (b.condominium_name || "").toLowerCase().includes(query) ||
          b.competencia.includes(query) ||
          (b.observations || "").toLowerCase().includes(query)
      );
    }

    return data;
  }, [balancetes, condominiumFilter, searchQuery]);

  const tableData = useMemo(
    () =>
      filteredData.map((b) => {
        const { status: _status, ...rest } = b;
        return {
          ...rest,
          received_at: formatDate(b.received_at),
          _raw_received_at: b.received_at,
        };
      }),
    [filteredData]
  );

  const handleNew = () => {
    setEditingBalancete(null);
    setFormOpen(true);
  };

  const handleView = (id: string | number) => {
    const balancete = balancetes.find((b) => b.id === String(id));
    if (balancete) {
      setEditingBalancete(balancete);
      setFormOpen(true);
    }
  };

  const handleDelete = (id: string | number) => {
    const balancete = balancetes.find((b) => b.id === String(id));
    if (balancete) {
      setBalanceteToDelete(balancete);
      setDeleteConfirmOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (balanceteToDelete) {
      try {
        await deleteBalancete(balanceteToDelete.id);
        toast({ title: "Balancete excluído com sucesso!" });
      } catch {
        toast({ title: "Erro ao excluir balancete.", variant: "destructive" });
      }
      setDeleteConfirmOpen(false);
      setBalanceteToDelete(null);
    }
  };

  const handleFormSubmit = async (data: {
    condominium_id: string;
    received_at: string;
    competencia: string;
    volumes: number;
    observations?: string;
  }) => {
    setFormLoading(true);
    
    console.log('[DEBUG] User from auth store:', userProfile);
    console.log('[DEBUG] User ID:', userProfile?.id);
    
    try {
      if (editingBalancete) {
        await updateBalancete(editingBalancete.id, {
          condominium_id: data.condominium_id,
          received_at: data.received_at,
          competencia: data.competencia,
          volumes: data.volumes,
          observations: data.observations || null,
        });
        toast({ title: "Balancete atualizado com sucesso!" });
      } else {
        await createBalancete({
          condominium_id: data.condominium_id,
          received_at: data.received_at,
          competencia: data.competencia,
          volumes: data.volumes,
          observations: data.observations || null,
          created_by: userProfile?.id!,
        });
        toast({ title: "Balancete cadastrado com sucesso!" });
      }
      setFormOpen(false);
      setEditingBalancete(null);
    } catch {
      toast({ title: "Erro ao salvar balancete.", variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia items={[{ label: "Balancetes", isActive: true }]} />

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Balancetes</h1>
          <Button
            className="bg-primary hover:bg-primary/90 w-12 h-12 p-0 rounded-lg"
            onClick={handleNew}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por condomínio, competência ou observações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <div className="w-full lg:w-[300px]">
              <CondominiumSelect
                condominiums={condominiums}
                value={condominiumFilter}
                onValueChange={(val) =>
                  setCondominiumFilter(val === condominiumFilter ? "" : val)
                }
                placeholder="Filtrar por condomínio..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando...
            </div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum balancete encontrado.
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

      <BalanceteForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingBalancete(null);
        }}
        balancete={editingBalancete}
        condominiums={condominiums}
        onSubmit={handleFormSubmit}
        isLoading={formLoading}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o balancete de{" "}
              <strong>{balanceteToDelete?.condominium_name}</strong> referente à
              competência <strong>{balanceteToDelete?.competencia}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
