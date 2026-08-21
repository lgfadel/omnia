"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Eye, FileDown, Pencil, RefreshCcw, Sparkles, TriangleAlert } from 'lucide-react'
import { AtaMinutaChat } from './AtaMinutaChat'
import { AtaMinutaDocuments } from './AtaMinutaDocuments'
import { AtaMinutaViewer } from './AtaMinutaViewer'
import { AtaMinutaVersions } from './AtaMinutaVersions'
import { AtaTranscriptionEditor } from './AtaTranscriptionEditor'
import { ataMinutasRepoSupabase } from '@/repositories/ataMinutasRepo.supabase'
import { ataTranscriptionsRepoSupabase } from '@/repositories/ataTranscriptionsRepo.supabase'
import { buildMinutaDocxBlob, downloadBlob } from '@/lib/ataMinutaDocx'
import type { AtaMinuta, AtaMinutaDocument, AtaMinutaMessage, AtaMinutaVersion } from '@/data/types'

interface AtaMinutaPanelProps {
  ataId: string
  ataTitle: string
}

// Uma minuta parada em "generating" há mais de 90 s (o mesmo teto usado no servidor
// para julgar uma geração interrompida) deixa de ser tratada como "em andamento".
const STALE_GENERATION_MS = 90_000

export function AtaMinutaPanel({ ataId, ataTitle }: AtaMinutaPanelProps) {
  const [minuta, setMinuta] = useState<AtaMinuta | null>(null)
  const [versions, setVersions] = useState<AtaMinutaVersion[]>([])
  const [messages, setMessages] = useState<AtaMinutaMessage[]>([])
  const [documents, setDocuments] = useState<AtaMinutaDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasReviewedTranscription, setHasReviewedTranscription] = useState<boolean | null>(null)
  const [hasTranscription, setHasTranscription] = useState<boolean | null>(null)

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [draftContent, setDraftContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [minutaData, transcriptionData] = await Promise.all([
        ataMinutasRepoSupabase.load(ataId),
        ataTranscriptionsRepoSupabase.load(ataId),
      ])
      setMinuta(minutaData.minuta)
      setVersions(minutaData.versions)
      setMessages(minutaData.messages)
      setDocuments(minutaData.documents)
      setDraftContent(minutaData.minuta?.content ?? '')
      setHasTranscription(Boolean(transcriptionData.transcription))
      setHasReviewedTranscription(Boolean(transcriptionData.transcription?.isReviewed))
      setError(null)
    } catch {
      setError('Não foi possível carregar a minuta desta ata.')
    } finally {
      setIsLoading(false)
    }
  }, [ataId])

  useEffect(() => { void refresh() }, [refresh])

  const isStuck = Boolean(
    minuta?.status === 'generating' && Date.now() - new Date(minuta.updatedAt).getTime() > STALE_GENERATION_MS,
  )

  const run = async (instruction: string | undefined) => {
    setError(null)
    setIsStreaming(true)
    setStreamingContent('')
    setMode('view')
    try {
      await ataMinutasRepoSupabase.streamTurn(ataId, instruction, (event) => {
        if (event.type === 'delta') setStreamingContent((current) => current + event.text)
      })
      await refresh()
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : 'Não foi possível gerar a minuta.')
      await refresh()
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const saveDraft = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await ataMinutasRepoSupabase.saveManualEdit(ataId, draftContent)
      await refresh()
      setMode('view')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a minuta.')
    } finally {
      setIsSaving(false)
    }
  }

  const restoreVersion = async (version: AtaMinutaVersion) => {
    setError(null)
    try {
      await ataMinutasRepoSupabase.saveManualEdit(ataId, version.content)
      await refresh()
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Não foi possível restaurar esta versão.')
    }
  }

  const initialContent = useMemo(() => versions.find((version) => version.origin === 'generation')?.content ?? '', [versions])

  const exportDocx = async () => {
    const blob = await buildMinutaDocxBlob(ataTitle, minuta?.content ?? '')
    downloadBlob(blob, `${ataTitle}-minuta.docx`)
  }

  const exportTxt = () => {
    downloadBlob(new Blob([minuta?.content ?? ''], { type: 'text/plain;charset=utf-8' }), `${ataTitle}-minuta.txt`)
  }

  if (isLoading) return <p className="py-10 text-sm text-muted-foreground">Carregando minuta…</p>

  const displayedContent = isStreaming ? streamingContent : (minuta?.content ?? '')
  const canSendChat = Boolean(minuta && minuta.status === 'ready' && !isStreaming)

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 via-background to-background dark:from-violet-950/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-violet-600" />
                Minuta de ATA
              </CardTitle>
              <CardDescription>Gerada a partir da transcrição revisada, dividida por item de pauta e refinável por chat.</CardDescription>
            </div>
            {minuta && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void exportTxt()} disabled={!minuta.content.trim()}>
                  <Download className="mr-2 h-4 w-4" />
                  .txt
                </Button>
                <Button variant="outline" size="sm" onClick={() => void exportDocx()} disabled={!minuta.content.trim()}>
                  <FileDown className="mr-2 h-4 w-4" />
                  .docx
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {error && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Não foi possível continuar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasTranscription === false && (
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Nenhuma transcrição encontrada</AlertTitle>
              <AlertDescription>Envie e revise a gravação na aba Transcrição antes de gerar a minuta.</AlertDescription>
            </Alert>
          )}

          {hasTranscription && hasReviewedTranscription === false && (
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Transcrição ainda não revisada</AlertTitle>
              <AlertDescription>A minuta pode ser gerada mesmo assim, mas pode conter imprecisões herdadas da transcrição.</AlertDescription>
            </Alert>
          )}

          <AtaMinutaDocuments
            documents={documents}
            disabled={isStreaming}
            onUpload={async (file, kind) => { const document = await ataMinutasRepoSupabase.uploadDocument(ataId, file, kind); setDocuments((current) => [document, ...current]) }}
            onDelete={async (documentId) => { await ataMinutasRepoSupabase.deleteDocument(ataId, documentId); setDocuments((current) => current.filter((document) => document.id !== documentId)) }}
          />

          {!minuta && (
            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-6 text-center dark:border-violet-900 dark:bg-violet-950/10">
              <Sparkles className="mx-auto mb-3 h-7 w-7 text-violet-600" />
              <p className="font-medium">Gere a minuta a partir da transcrição</p>
              <p className="mt-1 text-sm text-muted-foreground">O texto aparece conforme é escrito e pode ser corrigido depois, por chat ou editando diretamente.</p>
              <Button className="mt-4" disabled={isStreaming || hasTranscription !== true} onClick={() => void run(undefined)}>
                <Sparkles className="mr-2 h-4 w-4" />
                {isStreaming ? 'Gerando…' : 'Gerar minuta de ATA'}
              </Button>
            </div>
          )}

          {isStuck && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">A geração foi interrompida</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">O texto até aqui não foi perdido. Continue de onde parou ou gere tudo de novo.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={isStreaming} onClick={() => void run('Continue a minuta de onde parou, sem repetir o que já foi escrito, mantendo o mesmo formato de seções.')}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Continuar
                </Button>
                <Button variant="outline" size="sm" disabled={isStreaming} onClick={() => void run(undefined)}>Gerar de novo</Button>
              </div>
            </div>
          )}

          {minuta?.status === 'failed' && !isStreaming && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
              <div>
                <p className="font-medium text-rose-900 dark:text-rose-100">A geração falhou</p>
                <p className="text-sm text-rose-700 dark:text-rose-300">{minuta.errorMessage ?? 'Tente novamente.'}</p>
              </div>
              <Button variant="outline" onClick={() => void run(undefined)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Gerar de novo
              </Button>
            </div>
          )}

          {(minuta || isStreaming) && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Button variant={mode === 'view' ? 'secondary' : 'ghost'} size="sm" disabled={isStreaming} onClick={() => setMode('view')}>
                    <Eye className="mr-2 h-4 w-4" />
                    Visualizar
                  </Button>
                  <Button variant={mode === 'edit' ? 'secondary' : 'ghost'} size="sm" disabled={isStreaming} onClick={() => { setDraftContent(minuta?.content ?? ''); setMode('edit') }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </div>
                {isStreaming && <span className="text-sm text-muted-foreground">Gerando…</span>}
                {mode === 'edit' && (
                  <Button size="sm" disabled={isSaving} onClick={() => void saveDraft()}>{isSaving ? 'Salvando…' : 'Salvar alterações'}</Button>
                )}
              </div>

              <div className="rounded-lg border p-4">
                {mode === 'edit' && !isStreaming ? (
                  <AtaTranscriptionEditor
                    value={draftContent}
                    onChange={setDraftContent}
                    disabled={isSaving}
                    ariaLabel="Texto da minuta"
                    textareaClassName="min-h-96 text-sm leading-6"
                  />
                ) : (
                  <AtaMinutaViewer content={displayedContent} />
                )}
              </div>
            </>
          )}

          {minuta && !isStuck && (
            <AtaMinutaVersions versions={versions} currentContent={minuta.content} disabled={isStreaming} onRestore={(version) => void restoreVersion(version)} />
          )}
        </CardContent>
      </Card>

      {minuta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Refinar por chat</CardTitle>
            <CardDescription>Peça correções em linguagem natural — cada pedido gera uma nova versão, sem descartar o texto anterior.</CardDescription>
          </CardHeader>
          <CardContent>
            <AtaMinutaChat
              messages={messages}
              initialContent={initialContent}
              isSending={isStreaming}
              disabled={!canSendChat}
              onSend={(instruction) => void run(instruction)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
