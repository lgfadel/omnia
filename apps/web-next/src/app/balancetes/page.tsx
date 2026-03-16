"use client";

import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TabelaOmnia } from "@/components/ui/tabela-omnia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Send, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProtocolosModal } from "@/components/balancetes/ProtocolosModal";
import { generateProtocoloPDF, downloadPDF } from "@/lib/generateProtocoloPDF";
import { Label } from "@/components/ui/label";
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
  { key: "condominium_name", label: "Condomínio", width: "w-[25%]" },
  { key: "competencia", label: "Competência", width: "w-[12%]", sortable: true },
  { key: "received_at", label: "Dt Recebimento", width: "w-[12%]", sortable: true },
  { key: "volumes", label: "Volumes", width: "w-[8%]" },
  { key: "sent_status", label: "Enviado", width: "w-[10%]" },
  { key: "observations", label: "Observações", width: "w-[23%]" },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  // Extrair apenas a parte da data (YYYY-MM-DD) se vier com timestamp
  const datePart = dateStr.split("T")[0];
  const [year, month, day] = datePart.split("-");
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
    markAsSent,
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
  const [selectedBalancetes, setSelectedBalancetes] = useState<Set<string>>(new Set());
  const [sendingBalancetes, setSendingBalancetes] = useState(false);
  const [protocolosModalOpen, setProtocolosModalOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [dataEnvio, setDataEnvio] = useState("");

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
          sent_status: b.sent_at ? (
            <span className="text-sm text-green-700 font-medium">
              {formatDate(b.sent_at)}
            </span>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
              Pendente
            </Badge>
          ),
        };
      }),
    [filteredData]
  );

  // IDs dos balancetes já enviados (não podem ser selecionados)
  const disabledIds = useMemo(() => {
    return new Set(
      balancetes
        .filter((b) => b.sent_at)
        .map((b) => b.id)
    );
  }, [balancetes]);

  const handleNew = () => {
    setEditingBalancete(null);
    setFormOpen(true);
  };

  const handleEnviarClick = () => {
    if (selectedBalancetes.size === 0) return;
    
    // Definir data padrão como hoje
    const hoje = new Date().toISOString().split('T')[0];
    setDataEnvio(hoje);
    setSendDialogOpen(true);
  };

  const handleConfirmEnviar = async () => {
    if (!dataEnvio) {
      toast({
        title: "Data obrigatória",
        description: "Por favor, informe a data de envio.",
        variant: "destructive",
      });
      return;
    }

    setSendingBalancetes(true);
    setSendDialogOpen(false);
    
    try {
      const ids = Array.from(selectedBalancetes);
      const result = await markAsSent(ids, userProfile?.id);
      
      // Gerar PDF do protocolo com a data selecionada
      const pdfBytes = await generateProtocoloPDF({
        numeroProtocolo: result.protocolo.numero,
        balancetes: result.balancetes,
        dataEnvio: dataEnvio,
      });
      
      // Download do PDF
      const protocoloNumero = String(result.protocolo.numero).padStart(3, '0');
      const filename = `protocolo-${protocoloNumero}-${dataEnvio}.pdf`;
      downloadPDF(pdfBytes, filename);
      
      // Limpar seleção
      setSelectedBalancetes(new Set());
      
      toast({
        title: "Balancetes enviados com sucesso!",
        description: `Protocolo #${protocoloNumero} criado com ${result.balancetes.length} balancete(s). O PDF foi baixado.`,
      });
    } catch (error) {
      console.error('Erro ao enviar balancetes:', error);
      toast({
        title: "Erro ao enviar balancetes",
        description: "Ocorreu um erro ao marcar os balancetes como enviados.",
        variant: "destructive",
      });
    } finally {
      setSendingBalancetes(false);
    }
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-12 px-4 gap-2"
              onClick={() => setProtocolosModalOpen(true)}
            >
              <FileText className="w-4 h-4" />
              Protocolos
            </Button>
            <Button
              variant="outline"
              className="h-12 px-4 gap-2"
              onClick={handleEnviarClick}
              disabled={selectedBalancetes.size === 0 || sendingBalancetes}
            >
              <Send className="w-4 h-4" />
              {sendingBalancetes ? "Enviando..." : `Enviar${selectedBalancetes.size > 0 ? ` (${selectedBalancetes.size})` : ""}`}
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 w-12 h-12 p-0 rounded-lg"
              onClick={handleNew}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
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
              selectable
              selectedIds={selectedBalancetes}
              onSelectionChange={setSelectedBalancetes}
              disabledIds={disabledIds}
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

      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Data de Envio</AlertDialogTitle>
            <AlertDialogDescription>
              Informe a data de envio dos balancetes selecionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Label htmlFor="dataEnvio" className="text-sm font-medium">
              Data de Envio
            </Label>
            <Input
              id="dataEnvio"
              type="date"
              value={dataEnvio}
              onChange={(e) => setDataEnvio(e.target.value)}
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEnviar}>
              Confirmar Envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProtocolosModal
        open={protocolosModalOpen}
        onOpenChange={setProtocolosModalOpen}
      />
    </Layout>
  );
}
