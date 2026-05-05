'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Loader2, AlertTriangle, CheckCircle2, FileText, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { balanceteProtocolImportsRepo } from '@/repositories/balanceteProtocolImports.repo'
import type { Balancete } from '@/repositories/balancetesRepo.supabase'
import type { Protocolo } from '@/repositories/protocolosRepo.supabase'
import type { ProtocolImportBatchResult, ProtocolImportItemResult } from '@/server/balanceteProtocolImportService'
import { useToast } from '@/hooks/use-toast'

interface ProtocolImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balancetes: Balancete[]
  protocolos: Protocolo[]
  onImportSuccess?: () => Promise<void> | void
}

function getStatusLabel(status: ProtocolImportItemResult['status']) {
  switch (status) {
    case 'matched':
      return 'Anexado automaticamente'
    case 'resolved':
      return 'Resolvido manualmente'
    case 'not_found':
      return 'Protocolo não identificado'
    case 'protocol_not_found':
      return 'Protocolo não encontrado'
    case 'multiple_matches':
      return 'Múltiplos balancetes possíveis'
    case 'already_attached':
      return 'Balancete já anexado'
    case 'error':
      return 'Erro no processamento'
  }
}

function getStatusTone(status: ProtocolImportItemResult['status']) {
  if (status === 'matched' || status === 'resolved') return 'bg-green-100 text-green-700 hover:bg-green-100'
  if (status === 'error') return 'bg-red-100 text-red-700 hover:bg-red-100'
  return 'bg-amber-100 text-amber-700 hover:bg-amber-100'
}

export function ProtocolImportDialog({
  open,
  onOpenChange,
  balancetes,
  protocolos,
  onImportSuccess,
}: ProtocolImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null)
  const [result, setResult] = useState<ProtocolImportBatchResult | null>(null)
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({})

  const protocoloNumberById = useMemo(
    () => new Map(protocolos.map((protocolo) => [protocolo.id, protocolo.numero])),
    [protocolos]
  )

  const selectableBalancetes = useMemo(
    () =>
      balancetes
        .filter((balancete) => Boolean(balancete.protocolo_id))
        .sort((a, b) => (a.condominium_name || '').localeCompare(b.condominium_name || '')),
    [balancetes]
  )

  useEffect(() => {
    if (!open) {
      setSelectedFile(null)
      setResult(null)
      setSelectedTargets({})
      setUploading(false)
      setResolvingItemId(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open])

  useEffect(() => {
    if (!result) return

    const defaults: Record<string, string> = {}
    for (const item of result.items) {
      if (item.balanceteId) {
        defaults[item.id] = item.balanceteId
        continue
      }

      if (item.candidateBalanceteIds.length === 1) {
        defaults[item.id] = item.candidateBalanceteIds[0]
      }
    }
    setSelectedTargets(defaults)
  }, [result])

  const pendingItems = useMemo(
    () =>
      result?.items.filter((item) =>
        ['not_found', 'protocol_not_found', 'multiple_matches', 'already_attached'].includes(item.status)
      ) ?? [],
    [result]
  )

  const handleImport = async () => {
    if (!selectedFile) return

    try {
      setUploading(true)
      const imported = await balanceteProtocolImportsRepo.importBatch(selectedFile)
      setResult(imported)
      await onImportSuccess?.()
      toast({
        title: 'Lote processado',
        description: `${imported.batch.matchedCount} página(s) anexada(s), ${imported.batch.pendingCount} pendente(s).`,
      })
    } catch (error) {
      toast({
        title: 'Erro ao importar PDF',
        description: error instanceof Error ? error.message : 'Falha inesperada no processamento.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleResolve = async (item: ProtocolImportItemResult) => {
    const balanceteId = selectedTargets[item.id]
    if (!result?.batch.id || !balanceteId) return

    try {
      setResolvingItemId(item.id)
      const resolved = await balanceteProtocolImportsRepo.resolveItem(result.batch.id, item.id, balanceteId)
      setResult((current) =>
        current
          ? {
              ...current,
              batch: {
                ...current.batch,
                matchedCount: current.items.filter((entry) => entry.status === 'matched' || entry.status === 'resolved').length + (item.status === 'matched' || item.status === 'resolved' ? 0 : 1),
                pendingCount: current.items.filter((entry) =>
                  ['not_found', 'protocol_not_found', 'multiple_matches', 'already_attached'].includes(entry.status)
                ).length - 1,
                failedCount: current.batch.failedCount,
              },
              items: current.items.map((entry) => (entry.id === item.id ? resolved : entry)),
            }
          : current
      )
      await onImportSuccess?.()
      toast({
        title: 'Página resolvida',
        description: `Página ${item.pageNumber} anexada ao balancete selecionado.`,
      })
    } catch (error) {
      toast({
        title: 'Erro ao resolver página',
        description: error instanceof Error ? error.message : 'Falha inesperada ao anexar a página.',
        variant: 'destructive',
      })
    } finally {
      setResolvingItemId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Protocolos Escaneados</DialogTitle>
          <DialogDescription>
            Envie um PDF com várias páginas. O Omnia identifica o número do protocolo em cada página e anexa automaticamente quando houver um único balancete elegível.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          <div className="space-y-3">
            <Label htmlFor="protocol-import-file">PDF multipágina</Label>
            <input
              id="protocol-import-file"
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            {!selectedFile ? (
              <Button
                type="button"
                variant="outline"
                className="w-full h-28 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileUp className="w-8 h-8" />
                  <span>Selecionar PDF escaneado</span>
                  <span className="text-xs">Apenas PDF, até 10MB</span>
                </div>
              </Button>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button type="button" variant="ghost" onClick={() => setSelectedFile(null)} disabled={uploading}>
                  Trocar
                </Button>
              </div>
            )}
          </div>

          {result && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">Páginas</p>
                  <p className="text-2xl font-semibold">{result.batch.totalPages}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">Anexadas</p>
                  <p className="text-2xl font-semibold text-green-700">{result.batch.matchedCount}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-semibold text-amber-700">{result.batch.pendingCount}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">Falhas</p>
                  <p className="text-2xl font-semibold text-red-700">{result.batch.failedCount}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Páginas processadas</h3>
                </div>
                <div className="space-y-3">
                  {result.items.map((item) => {
                    const needsManualResolution = ['not_found', 'protocol_not_found', 'multiple_matches', 'already_attached'].includes(item.status)
                    const selectedTarget = selectedTargets[item.id] ?? ''

                    return (
                      <div key={item.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">Página {item.pageNumber}</span>
                              <Badge className={getStatusTone(item.status)}>{getStatusLabel(item.status)}</Badge>
                              {item.detectedProtocolNumber ? (
                                <Badge variant="outline">Protocolo #{String(item.detectedProtocolNumber).padStart(3, '0')}</Badge>
                              ) : null}
                            </div>
                            {item.protocoloId && protocoloNumberById.get(item.protocoloId) ? (
                              <p className="text-xs text-muted-foreground">
                                Protocolo encontrado no banco: #{String(protocoloNumberById.get(item.protocoloId)).padStart(3, '0')}
                              </p>
                            ) : null}
                            {item.errorMessage ? (
                              <p className="text-xs text-red-600">{item.errorMessage}</p>
                            ) : null}
                          </div>
                          {item.pageFileUrl ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => window.open(item.pageFileUrl!, '_blank')}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Abrir página
                            </Button>
                          ) : null}
                        </div>

                        {needsManualResolution ? (
                          <div className="grid gap-3 lg:grid-cols-[1fr_auto] items-end">
                            <div className="space-y-2">
                              <Label>Selecionar balancete de destino</Label>
                              <Select
                                value={selectedTarget}
                                onValueChange={(value) =>
                                  setSelectedTargets((current) => ({
                                    ...current,
                                    [item.id]: value,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Escolha um balancete enviado" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectableBalancetes.map((balancete) => {
                                    const protocoloNumero = balancete.protocolo_id
                                      ? protocoloNumberById.get(balancete.protocolo_id)
                                      : null
                                    return (
                                      <SelectItem key={balancete.id} value={balancete.id}>
                                        {balancete.condominium_name} • {balancete.competencia}
                                        {protocoloNumero ? ` • Prot. #${String(protocoloNumero).padStart(3, '0')}` : ''}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              onClick={() => handleResolve(item)}
                              disabled={!selectedTarget || resolvingItemId === item.id}
                            >
                              {resolvingItemId === item.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Anexando...
                                </>
                              ) : (
                                'Resolver página'
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {item.status === 'matched' || item.status === 'resolved' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            )}
                            {item.status === 'matched' || item.status === 'resolved'
                              ? 'Página anexada e disponível no registro do balancete.'
                              : 'Esta página exige conferência manual antes de ser anexada.'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {pendingItems.length === 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Todas as páginas do lote foram anexadas ou resolvidas.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Fechar
          </Button>
          <Button type="button" onClick={handleImport} disabled={!selectedFile || uploading}>
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando PDF...
              </>
            ) : (
              'Importar PDF'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
