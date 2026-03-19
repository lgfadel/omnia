"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TabelaOmnia } from "@/components/ui/tabela-omnia";
import type { TabelaOmniaCustomAction, TabelaOmniaRow } from "@/components/ui/tabela-omnia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Printer,
  Ban,
  FileText,
  Calendar,
  Building2,
  Loader2,
  ArrowLeft,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProtocolosStore } from "@/stores/protocolos.store";
import { useBalancetesStore } from "@/stores/balancetes.store";
import { useAuthStore } from "@/stores/auth.store";
import type { Protocolo } from "@/repositories/protocolosRepo.supabase";
import type { Balancete } from "@/repositories/balancetesRepo.supabase";
import { useToast } from "@/hooks/use-toast";
import { generateProtocoloPDF, downloadPDF } from "@/lib/generateProtocoloPDF";
import { useRouter } from "next/navigation";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const datePart = dateStr.split("T")[0];
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const columns = [
  { key: "numero_display", label: "Nº Protocolo", width: "w-[12%]", sortable: true },
  { key: "status_display", label: "Status", width: "w-[10%]" },
  { key: "data_envio_display", label: "Data Envio", width: "w-[14%]", sortable: true },
  { key: "quantidade_display", label: "Balancetes", width: "w-[10%]", sortable: true },
  { key: "motivo_display", label: "Motivo Cancelamento", width: "w-[38%]" },
];

export default function ProtocolosPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { userProfile } = useAuthStore();
  const {
    protocolos,
    loading,
    loadProtocolos,
    cancelarProtocolo,
    getBalancetesDoProtocolo,
  } = useProtocolosStore();
  const { loadBalancetes } = useBalancetesStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const [expandedProtocoloId, setExpandedProtocoloId] = useState<string | number | null>(null);
  const [balancetesMap, setBalancetesMap] = useState<Record<string, Balancete[]>>({});
  const [protocoloCondominiosMap, setProtocoloCondominiosMap] = useState<Record<string, string[]>>({});
  const [loadingBalancetes, setLoadingBalancetes] = useState<string | null>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [protocoloToCancel, setProtocoloToCancel] = useState<Protocolo | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [canceling, setCanceling] = useState(false);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    loadProtocolos();
  }, [loadProtocolos]);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const missingProtocolos = protocolos
      .map((p) => String(p.id))
      .filter((id) => protocoloCondominiosMap[id] === undefined);

    if (missingProtocolos.length === 0) return;

    let isCancelled = false;

    const loadCondominiosIndex = async () => {
      const entries = await Promise.all(
        missingProtocolos.map(async (protocoloId) => {
          try {
            const balancetes = await getBalancetesDoProtocolo(protocoloId);
            const condominiumNames = balancetes
              .map((b) => b.condominium_name?.toLowerCase())
              .filter((name): name is string => Boolean(name));

            return {
              protocoloId,
              condominiumNames,
              balancetes,
            };
          } catch {
            return {
              protocoloId,
              condominiumNames: [],
              balancetes: [] as Balancete[],
            };
          }
        })
      );

      if (isCancelled) return;

      setProtocoloCondominiosMap((prev) => {
        const next = { ...prev };
        entries.forEach(({ protocoloId, condominiumNames }) => {
          next[protocoloId] = condominiumNames;
        });
        return next;
      });

      setBalancetesMap((prev) => {
        const next = { ...prev };
        entries.forEach(({ protocoloId, balancetes }) => {
          if (!next[protocoloId] && balancetes.length > 0) {
            next[protocoloId] = balancetes;
          }
        });
        return next;
      });
    };

    loadCondominiosIndex();

    return () => {
      isCancelled = true;
    };
  }, [searchQuery, protocolos, protocoloCondominiosMap, getBalancetesDoProtocolo]);

  // Stats
  const stats = useMemo(() => {
    const enviados = protocolos.filter((p) => !p.cancelado).length;
    const cancelados = protocolos.filter((p) => p.cancelado).length;
    const totalBalancetes = protocolos
      .filter((p) => !p.cancelado)
      .reduce((sum, p) => sum + p.quantidade_balancetes, 0);
    return { enviados, cancelados, totalBalancetes, total: protocolos.length };
  }, [protocolos]);

  // Filtered data
  const filteredData = useMemo(() => {
    let data = protocolos;

    if (showOnlyActive) {
      data = data.filter((p) => !p.cancelado);
    } else {
      data = data.filter((p) => p.cancelado);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      data = data.filter((p) => {
        const numero = String(p.numero).padStart(3, "0");
        const protocoloCondominios = protocoloCondominiosMap[String(p.id)] || [];
        return (
          numero.includes(query) ||
          p.data_envio.includes(query) ||
          formatDate(p.data_envio).includes(query) ||
          (p.motivo_cancelamento || "").toLowerCase().includes(query) ||
          protocoloCondominios.some((condominiumName) => condominiumName.includes(query))
        );
      });
    }

    return data;
  }, [protocolos, showOnlyActive, searchQuery, protocoloCondominiosMap]);

  // Table data
  const tableData = useMemo(
    () =>
      filteredData.map((p) => {
        const protocoloNumero = String(p.numero).padStart(3, "0");

        return {
          id: p.id,
          _raw: p,
          _raw_numero: p.numero,
          _raw_data_envio: p.data_envio,
          _raw_quantidade: p.quantidade_balancetes,
          numero_display: (
            <span className={`font-mono font-semibold text-sm ${p.cancelado ? "line-through text-muted-foreground" : ""}`}>
              #{protocoloNumero}
            </span>
          ),
          status_display: p.cancelado ? (
            <Badge variant="destructive" className="text-[10px] px-2 py-0">
              Cancelado
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] px-2 py-0 border-green-200">
              Enviado
            </Badge>
          ),
          data_envio_display: (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={`text-sm ${p.cancelado ? "text-muted-foreground" : "font-medium"}`}>
                {formatDate(p.data_envio)}
              </span>
            </div>
          ),
          quantidade_display: (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{p.quantidade_balancetes}</span>
            </div>
          ),
          motivo_display: p.cancelado && p.motivo_cancelamento ? (
            <span className="text-xs text-red-600 truncate block max-w-[250px]" title={p.motivo_cancelamento}>
              {p.motivo_cancelamento}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          ),
        };
      }),
    [filteredData]
  );

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortField) return tableData;

    return [...tableData].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      if (sortField === "numero_display") {
        return (a._raw_numero - b._raw_numero) * dir;
      }
      if (sortField === "data_envio_display") {
        return a._raw_data_envio.localeCompare(b._raw_data_envio) * dir;
      }
      if (sortField === "quantidade_display") {
        return (a._raw_quantidade - b._raw_quantidade) * dir;
      }
      return 0;
    });
  }, [tableData, sortField, sortDirection]);

  // Handlers
  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleRowExpand = useCallback(async (id: string | number) => {
    const protocoloId = String(id);

    if (String(expandedProtocoloId) === protocoloId) {
      setExpandedProtocoloId(null);
      return;
    }

    setExpandedProtocoloId(id);

    if (!balancetesMap[protocoloId]) {
      setLoadingBalancetes(protocoloId);
      try {
        const balancetes = await getBalancetesDoProtocolo(protocoloId);
        setBalancetesMap((prev) => ({ ...prev, [protocoloId]: balancetes }));
      } catch {
        toast({
          title: "Erro ao carregar balancetes",
          variant: "destructive",
        });
      } finally {
        setLoadingBalancetes(null);
      }
    }
  }, [expandedProtocoloId, balancetesMap, getBalancetesDoProtocolo, toast]);

  const handleReimprimir = async (protocolo: Protocolo) => {
    try {
      const balancetes = await getBalancetesDoProtocolo(protocolo.id);

      if (balancetes.length === 0) {
        toast({
          title: "Erro ao reimprimir",
          description: "Nenhum balancete encontrado para este protocolo.",
          variant: "destructive",
        });
        return;
      }

      const pdfBytes = await generateProtocoloPDF({
        numeroProtocolo: protocolo.numero,
        balancetes: balancetes,
        dataEnvio: protocolo.data_envio,
      });

      const protocoloNumero = String(protocolo.numero).padStart(3, "0");
      const filename = `protocolo-${protocoloNumero}-${protocolo.data_envio}.pdf`;
      downloadPDF(pdfBytes, filename);

      toast({
        title: "Protocolo reimpresso",
        description: `Protocolo #${protocoloNumero} foi baixado novamente.`,
      });
    } catch {
      toast({
        title: "Erro ao reimprimir protocolo",
        variant: "destructive",
      });
    }
  };

  const handleCancelClick = (protocolo: Protocolo) => {
    setProtocoloToCancel(protocolo);
    setMotivoCancelamento("");
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!protocoloToCancel) return;

    setCanceling(true);
    try {
      await cancelarProtocolo(
        protocoloToCancel.id,
        userProfile?.id,
        motivoCancelamento || undefined
      );

      await loadBalancetes();

      setBalancetesMap((prev) => {
        const newMap = { ...prev };
        delete newMap[protocoloToCancel.id];
        return newMap;
      });

      toast({
        title: "Protocolo cancelado",
        description: `Protocolo #${String(protocoloToCancel.numero).padStart(3, "0")} foi cancelado com sucesso.`,
      });

      setCancelDialogOpen(false);
      setProtocoloToCancel(null);
    } catch {
      toast({
        title: "Erro ao cancelar protocolo",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  // Custom actions: reimprimir e cancelar
  const customActions: TabelaOmniaCustomAction[] = useMemo(() => [
    {
      icon: <Printer className="w-4 h-4" />,
      label: "Reimprimir protocolo",
      className: "hover:text-blue-600 hover:bg-blue-50",
      onClick: (_id: string | number, row: TabelaOmniaRow) => {
        const protocolo = row._raw as Protocolo;
        handleReimprimir(protocolo);
      },
    },
    {
      icon: <Ban className="w-4 h-4" />,
      label: "Cancelar protocolo",
      className: "hover:text-red-600 hover:bg-red-50",
      onClick: (_id: string | number, row: TabelaOmniaRow) => {
        const protocolo = row._raw as Protocolo;
        handleCancelClick(protocolo);
      },
      hidden: (row: TabelaOmniaRow) => {
        const protocolo = row._raw as Protocolo;
        return protocolo.cancelado;
      },
    },
  ], []);

  // Render expanded row content
  const renderExpandedRow = useCallback((row: TabelaOmniaRow) => {
    const protocolo = row._raw as Protocolo;
    const protocoloId = String(protocolo.id);
    const isLoading = loadingBalancetes === protocoloId;
    const balancetes = balancetesMap[protocoloId];

    return (
      <div className="bg-muted/10 border-t">
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando balancetes...
            </div>
          ) : !balancetes || balancetes.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhum balancete encontrado neste protocolo.
            </div>
          ) : (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Balancetes incluídos neste protocolo
              </div>
              <div className="rounded-md border overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs h-9">Condomínio</TableHead>
                      <TableHead className="text-xs h-9">Competência</TableHead>
                      <TableHead className="text-xs h-9">Dt Recebimento</TableHead>
                      <TableHead className="text-xs h-9 text-center">Volumes</TableHead>
                      <TableHead className="text-xs h-9">Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balancetes.map((balancete) => (
                      <TableRow key={balancete.id} className="hover:bg-gray-50">
                        <TableCell className="text-sm font-medium py-2.5">
                          {balancete.condominium_name}
                        </TableCell>
                        <TableCell className="text-sm py-2.5">
                          {balancete.competencia}
                        </TableCell>
                        <TableCell className="text-sm py-2.5">
                          {formatDate(balancete.received_at)}
                        </TableCell>
                        <TableCell className="text-sm text-center py-2.5">
                          {balancete.volumes}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-2.5 max-w-[250px] truncate">
                          {balancete.observations || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {protocolo.cancelado && protocolo.motivo_cancelamento && (
                <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200">
                  <span className="text-xs font-semibold text-red-700">Motivo do cancelamento: </span>
                  <span className="text-xs text-red-600">{protocolo.motivo_cancelamento}</span>
                  {protocolo.cancelado_em && (
                    <span className="text-xs text-red-400 ml-2">
                      ({formatDateTime(protocolo.cancelado_em)})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [balancetesMap, loadingBalancetes]);

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia
          items={[
            { label: "Balancetes", href: "/balancetes" },
            { label: "Protocolos", isActive: true },
          ]}
        />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Protocolos de Envio</h1>
            {!loading && protocolos.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">
                    {stats.enviados} enviado{stats.enviados !== 1 ? "s" : ""}
                  </span>
                </div>
                {stats.cancelados > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">
                      {stats.cancelados} cancelado{stats.cancelados !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {stats.totalBalancetes} balancete{stats.totalBalancetes !== 1 ? "s" : ""} enviado{stats.totalBalancetes !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="h-12 px-4 gap-2"
            onClick={() => router.push("/balancetes")}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>

        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por número, data, motivo ou condomínio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-500"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlyActive(!showOnlyActive)}
              className={`rounded-full w-10 h-10 p-0 flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                showOnlyActive
                  ? "bg-green-500 border-green-500 text-white hover:bg-green-600 shadow-lg ring-2 ring-green-200 ring-offset-1"
                  : "bg-gray-200 border-gray-300 text-gray-600 hover:bg-gray-300 shadow-sm"
              }`}
              title={showOnlyActive ? "Mostrando apenas enviados" : "Mostrando apenas cancelados"}
            >
              {showOnlyActive ? "E" : "C"}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando protocolos...
            </div>
          ) : sortedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <span className="text-sm font-medium">Nenhum protocolo encontrado</span>
              <span className="text-xs mt-1">
                {searchQuery
                  ? "Tente ajustar a busca."
                  : showOnlyActive
                  ? "Nenhum protocolo enviado."
                  : "Nenhum protocolo cancelado."}
              </span>
            </div>
          ) : (
            <TabelaOmnia
              columns={columns}
              data={sortedData}
              sortField={sortField ?? undefined}
              sortDirection={sortDirection}
              onSort={handleSort}
              customActions={customActions}
              expandedRowId={expandedProtocoloId}
              onRowExpand={handleRowExpand}
              renderExpandedRow={renderExpandedRow}
            />
          )}
        </div>
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Protocolo</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <p>
                  Tem certeza que deseja cancelar o{" "}
                  <strong>
                    Protocolo #
                    {protocoloToCancel
                      ? String(protocoloToCancel.numero).padStart(3, "0")
                      : ""}
                  </strong>
                  ?
                </p>
                <p className="mt-2">Esta ação irá:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Marcar o protocolo como cancelado</li>
                  <li>
                    Remover a data de envio dos{" "}
                    {protocoloToCancel?.quantidade_balancetes} balancete(s)
                  </li>
                  <li>Permitir que os balancetes sejam enviados novamente</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <label className="text-sm font-medium">
              Motivo do cancelamento (opcional)
            </label>
            <Input
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: Erro no envio, balancetes incorretos..."
              className="mt-1"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={canceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {canceling ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
