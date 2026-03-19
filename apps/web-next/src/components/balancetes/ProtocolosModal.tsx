"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, Printer, Ban, FileText, Calendar, Building2, Loader2 } from "lucide-react"
import { useProtocolosStore } from "@/stores/protocolos.store"
import { useBalancetesStore } from "@/stores/balancetes.store"
import { useAuthStore } from "@/stores/auth.store"
import type { Protocolo } from "@/repositories/protocolosRepo.supabase"
import type { Balancete } from "@/repositories/balancetesRepo.supabase"
import { useToast } from "@/hooks/use-toast"
import { generateProtocoloPDF, downloadPDF } from "@/lib/generateProtocoloPDF"

interface ProtocolosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  const datePart = dateStr.split("T")[0]
  const [year, month, day] = datePart.split("-")
  return `${day}/${month}/${year}`
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ProtocolosModal({ open, onOpenChange }: ProtocolosModalProps) {
  const { toast } = useToast()
  const { userProfile } = useAuthStore()
  const { protocolos, loading, loadProtocolos, cancelarProtocolo, getBalancetesDoProtocolo } = useProtocolosStore()
  const { loadBalancetes } = useBalancetesStore()
  
  const [expandedProtocolo, setExpandedProtocolo] = useState<string | null>(null)
  const [balancetesMap, setBalancetesMap] = useState<Record<string, Balancete[]>>({})
  const [loadingBalancetes, setLoadingBalancetes] = useState<string | null>(null)
  
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [protocoloToCancel, setProtocoloToCancel] = useState<Protocolo | null>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState("")
  const [canceling, setCanceling] = useState(false)

  useEffect(() => {
    if (open) {
      loadProtocolos()
    }
  }, [open, loadProtocolos])

  const stats = useMemo(() => {
    const ativos = protocolos.filter(p => !p.cancelado).length
    const cancelados = protocolos.filter(p => p.cancelado).length
    const totalBalancetes = protocolos.filter(p => !p.cancelado).reduce((sum, p) => sum + p.quantidade_balancetes, 0)
    return { ativos, cancelados, totalBalancetes }
  }, [protocolos])

  const handleToggleExpand = async (protocolo: Protocolo) => {
    if (expandedProtocolo === protocolo.id) {
      setExpandedProtocolo(null)
      return
    }

    setExpandedProtocolo(protocolo.id)
    
    if (!balancetesMap[protocolo.id]) {
      setLoadingBalancetes(protocolo.id)
      try {
        const balancetes = await getBalancetesDoProtocolo(protocolo.id)
        setBalancetesMap(prev => ({ ...prev, [protocolo.id]: balancetes }))
      } catch {
        toast({
          title: "Erro ao carregar balancetes",
          variant: "destructive",
        })
      } finally {
        setLoadingBalancetes(null)
      }
    }
  }

  const handleCancelClick = (protocolo: Protocolo) => {
    setProtocoloToCancel(protocolo)
    setMotivoCancelamento("")
    setCancelDialogOpen(true)
  }

  const handleReimprimir = async (protocolo: Protocolo) => {
    try {
      const balancetes = await getBalancetesDoProtocolo(protocolo.id)
      
      if (balancetes.length === 0) {
        toast({
          title: "Erro ao reimprimir",
          description: "Nenhum balancete encontrado para este protocolo.",
          variant: "destructive",
        })
        return
      }
      
      const pdfBytes = await generateProtocoloPDF({
        numeroProtocolo: protocolo.numero,
        balancetes: balancetes,
        dataEnvio: protocolo.data_envio,
      })
      
      const protocoloNumero = String(protocolo.numero).padStart(3, '0')
      const filename = `protocolo-${protocoloNumero}-${protocolo.data_envio}.pdf`
      downloadPDF(pdfBytes, filename)
      
      toast({
        title: "Protocolo reimpresso",
        description: `Protocolo #${protocoloNumero} foi baixado novamente.`,
      })
    } catch {
      toast({
        title: "Erro ao reimprimir protocolo",
        variant: "destructive",
      })
    }
  }

  const handleConfirmCancel = async () => {
    if (!protocoloToCancel) return

    setCanceling(true)
    try {
      await cancelarProtocolo(
        protocoloToCancel.id,
        userProfile?.id,
        motivoCancelamento || undefined
      )
      
      await loadBalancetes()
      
      setBalancetesMap(prev => {
        const newMap = { ...prev }
        delete newMap[protocoloToCancel.id]
        return newMap
      })
      
      toast({
        title: "Protocolo cancelado",
        description: `Protocolo #${String(protocoloToCancel.numero).padStart(3, '0')} foi cancelado com sucesso.`,
      })
      
      setCancelDialogOpen(false)
      setProtocoloToCancel(null)
    } catch {
      toast({
        title: "Erro ao cancelar protocolo",
        variant: "destructive",
      })
    } finally {
      setCanceling(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <div className="px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Protocolos de Envio
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Gerencie os protocolos de envio de balancetes.
              </DialogDescription>
            </DialogHeader>

            {!loading && protocolos.length > 0 && (
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">{stats.ativos} ativo{stats.ativos !== 1 ? 's' : ''}</span>
                </div>
                {stats.cancelados > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">{stats.cancelados} cancelado{stats.cancelados !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{stats.totalBalancetes} balancete{stats.totalBalancetes !== 1 ? 's' : ''} enviado{stats.totalBalancetes !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <span className="text-sm">Carregando protocolos...</span>
              </div>
            ) : protocolos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-40" />
                <span className="text-sm font-medium">Nenhum protocolo encontrado</span>
                <span className="text-xs mt-1">Envie balancetes para criar protocolos.</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-8" />
                    <TableHead className="w-[100px]">Nº</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Envio</TableHead>
                    <TableHead className="text-center">Balancetes</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {protocolos.map((protocolo) => {
                    const isExpanded = expandedProtocolo === protocolo.id
                    const protocoloNumero = String(protocolo.numero).padStart(3, '0')

                    return (
                      <React.Fragment key={protocolo.id}>
                        <TableRow
                          className={`cursor-pointer ${protocolo.cancelado ? 'bg-gray-50/50 text-muted-foreground' : 'hover:bg-muted/20'}`}
                          onClick={() => handleToggleExpand(protocolo)}
                        >
                          <TableCell className="pr-0">
                            <button className="p-0.5 hover:bg-gray-200 rounded transition-colors">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono font-semibold text-sm ${protocolo.cancelado ? 'line-through text-muted-foreground' : ''}`}>
                              #{protocoloNumero}
                            </span>
                          </TableCell>
                          <TableCell>
                            {protocolo.cancelado ? (
                              <Badge variant="destructive" className="text-[10px] px-2 py-0">
                                Cancelado
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] px-2 py-0 border-green-200">
                                Ativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className={`text-sm ${protocolo.cancelado ? '' : 'font-medium'}`}>
                                {formatDate(protocolo.data_envio)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium">{protocolo.quantidade_balancetes}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(protocolo.created_at)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => handleReimprimir(protocolo)}
                                title="Reimprimir protocolo"
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                              
                              {!protocolo.cancelado && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleCancelClick(protocolo)}
                                  title="Cancelar protocolo"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={7} className="p-0">
                              <div className="bg-muted/20 border-y px-6 py-4">
                                {loadingBalancetes === protocolo.id ? (
                                  <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Carregando balancetes...
                                  </div>
                                ) : balancetesMap[protocolo.id]?.length === 0 ? (
                                  <div className="text-center py-4 text-sm text-muted-foreground">
                                    Nenhum balancete encontrado neste protocolo.
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                      Balancetes incluídos neste protocolo
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-white/60 hover:bg-white/60">
                                            <TableHead className="text-xs h-8">Condomínio</TableHead>
                                            <TableHead className="text-xs h-8">Competência</TableHead>
                                            <TableHead className="text-xs h-8">Dt Recebimento</TableHead>
                                            <TableHead className="text-xs h-8 text-center">Volumes</TableHead>
                                            <TableHead className="text-xs h-8">Observações</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {balancetesMap[protocolo.id]?.map((balancete) => (
                                            <TableRow key={balancete.id} className="bg-white hover:bg-gray-50">
                                              <TableCell className="text-sm font-medium py-2">
                                                {balancete.condominium_name}
                                              </TableCell>
                                              <TableCell className="text-sm py-2">
                                                {balancete.competencia}
                                              </TableCell>
                                              <TableCell className="text-sm py-2">
                                                {formatDate(balancete.received_at)}
                                              </TableCell>
                                              <TableCell className="text-sm text-center py-2">
                                                {balancete.volumes}
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground py-2 max-w-[200px] truncate">
                                                {balancete.observations || "-"}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>

                                    {protocolo.cancelado && protocolo.motivo_cancelamento && (
                                      <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200">
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
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Protocolo</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <p>
                  Tem certeza que deseja cancelar o{" "}
                  <strong>Protocolo #{protocoloToCancel ? String(protocoloToCancel.numero).padStart(3, '0') : ''}</strong>?
                </p>
                <p className="mt-2">Esta ação irá:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Marcar o protocolo como cancelado</li>
                  <li>Remover a data de envio dos {protocoloToCancel?.quantidade_balancetes} balancete(s)</li>
                  <li>Permitir que os balancetes sejam enviados novamente</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-2">
            <label className="text-sm font-medium">Motivo do cancelamento (opcional)</label>
            <Input
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: Erro no envio, balancetes incorretos..."
              className="mt-1"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>
              Voltar
            </AlertDialogCancel>
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
    </>
  )
}
