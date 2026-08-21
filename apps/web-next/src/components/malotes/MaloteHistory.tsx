'use client'

import { useMemo, useState } from 'react'
import { Inbox, RotateCcw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CondominiumSelect } from '@/components/condominiums/CondominiumSelect'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  maloteItemStatusLabel,
  maloteItemStatusTone,
  summarizeMaloteBatch,
  type MaloteBatchTone,
} from '@/lib/malotes'
import type { Condominium } from '@/repositories/condominiumsRepo.supabase'

export type MaloteHistoryAttempt = {
  status: string
  error_message: string | null
  smtp_message_id: string | null
  created_at: string
}

export type MaloteHistoryItem = {
  id: string
  file_name: string
  status: string
  sent_at: string | null
  created_at: string
  attempts?: MaloteHistoryAttempt[]
}

export type MaloteHistoryBatch = {
  id: string
  recipient_email: string
  created_at: string
  completed_at: string | null
  condominium: { id: string; name: string } | null
  creator: { name: string } | null
  items?: MaloteHistoryItem[]
}

type MaloteHistoryProps = {
  batches: MaloteHistoryBatch[]
  condominiums: Condominium[]
  canResolveDelivery: boolean
  onRetry: (batchId: string, itemId: string) => void
  onResolveDelivery: (itemId: string) => void
}

const toneClasses: Record<MaloteBatchTone, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  progress: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  neutral: 'border-border bg-muted text-muted-foreground',
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

function latestError(item: MaloteHistoryItem) {
  return item.attempts?.find((attempt) => attempt.error_message)?.error_message ?? null
}

export function MaloteHistory({ batches, condominiums, canResolveDelivery, onRetry, onResolveDelivery }: MaloteHistoryProps) {
  const [condominiumFilter, setCondominiumFilter] = useState('')
  const [openBatchId, setOpenBatchId] = useState<string | null>(null)

  // Só oferecemos no filtro os condomínios que de fato aparecem no histórico.
  const filterableCondominiums = useMemo(() => {
    const usedIds = new Set(batches.map((batch) => batch.condominium?.id).filter(Boolean) as string[])
    return condominiums.filter((condominium) => usedIds.has(condominium.id))
  }, [batches, condominiums])

  const visibleBatches = useMemo(
    () => (condominiumFilter ? batches.filter((batch) => batch.condominium?.id === condominiumFilter) : batches),
    [batches, condominiumFilter],
  )

  const openBatch = useMemo(
    () => batches.find((batch) => batch.id === openBatchId) ?? null,
    [batches, openBatchId],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm space-y-2">
          <p className="text-sm font-medium">Filtrar por condomínio</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <CondominiumSelect
                condominiums={filterableCondominiums}
                value={condominiumFilter}
                onValueChange={setCondominiumFilter}
                placeholder="Todos os condomínios"
              />
            </div>
            {condominiumFilter && (
              <Button variant="ghost" size="icon" onClick={() => setCondominiumFilter('')} title="Limpar filtro">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {visibleBatches.length} {visibleBatches.length === 1 ? 'envio' : 'envios'}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border">
        {visibleBatches.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {condominiumFilter ? 'Nenhum envio para este condomínio.' : 'Nenhum malote enviado ainda.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Condomínio</TableHead>
                <TableHead className="w-[160px]">Enviado em</TableHead>
                <TableHead className="w-[180px]">Responsável</TableHead>
                <TableHead className="w-[110px] text-right">Arquivos</TableHead>
                <TableHead className="w-[150px]">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleBatches.map((batch) => {
                const items = batch.items ?? []
                const summary = summarizeMaloteBatch(items.map((item) => item.status))
                return (
                  <TableRow
                    key={batch.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => setOpenBatchId(batch.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setOpenBatchId(batch.id)
                      }
                    }}
                  >
                    <TableCell className="font-medium">{batch.condominium?.name ?? 'Condomínio removido'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(batch.created_at)}</TableCell>
                    <TableCell className="truncate text-sm text-muted-foreground">{batch.creator?.name ?? 'Usuário'}</TableCell>
                    <TableCell className="text-right tabular-nums">{items.length}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('font-medium', toneClasses[summary.tone])}>{summary.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={Boolean(openBatch)} onOpenChange={(open) => !open && setOpenBatchId(null)}>
        <DialogContent className="max-w-2xl">
          {openBatch && (
            <>
              <DialogHeader>
                <DialogTitle>{openBatch.condominium?.name ?? 'Condomínio removido'}</DialogTitle>
                <DialogDescription>
                  Enviado em {formatDateTime(openBatch.created_at)} por {openBatch.creator?.name ?? 'Usuário'} para {openBatch.recipient_email}.
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {(openBatch.items ?? []).map((item) => {
                  const error = latestError(item)
                  return (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.file_name}</p>
                          {item.sent_at && <p className="text-xs text-muted-foreground">Entregue em {formatDateTime(item.sent_at)}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('font-medium', toneClasses[maloteItemStatusTone(item.status)])}>
                            {maloteItemStatusLabel(item.status)}
                          </Badge>
                          {item.status === 'failed' && (
                            <Button size="sm" variant="outline" onClick={() => onRetry(openBatch.id, item.id)}>
                              <RotateCcw className="mr-2 h-3.5 w-3.5" />Reenviar
                            </Button>
                          )}
                          {item.status === 'sending' && canResolveDelivery && (
                            <Button size="sm" variant="outline" onClick={() => onResolveDelivery(item.id)}>Resolver</Button>
                          )}
                        </div>
                      </div>
                      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
