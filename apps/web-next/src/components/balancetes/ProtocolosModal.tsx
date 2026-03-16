"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import { useProtocolosStore } from "@/stores/protocolos.store"
import { useBalancetesStore } from "@/stores/balancetes.store"
import { useAuthStore } from "@/stores/auth.store"
import type { Protocolo } from "@/repositories/protocolosRepo.supabase"
import type { Balancete } from "@/repositories/balancetesRepo.supabase"
import { useToast } from "@/hooks/use-toast"

interface ProtocolosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  const [year, month, day] = dateStr.split("-")
  return `${day}/${month}/${year}`
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

  const handleConfirmCancel = async () => {
    if (!protocoloToCancel) return

    setCanceling(true)
    try {
      await cancelarProtocolo(
        protocoloToCancel.id,
        userProfile?.id,
        motivoCancelamento || undefined
      )
      
      // Recarregar balancetes para atualizar a lista principal
      await loadBalancetes()
      
      // Limpar balancetes do mapa local
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Protocolos de Envio</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                Carregando protocolos...
              </div>
            ) : protocolos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum protocolo encontrado.
              </div>
            ) : (
              <div className="space-y-2">
                {protocolos.map((protocolo) => (
                  <div
                    key={protocolo.id}
                    className={`border rounded-lg ${protocolo.cancelado ? 'bg-gray-50 border-gray-200' : 'bg-white'}`}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleExpand(protocolo)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {expandedProtocolo === protocolo.id ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                Protocolo #{String(protocolo.numero).padStart(3, '0')}
                              </span>
                              {protocolo.cancelado ? (
                                <Badge variant="destructive" className="text-xs">
                                  Cancelado
                                </Badge>
                              ) : (
                                <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                                  Ativo
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(protocolo.data_envio)} • {protocolo.quantidade_balancetes} balancete(s)
                            </div>
                            {protocolo.cancelado && protocolo.motivo_cancelamento && (
                              <div className="text-xs text-red-600 mt-1">
                                Motivo: {protocolo.motivo_cancelamento}
                              </div>
                            )}
                          </div>
                        </div>

                        {!protocolo.cancelado && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleCancelClick(protocolo)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>

                    {expandedProtocolo === protocolo.id && (
                      <div className="border-t px-4 py-3 bg-gray-50">
                        {loadingBalancetes === protocolo.id ? (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            Carregando balancetes...
                          </div>
                        ) : balancetesMap[protocolo.id]?.length === 0 ? (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            Nenhum balancete encontrado.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                              Balancetes incluídos
                            </div>
                            {balancetesMap[protocolo.id]?.map((balancete) => (
                              <div
                                key={balancete.id}
                                className="flex items-center justify-between text-sm py-1 px-2 bg-white rounded border"
                              >
                                <span className="font-medium">{balancete.condominium_name}</span>
                                <span className="text-muted-foreground">
                                  {balancete.competencia} • {balancete.volumes} vol.
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
