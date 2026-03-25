"use client";

import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TabelaOmnia } from "@/components/ui/tabela-omnia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Send, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProtocoloAttachmentUpload } from "@/components/balancetes/ProtocoloAttachmentUpload";
import { BalancetesDashboard } from "@/components/balancetes/BalancetesDashboard";
import { ProtocolosTab } from "@/components/balancetes/ProtocolosTab";
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
import { useProtocolosStore } from "@/stores/protocolos.store";
import { protocolosRepoSupabase } from "@/repositories/protocolosRepo.supabase";
import { protocoloAttachmentsRepoSupabase } from "@/repositories/protocoloAttachmentsRepo.supabase";
import { BalanceteForm } from "@/components/balancetes/BalanceteForm";
import type { Balancete } from "@/repositories/balancetesRepo.supabase";
import { useToast } from "@/hooks/use-toast";

const columns = [
  { key: "condominium_name", label: "Condomínio", width: "w-[25%]", sortable: true },
  { key: "competencia", label: "Competência", width: "w-[12%]", sortable: true },
  { key: "received_at", label: "Dt Recebimento", width: "w-[12%]", sortable: true },
  { key: "volumes", label: "Volumes", width: "w-[8%]" },
  { key: "observations", label: "Observações", width: "w-[20%]" },
  { key: "sent_status", label: "Dt Envio", width: "w-[12%]", sortable: true },
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
  const { protocolos, loadProtocolos } = useProtocolosStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingBalancete, setEditingBalancete] = useState<Balancete | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [balanceteToDelete, setBalanceteToDelete] = useState<Balancete | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedBalancetes, setSelectedBalancetes] = useState<Set<string>>(new Set());
  const [sendingBalancetes, setSendingBalancetes] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [dataEnvio, setDataEnvio] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedBalanceteForUpload, setSelectedBalanceteForUpload] = useState<Balancete | null>(null);
  const [protocoloNumero, setProtocoloNumero] = useState<number>(0);
  const [statusEnvioFilter, setStatusEnvioFilter] = useState<'todos' | 'enviados' | 'pendentes'>('todos');
  const [anexoFilter, setAnexoFilter] = useState<'todos' | 'com-anexo' | 'sem-anexo'>('todos');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadBalancetes();
    loadCondominiums();
    loadProtocolos();
  }, [loadBalancetes, loadCondominiums, loadProtocolos]);

  useEffect(() => {
    const loadAttachmentCounts = async () => {
      const counts: Record<string, number> = {};
      for (const protocolo of protocolos) {
        try {
          const attachments = await protocoloAttachmentsRepoSupabase.listByProtocolo(protocolo.id);
          counts[protocolo.id] = attachments.length;
        } catch {
          counts[protocolo.id] = 0;
        }
      }
      setAttachmentCounts(counts);
    };

    if (protocolos.length > 0) {
      loadAttachmentCounts();
    }
  }, [protocolos]);

  const protocolosMap = useMemo(() => {
    const map = new Map();
    protocolos.forEach(p => map.set(p.id, p));
    return map;
  }, [protocolos]);

  const filteredData = useMemo(() => {
    let data = balancetes;

    // Filtro de status de envio
    if (statusEnvioFilter === 'enviados') {
      data = data.filter((b) => b.sent_at);
    } else if (statusEnvioFilter === 'pendentes') {
      data = data.filter((b) => !b.sent_at);
    }

    // Filtro de anexos
    if (anexoFilter === 'com-anexo') {
      data = data.filter((b) => b.protocolo_id && attachmentCounts[b.protocolo_id] > 0);
    } else if (anexoFilter === 'sem-anexo') {
      data = data.filter((b) => !b.protocolo_id || !attachmentCounts[b.protocolo_id] || attachmentCounts[b.protocolo_id] === 0);
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
  }, [balancetes, searchQuery, statusEnvioFilter, anexoFilter, attachmentCounts]);

  const tableData = useMemo(
    () =>
      filteredData.map((b) => {
        const { status: _status, ...rest } = b;
        const protocolo = b.protocolo_id ? protocolosMap.get(b.protocolo_id) : null;
        const dataEnvio = protocolo?.data_envio ?? null;
        const attachmentCount = b.protocolo_id ? (attachmentCounts[b.protocolo_id] || 0) : 0;
        
        return {
          ...rest,
          received_at: formatDate(b.received_at),
          _raw_received_at: b.received_at,
          _raw_sent_at: dataEnvio,
          _attachmentCount: attachmentCount,
          sent_status: dataEnvio ? (
            <span className="text-sm text-green-700 font-medium">
              {formatDate(dataEnvio)}
            </span>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
              Pendente
            </Badge>
          ),
        };
      }),
    [filteredData, protocolosMap, attachmentCounts]
  );

  const sortedData = useMemo(() => {
    if (!sortField) return tableData;

    return [...tableData].sort((a, b) => {
      const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'condominium_name') {
        return (a.condominium_name || '').localeCompare(b.condominium_name || '') * directionMultiplier;
      }

      if (sortField === 'competencia') {
        return a.competencia.localeCompare(b.competencia) * directionMultiplier;
      }

      if (sortField === 'received_at') {
        const aDate = new Date(a._raw_received_at);
        const bDate = new Date(b._raw_received_at);
        return (aDate.getTime() - bDate.getTime()) * directionMultiplier;
      }

      if (sortField === 'sent_status') {
        const aDate = a._raw_sent_at ? new Date(a._raw_sent_at) : null;
        const bDate = b._raw_sent_at ? new Date(b._raw_sent_at) : null;
        
        if (aDate && bDate) {
          return (aDate.getTime() - bDate.getTime()) * directionMultiplier;
        }
        if (aDate && !bDate) return -1;
        if (!aDate && bDate) return 1;
        return 0;
      }

      return 0;
    });
  }, [tableData, sortField, sortDirection]);

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
      const result = await markAsSent(ids, dataEnvio, userProfile?.id);
      
      // Gerar PDF do protocolo com a data selecionada
      const pdfBytes = await generateProtocoloPDF({
        numeroProtocolo: result.protocolo.numero,
        balancetes: result.balancetes,
        dataEnvio: result.protocolo.data_envio,
      });
      
      // Download do PDF
      const protocoloNumero = String(result.protocolo.numero).padStart(3, '0');
      const filename = `protocolo-${protocoloNumero}-${result.protocolo.data_envio}.pdf`;
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAttachmentClick = async (id: string | number) => {
    const balancete = balancetes.find((b) => b.id === String(id));

    if (!balancete?.sent_at || !balancete?.protocolo_id) {
      toast({
        title: "Balancete não enviado",
        description: "Apenas balancetes já enviados podem ter protocolo anexado.",
        variant: "destructive",
      });
      return;
    }

    // Buscar número do protocolo
    try {
      const protocolo = await protocolosRepoSupabase.getById(balancete.protocolo_id);
      if (protocolo) {
        setProtocoloNumero(protocolo.numero);
        setSelectedBalanceteForUpload(balancete);
        setUploadModalOpen(true);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar informações do protocolo.",
        variant: "destructive",
      });
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
      <div className="space-y-4">
        <BreadcrumbOmnia items={[{ label: "Balancetes", isActive: true }]} />

        <h1 className="text-3xl font-bold text-foreground">Balancetes</h1>

        <Tabs defaultValue="dashboard" className="w-full">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="lista">Lista</TabsTrigger>
              <TabsTrigger value="protocolos">Protocolos</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 px-4 gap-2"
                onClick={handleEnviarClick}
                disabled={selectedBalancetes.size === 0 || sendingBalancetes}
              >
                <Send className="w-4 h-4" />
                {sendingBalancetes ? "Enviando..." : `Enviar${selectedBalancetes.size > 0 ? ` (${selectedBalancetes.size})` : ""}`}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 w-10 h-10 p-0 rounded-lg"
                onClick={handleNew}
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Dashboard tab */}
          <TabsContent value="dashboard" className="mt-4">
            <BalancetesDashboard balancetes={balancetes} condominiums={condominiums} />
          </TabsContent>

          {/* Lista tab */}
          <TabsContent value="lista" className="mt-4 space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar balancetes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-500"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-3 flex items-center gap-2 transition-all duration-200 bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    >
                      <Filter className="w-4 h-4" />
                      <span className="text-xs font-medium">Filtros</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-52">
                    <DropdownMenuLabel>Status de envio</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={statusEnvioFilter} onValueChange={(value) => setStatusEnvioFilter(value as 'todos' | 'enviados' | 'pendentes')}>
                      <DropdownMenuRadioItem value="todos">Todos</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="enviados">Enviados</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="pendentes">Pendentes</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Anexos</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={anexoFilter} onValueChange={(value) => setAnexoFilter(value as 'todos' | 'com-anexo' | 'sem-anexo')}>
                      <DropdownMenuRadioItem value="todos">Todos</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="com-anexo">Com Anexo</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="sem-anexo">Sem Anexo</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                  data={sortedData}
                  onView={handleView}
                  onAttachmentClick={handleAttachmentClick}
                  onDelete={(id) => {
                    const balancete = balancetes.find((b) => b.id === String(id));
                    if (balancete?.protocolo_id) {
                      toast({
                        title: "Não é possível excluir",
                        description: "Balancetes enviados com protocolo não podem ser excluídos.",
                        variant: "destructive",
                      });
                      return;
                    }
                    handleDelete(id);
                  }}
                  selectable
                  selectedIds={selectedBalancetes}
                  onSelectionChange={setSelectedBalancetes}
                  disabledIds={disabledIds}
                  sortField={sortField ?? undefined}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              )}
            </div>
          </TabsContent>

          {/* Protocolos tab */}
          <TabsContent value="protocolos" className="mt-4">
            <ProtocolosTab />
          </TabsContent>
        </Tabs>
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

      {selectedBalanceteForUpload && (
        <ProtocoloAttachmentUpload
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          protocoloId={selectedBalanceteForUpload?.protocolo_id || ''}
          protocoloNumero={protocoloNumero}
          onUploadSuccess={async () => {
            if (selectedBalanceteForUpload?.protocolo_id) {
              const attachments = await protocoloAttachmentsRepoSupabase.listByProtocolo(selectedBalanceteForUpload.protocolo_id);
              setAttachmentCounts(prev => ({
                ...prev,
                [selectedBalanceteForUpload.protocolo_id!]: attachments.length
              }));
            }
            toast({
              title: "Protocolo anexado",
              description: "O protocolo assinado foi anexado com sucesso.",
            });
            setSelectedBalanceteForUpload(null);
          }}
        />
      )}
    </Layout>
  );
}
