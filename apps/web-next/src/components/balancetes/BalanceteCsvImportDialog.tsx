'use client'

import { useMemo, useRef, useState } from 'react'
import { FileUp, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
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
import { buildBalanceteCsvImportPreview, type BalanceteCsvPreviewRow } from '@/lib/balanceteCsvImport'
import { balanceteCsvImportsRepoSupabase, type BalanceteCsvCommitResult } from '@/repositories/balanceteCsvImportsRepo.supabase'
import type { Balancete } from '@/repositories/balancetesRepo.supabase'
import type { Condominium } from '@/repositories/condominiumsRepo.supabase'
import { useToast } from '@/hooks/use-toast'

interface BalanceteCsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  condominiums: Condominium[]
  balancetes: Balancete[]
  createdBy?: string
  onImportSuccess?: () => Promise<void> | void
}

interface ReviewRow extends BalanceteCsvPreviewRow {
  selectedCondominiumId: string
  ignored: boolean
}

function hasExistingBalancete(balancetes: Balancete[], condominiumId: string, competencia: string): boolean {
  return balancetes.some((b) => b.condominium_id === condominiumId && b.competencia === competencia)
}

export function BalanceteCsvImportDialog({
  open,
  onOpenChange,
  condominiums,
  balancetes,
  createdBy,
  onImportSuccess,
}: BalanceteCsvImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<BalanceteCsvCommitResult | null>(null)

  const activeCondominiums = useMemo(() => condominiums.filter((c) => c.active !== false), [condominiums])
  const condominiumById = useMemo(() => new Map(condominiums.map((c) => [c.id, c])), [condominiums])

  const resetState = () => {
    setSelectedFile(null)
    setReviewRows([])
    setParseErrors([])
    setParsing(false)
    setCommitting(false)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }

  const handleFileSelected = async (file: File) => {
    setSelectedFile(file)
    setResult(null)
    setParsing(true)

    try {
      const csvText = await file.text()
      const preview = buildBalanceteCsvImportPreview(
        csvText,
        activeCondominiums.map((c) => ({ id: c.id, name: c.name }))
      )

      setParseErrors(preview.parseErrors.map((e) => `Linha ${e.rowNumber}: ${e.message}`))
      setReviewRows(
        preview.rows.map((row) => ({
          ...row,
          selectedCondominiumId: row.condominiumId ?? '',
          ignored: false,
        }))
      )
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

  const rowsToImport = useMemo(() => reviewRows.filter((row) => !row.ignored), [reviewRows])
  const rowsNeedingCondominium = useMemo(
    () => rowsToImport.filter((row) => !row.selectedCondominiumId),
    [rowsToImport]
  )
  const canImport = selectedFile && rowsToImport.length > 0 && rowsNeedingCondominium.length === 0

  const handleCommit = async () => {
    if (!selectedFile || !canImport) return

    try {
      setCommitting(true)
      const commitResult = await balanceteCsvImportsRepoSupabase.commit({
        originalFilename: selectedFile.name,
        createdBy: createdBy!,
        rows: rowsToImport.map((row) => ({
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

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Último Balancete (CSV)</DialogTitle>
          <DialogDescription>
            Envie o CSV com a última competência disponível por condomínio. Condomínios digitais são
            marcados como recebidos automaticamente; condomínios físicos ficam com o digital pronto,
            aguardando o recebimento do físico.
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
            <div className="space-y-3">
              {rowsNeedingCondominium.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {rowsNeedingCondominium.length} linha(s) precisam que você selecione o condomínio correspondente.
                </div>
              )}
              <div className="space-y-2">
                {reviewRows.map((row) => {
                  const selectedCondominium = row.selectedCondominiumId
                    ? condominiumById.get(row.selectedCondominiumId)
                    : undefined
                  const isDigital = selectedCondominium?.balancete_digital ?? false
                  const willUpdate =
                    row.selectedCondominiumId &&
                    hasExistingBalancete(balancetes, row.selectedCondominiumId, row.competencia)

                  return (
                    <div
                      key={row.rowNumber}
                      className={`rounded-lg border p-3 space-y-2 ${row.ignored ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox
                            checked={!row.ignored}
                            onCheckedChange={(checked) =>
                              setReviewRows((current) =>
                                current.map((r) =>
                                  r.rowNumber === row.rowNumber ? { ...r, ignored: checked !== true } : r
                                )
                              )
                            }
                          />
                          <span className="text-sm font-medium truncate">{row.nomeCondominioCsv}</span>
                          <Badge variant="outline">{row.competencia}</Badge>
                          {selectedCondominium && (
                            <Badge variant="secondary">{isDigital ? 'Digital' : 'Físico'}</Badge>
                          )}
                          {willUpdate && <Badge variant="outline">Atualiza existente</Badge>}
                        </div>
                        {row.needsReview ? (
                          <div className="flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Confirme o condomínio
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Match automático
                          </div>
                        )}
                      </div>
                      {!row.ignored && (
                        <CondominiumSelect
                          condominiums={activeCondominiums}
                          value={row.selectedCondominiumId}
                          onValueChange={(value) =>
                            setReviewRows((current) =>
                              current.map((r) =>
                                r.rowNumber === row.rowNumber ? { ...r, selectedCondominiumId: value } : r
                              )
                            )
                          }
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {result && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Criados</p>
                <p className="text-2xl font-semibold text-green-700">{result.createdCount}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Atualizados</p>
                <p className="text-2xl font-semibold text-blue-700">{result.updatedCount}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Sem alteração</p>
                <p className="text-2xl font-semibold text-muted-foreground">{result.noopCount}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={committing}>
            Fechar
          </Button>
          {!result && (
            <Button type="button" onClick={handleCommit} disabled={!canImport || committing}>
              {committing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                `Confirmar Importação${rowsToImport.length > 0 ? ` (${rowsToImport.length})` : ''}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
