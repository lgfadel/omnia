'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { FileUp, Loader2, AlertTriangle, CheckCircle2, ChevronDown, Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { CondominiumSelect } from '@/components/condominiums/CondominiumSelect'
import { balanceteRowKey, buildBalanceteCsvImportPreview, type BalanceteCsvRowStatus } from '@/lib/balanceteCsvImport'
import {
  buildReviewRowViews,
  createReviewRows,
  summarizeReview,
  type BalanceteCsvReviewRow,
  type BalanceteCsvReviewRowView,
  type ExistingBalanceteSnapshot,
} from '@/lib/balanceteCsvImportReview'
import { balanceteCsvImportsRepoSupabase, type BalanceteCsvCommitResult } from '@/repositories/balanceteCsvImportsRepo.supabase'
import { condominiumAliasesRepoSupabase } from '@/repositories/condominiumAliasesRepo.supabase'
import type { Condominium } from '@/repositories/condominiumsRepo.supabase'
import { useToast } from '@/hooks/use-toast'

interface BalanceteCsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  condominiums: Condominium[]
  createdBy?: string
  onImportSuccess?: () => Promise<void> | void
}

const STATUS_LABEL: Record<BalanceteCsvRowStatus, string> = {
  new: 'Novo',
  update: 'Atualiza',
  unchanged: 'Já em dia',
}

function MatchBadge({ row }: { row: BalanceteCsvReviewRow }) {
  if (row.userConfirmed) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Confirmado
      </span>
    )
  }

  const label =
    row.matchSource === 'alias' ? 'Memorizado' : row.matchSource === 'exact' ? 'Nome idêntico' : 'Match automático'

  return (
    <span className="flex items-center gap-1 text-xs text-green-700">
      <CheckCircle2 className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

export function BalanceteCsvImportDialog({
  open,
  onOpenChange,
  condominiums,
  createdBy,
  onImportSuccess,
}: BalanceteCsvImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [reviewRows, setReviewRows] = useState<BalanceteCsvReviewRow[]>([])
  const [existingByKey, setExistingByKey] = useState<Map<string, ExistingBalanceteSnapshot>>(new Map())
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [result, setResult] = useState<BalanceteCsvCommitResult | null>(null)

  const activeCondominiums = useMemo(() => condominiums.filter((c) => c.active !== false), [condominiums])
  const condominiumById = useMemo(() => new Map(condominiums.map((c) => [c.id, c])), [condominiums])

  const views = useMemo(
    () =>
      buildReviewRowViews(reviewRows, {
        isDigitalCondominium: (id) => condominiumById.get(id)?.balancete_digital === true,
        existingByKey,
      }),
    [reviewRows, condominiumById, existingByKey]
  )
  const summary = useMemo(() => summarizeReview(views), [views])
  const pendingViews = views.filter((view) => view.group === 'pending')
  const writeViews = views.filter((view) => view.group === 'write')
  const unchangedViews = views.filter((view) => view.group === 'unchanged')
  const suggestionsToConfirm = pendingViews.filter(
    (view) => !view.row.ignored && view.row.selectedCondominiumId
  ).length

  const resetState = () => {
    setSelectedFile(null)
    setReviewRows([])
    setExistingByKey(new Map())
    setParseErrors([])
    setParsing(false)
    setCommitting(false)
    setShowUnchanged(false)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }

  const updateRow = (rowNumber: number, patch: Partial<BalanceteCsvReviewRow>) =>
    setReviewRows((current) => current.map((r) => (r.rowNumber === rowNumber ? { ...r, ...patch } : r)))

  const handleFileSelected = async (file: File) => {
    setSelectedFile(file)
    setResult(null)
    setParsing(true)

    try {
      const csvText = await file.text()

      let aliases = new Map<string, string>()
      try {
        aliases = await condominiumAliasesRepoSupabase.listMap()
      } catch {
        toast({
          title: 'Não foi possível carregar os nomes memorizados',
          description: 'Os condomínios serão sugeridos só pela semelhança do nome. Revise com atenção.',
          variant: 'destructive',
        })
      }

      const preview = buildBalanceteCsvImportPreview(
        csvText,
        activeCondominiums.map((c) => ({ id: c.id, name: c.name })),
        aliases
      )

      // Qualquer condomínio ativo pode ser escolhido na revisão, então carregamos o que já existe para todos.
      const existing = await balanceteCsvImportsRepoSupabase.loadExisting(
        activeCondominiums.map((c) => c.id),
        Array.from(new Set(preview.rows.map((row) => row.competencia)))
      )

      setExistingByKey(
        new Map(existing.map((balancete) => [balanceteRowKey(balancete.condominium_id, balancete.competencia), balancete]))
      )
      setParseErrors(preview.parseErrors.map((e) => `Linha ${e.rowNumber}: ${e.message}`))
      setReviewRows(createReviewRows(preview.rows))
    } catch (error) {
      toast({
        title: 'Erro ao ler o arquivo CSV',
        description: error instanceof Error ? error.message : 'Falha inesperada ao processar o arquivo.',
        variant: 'destructive',
      })
      setReviewRows([])
    } finally {
      setParsing(false)
    }
  }

  const hasWrites = summary.writeRows.length > 0
  const canSubmit =
    selectedFile !== null &&
    summary.pendingCount === 0 &&
    summary.duplicateKeys.length === 0 &&
    (hasWrites || summary.aliasesToSave.length > 0)

  const handleCommit = async () => {
    if (!selectedFile || !canSubmit) return

    try {
      setCommitting(true)

      if (!hasWrites) {
        // Tudo já estava em dia; só havia nomes novos para memorizar.
        const savedCount = await condominiumAliasesRepoSupabase.upsertMany(summary.aliasesToSave, createdBy)
        toast({
          title: 'Correspondências memorizadas',
          description: `${savedCount} nome(s) serão reconhecidos automaticamente nos próximos arquivos.`,
        })
        handleDialogOpenChange(false)
        return
      }

      if (!createdBy) {
        throw new Error('Não foi possível identificar o usuário logado. Recarregue a página e tente novamente.')
      }

      const commitResult = await balanceteCsvImportsRepoSupabase.commit({
        originalFilename: selectedFile.name,
        createdBy,
        ignoredCount: summary.ignoredCount,
        unchangedCount: summary.unchangedCount,
        aliasesToSave: summary.aliasesToSave,
        rows: summary.writeRows.map(({ row }) => ({
          condominiumId: row.selectedCondominiumId,
          competencia: row.competencia,
          dataCriacaoIso: row.dataCriacaoIso,
        })),
      })

      setResult(commitResult)
      await onImportSuccess?.()
      toast({
        title: 'Importação concluída',
        description: `${commitResult.createdCount} balancete(s) criado(s), ${commitResult.updatedCount} atualizado(s).`,
      })
    } catch (error) {
      toast({
        title: 'Erro ao importar CSV',
        description: error instanceof Error ? error.message : 'Falha inesperada durante a importação.',
        variant: 'destructive',
      })
    } finally {
      setCommitting(false)
    }
  }

  const renderRowHeader = (view: BalanceteCsvReviewRowView, trailing: ReactNode) => {
    const { row, status } = view
    const selectedCondominium = row.selectedCondominiumId
      ? condominiumById.get(row.selectedCondominiumId)
      : undefined

    return (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Checkbox
            checked={!row.ignored}
            onCheckedChange={(checked) => updateRow(row.rowNumber, { ignored: checked !== true })}
          />
          <span className="text-sm font-medium truncate">{row.nomeCondominioCsv}</span>
          <Badge variant="outline">{row.competencia}</Badge>
          {selectedCondominium && (
            <Badge variant="secondary">{selectedCondominium.balancete_digital ? 'Digital' : 'Físico'}</Badge>
          )}
          {status && <Badge variant="outline">{STATUS_LABEL[status]}</Badge>}
        </div>
        {trailing}
      </div>
    )
  }

  const nothingNewInFile = reviewRows.length > 0 && pendingViews.length === 0 && writeViews.length === 0

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Último Balancete (CSV)</DialogTitle>
          <DialogDescription>
            Envie o CSV com a última competência disponível por condomínio. Só aparece o que pede ação: nomes
            novos para confirmar e balancetes novos ou desatualizados. O que já está em dia fica de fora, e os
            nomes que você confirmar são memorizados para os próximos arquivos. Condomínios digitais são marcados
            como recebidos automaticamente; os físicos ficam com o digital pronto, aguardando o físico.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-3">
            <Label htmlFor="balancete-csv-file">Arquivo CSV</Label>
            <input
              id="balancete-csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                if (file) handleFileSelected(file)
              }}
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
                  <span>Selecionar arquivo CSV</span>
                </div>
              </Button>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-4 flex items-center justify-between gap-3">
                <p className="text-sm font-medium break-words">{selectedFile.name}</p>
                <Button type="button" variant="ghost" onClick={resetState} disabled={committing}>
                  Trocar
                </Button>
              </div>
            )}
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lendo arquivo...
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
              <p className="font-medium">Linhas ignoradas por erro de formato:</p>
              {parseErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          {reviewRows.length > 0 && !result && (
            <div className="space-y-5">
              {pendingViews.length > 0 && (
                <section className="space-y-2">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
                    <span>
                      {summary.pendingCount > 0
                        ? `${summary.pendingCount} nome(s) novos precisam da sua confirmação. Depois de confirmados, não serão perguntados de novo.`
                        : 'Todos os nomes foram confirmados.'}
                    </span>
                    {suggestionsToConfirm > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setReviewRows((current) =>
                            current.map((r) =>
                              !r.ignored && !r.confirmed && r.selectedCondominiumId
                                ? { ...r, confirmed: true, userConfirmed: true }
                                : r
                            )
                          )
                        }
                      >
                        Confirmar sugestões ({suggestionsToConfirm})
                      </Button>
                    )}
                  </div>

                  {pendingViews.map((view) => {
                    const { row } = view
                    return (
                      <div
                        key={row.rowNumber}
                        className={`rounded-lg border p-3 space-y-2 ${row.ignored ? 'opacity-50' : ''}`}
                      >
                        {renderRowHeader(
                          view,
                          <div className="flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Confirme o condomínio
                          </div>
                        )}
                        {!row.ignored && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <CondominiumSelect
                                condominiums={activeCondominiums}
                                value={row.selectedCondominiumId}
                                onValueChange={(value) =>
                                  updateRow(row.rowNumber, {
                                    selectedCondominiumId: value,
                                    confirmed: value !== '',
                                    userConfirmed: value !== '',
                                  })
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!row.selectedCondominiumId}
                              onClick={() => updateRow(row.rowNumber, { confirmed: true, userConfirmed: true })}
                            >
                              Confirmar
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </section>
              )}

              {writeViews.length > 0 && (
                <section className="space-y-2">
                  <p className="text-sm font-medium">Serão gravados ({summary.writeRows.length})</p>
                  {writeViews.map((view) => {
                    const { row } = view
                    return (
                      <div
                        key={row.rowNumber}
                        className={`rounded-lg border p-3 space-y-1 ${row.ignored ? 'opacity-50' : ''}`}
                      >
                        {renderRowHeader(
                          view,
                          <div className="flex items-center gap-2 min-w-0">
                            <MatchBadge row={row} />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => updateRow(row.rowNumber, { confirmed: false, userConfirmed: false })}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Alterar
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground pl-6 truncate">
                          {condominiumById.get(row.selectedCondominiumId)?.name}
                        </p>
                      </div>
                    )
                  })}
                </section>
              )}

              {summary.duplicateKeys.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Duas linhas apontam para o mesmo condomínio e competência. Desmarque uma delas ou use
                  &quot;Alterar&quot; para corrigir o condomínio.
                </div>
              )}

              {nothingNewInFile && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Nada novo neste arquivo. Os {unchangedViews.length} balancete(s) já estão em dia.
                </div>
              )}

              {unchangedViews.length > 0 && (
                <section className="space-y-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setShowUnchanged((current) => !current)}
                    aria-expanded={showUnchanged}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showUnchanged ? '' : '-rotate-90'}`}
                    />
                    {unchangedViews.length} balancete(s) já estão em dia e ficam de fora
                  </button>
                  {showUnchanged && (
                    <div className="rounded-lg border divide-y">
                      {unchangedViews.map(({ row }) => (
                        <div
                          key={row.rowNumber}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-muted-foreground"
                        >
                          <span className="truncate">{row.nomeCondominioCsv}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline">{row.competencia}</Badge>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => updateRow(row.rowNumber, { confirmed: false, userConfirmed: false })}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Alterar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {result && (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Criados</p>
                <p className="text-2xl font-semibold text-green-700">{result.createdCount}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Atualizados</p>
                <p className="text-2xl font-semibold text-blue-700">{result.updatedCount}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Já em dia</p>
                <p className="text-2xl font-semibold text-muted-foreground">
                  {result.noopCount + summary.unchangedCount}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Nomes memorizados</p>
                <p className="text-2xl font-semibold">{result.aliasesSavedCount}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={committing}>
            Fechar
          </Button>
          {!result && (
            <Button type="button" onClick={handleCommit} disabled={!canSubmit || committing}>
              {committing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : hasWrites ? (
                `Confirmar Importação (${summary.writeRows.length})`
              ) : (
                `Memorizar correspondências${summary.aliasesToSave.length > 0 ? ` (${summary.aliasesToSave.length})` : ''}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
