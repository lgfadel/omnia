"use client"

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowRight, Check, ChevronDown, Download, Eye, FileDown, FileText, History, Loader2, MessageSquare, Pencil, RefreshCcw, Sparkles, TriangleAlert } from 'lucide-react'
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
  onOpenTranscription?: () => void
}

const STALE_GENERATION_MS = 90_000

export function AtaMinutaPanel({ ataId, ataTitle, onOpenTranscription }: AtaMinutaPanelProps) {
  const instructionsId = useId()
  const [minuta, setMinuta] = useState<AtaMinuta | null>(null)
  const [versions, setVersions] = useState<AtaMinutaVersion[]>([])
  const [messages, setMessages] = useState<AtaMinutaMessage[]>([])
  const [documents, setDocuments] = useState<AtaMinutaDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasReviewedTranscription, setHasReviewedTranscription] = useState<boolean | null>(null)
  const [hasTranscription, setHasTranscription] = useState<boolean | null>(null)
  const [initialInstructions, setInitialInstructions] = useState<string | undefined>()
  const [isDocumentBusy, setIsDocumentBusy] = useState(false)
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

  const isStuck = Boolean(!isStreaming && minuta?.status === 'generating' && Date.now() - new Date(minuta.updatedAt).getTime() > STALE_GENERATION_MS)
  const isGenerating = isStreaming || (minuta?.status === 'generating' && !isStuck)
  const isBusy = isGenerating || isSaving || isDocumentBusy

  useEffect(() => {
    if (minuta?.status !== 'generating' || isStreaming || isStuck) return
    const interval = window.setInterval(() => void refresh(), 5_000)
    return () => window.clearInterval(interval)
  }, [minuta?.status, isStreaming, isStuck, refresh])

  const run = async (instruction: string | undefined) => {
    if (isBusy || hasTranscription !== true) return
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
      const message = streamError instanceof Error ? streamError.message : 'Não foi possível gerar a minuta.'
      await refresh()
      setError(message)
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const saveDraft = async () => {
    if (isBusy) return
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
    if (isBusy) return
    setIsSaving(true)
    setError(null)
    try {
      await ataMinutasRepoSupabase.saveManualEdit(ataId, version.content)
      await refresh()
      setMode('view')
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Não foi possível restaurar esta versão.')
    } finally {
      setIsSaving(false)
    }
  }

  const initialContent = useMemo(() => versions.find((version) => version.origin === 'generation')?.content ?? '', [versions])
  const savedInitialInstruction = messages.find((message) => message.role === 'user')?.content ?? ''
  const preparationInstruction = initialInstructions ?? savedInitialInstruction

  const exportDocx = async () => {
    try {
      const blob = await buildMinutaDocxBlob(ataTitle, minuta?.content ?? '')
      downloadBlob(blob, `${ataTitle}-minuta.docx`)
    } catch {
      setError('Não foi possível exportar a minuta. Tente novamente.')
    }
  }

  const exportTxt = () => {
    downloadBlob(new Blob([minuta?.content ?? ''], { type: 'text/plain;charset=utf-8' }), `${ataTitle}-minuta.txt`)
  }

  if (isLoading) return (
    <div role="status" className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Carregando minuta…
    </div>
  )

  const displayedContent = isStreaming ? streamingContent : (minuta?.content ?? '')
  const hasContent = Boolean(minuta?.content.trim())
  const showPreparation = !hasContent && !isGenerating
  const canSendChat = Boolean(minuta?.status === 'ready' && !isBusy && mode === 'view')
  const documentUploader = (
    <AtaMinutaDocuments documents={documents} disabled={isGenerating || isSaving || mode === 'edit'} onBusyChange={setIsDocumentBusy}
      onUpload={async (file, kind) => { const document = await ataMinutasRepoSupabase.uploadDocument(ataId, file, kind); setDocuments((current) => [document, ...current]) }}
      onDelete={async (documentId) => { await ataMinutasRepoSupabase.deleteDocument(ataId, documentId); setDocuments((current) => current.filter((document) => document.id !== documentId)) }} />
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight">{showPreparation ? 'Prepare a primeira minuta' : 'Minuta da assembleia'}</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{showPreparation
            ? 'Reúna os documentos e conte ao agente como você quer registrar esta assembleia.'
            : 'Revise o documento, ajuste o texto e exporte a versão final.'}</p>
        </div>
        <Badge variant="outline" className="gap-1.5 py-1 font-normal">
          {isGenerating ? <><Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />Gerando minuta</>
            : hasContent ? <><FileText className="h-3 w-3" />{versions.length > 0 ? `Versão ${versions[versions.length - 1].sequence + 1}` : 'Rascunho'}</>
              : <>{hasTranscription ? 'Pronta para preparar' : 'Aguardando transcrição'}</>}
        </Badge>
      </div>

      {error && <Alert variant="destructive"><TriangleAlert className="h-4 w-4" /><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription>
        {hasTranscription === null && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>Tentar carregar novamente</Button>}
      </Alert>}

      {hasTranscription === false && (
        <Alert><FileText className="h-4 w-4" /><AlertTitle>Comece pela transcrição</AlertTitle>
          <AlertDescription>Envie a gravação da assembleia na aba Transcrição. O texto será a base da minuta.</AlertDescription>
          {onOpenTranscription && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onOpenTranscription}>Ir para transcrição<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>}
        </Alert>
      )}
      {hasTranscription && hasReviewedTranscription === false && (
        <Alert><TriangleAlert className="h-4 w-4" /><AlertTitle>Confira a transcrição antes de gerar</AlertTitle>
          <AlertDescription>Você pode continuar, mas a minuta pode reproduzir erros de uma transcrição ainda não revisada.</AlertDescription>
          {onOpenTranscription && <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onOpenTranscription}>Revisar transcrição<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>}
        </Alert>
      )}

      {minuta?.status === 'failed' && !isStreaming && (
        <Alert variant="destructive"><TriangleAlert className="h-4 w-4" /><AlertTitle>A geração falhou</AlertTitle>
          <AlertDescription>{minuta.errorMessage ?? 'Tente gerar a minuta novamente.'}</AlertDescription>
          {hasContent && <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => void run('Continue a minuta de onde parou, sem repetir o que já foi escrito, mantendo o mesmo formato de seções.')}><RefreshCcw className="mr-2 h-4 w-4" />Continuar</Button>
            <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => void run(undefined)}>Gerar de novo</Button>
          </div>}
        </Alert>
      )}
      {isStuck && (
        <Alert><TriangleAlert className="h-4 w-4" /><AlertTitle>A geração foi interrompida</AlertTitle>
          <AlertDescription>O texto já escrito foi preservado. Continue de onde parou ou gere uma nova minuta.</AlertDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            {hasContent && <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => void run('Continue a minuta de onde parou, sem repetir o que já foi escrito, mantendo o mesmo formato de seções.')}><RefreshCcw className="mr-2 h-4 w-4" />Continuar</Button>}
            {hasContent && <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => void run(undefined)}>Gerar de novo</Button>}
          </div>
        </Alert>
      )}

      {showPreparation ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
            <section aria-labelledby={`${instructionsId}-documents`} className="min-w-0 space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">1</span>
                <h3 id={`${instructionsId}-documents`} className="text-sm font-semibold">Documentos de apoio <span className="ml-1 text-xs font-normal text-muted-foreground">Opcional</span></h3>
              </div>
              {documentUploader}
            </section>
            <section aria-labelledby={`${instructionsId}-heading`} className="min-w-0 space-y-5 border-t pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">2</span>
                <h3 id={`${instructionsId}-heading`} className="text-sm font-semibold">Oriente o agente <span className="ml-1 text-xs font-normal text-muted-foreground">Opcional</span></h3>
              </div>
              <div className="space-y-3">
                <Label htmlFor={instructionsId}>Instruções iniciais para o agente</Label>
                <p id={`${instructionsId}-help`} className="text-sm leading-relaxed text-muted-foreground">Defina o tom, os detalhes que merecem destaque e como registrar as deliberações. Estas orientações serão usadas já na primeira versão.</p>
                <Textarea id={instructionsId} value={preparationInstruction} onChange={(event) => setInitialInstructions(event.target.value)} disabled={isBusy}
                  aria-describedby={`${instructionsId}-help`} placeholder="Ex.: use linguagem formal, organize por item de pauta e destaque os resultados de cada votação."
                  className="min-h-44 resize-y bg-background/60 leading-relaxed" />
                <p className="text-xs leading-relaxed text-muted-foreground">Você poderá pedir outros ajustes pelo chat depois de gerar.</p>
              </div>
            </section>
          </div>
          <div className="flex flex-col gap-4 border-t bg-muted/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              {hasReviewedTranscription ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0" />}
              {isDocumentBusy ? 'Aguarde o envio dos documentos.' : hasReviewedTranscription ? 'Transcrição revisada. Tudo pronto para começar.' : hasTranscription ? 'A transcrição está disponível para gerar.' : 'Uma transcrição é necessária para começar.'}
            </p>
            <Button type="button" className="shrink-0" disabled={isBusy || hasTranscription !== true} onClick={() => void run(preparationInstruction.trim() || (initialInstructions !== undefined && savedInitialInstruction ? '' : undefined))}>
              <Sparkles className="mr-2 h-4 w-4" />{minuta?.status === 'failed' || isStuck ? 'Tentar gerar novamente' : 'Gerar primeira minuta'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label="Documento da minuta" className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
              <div className="flex gap-1">
                <Button type="button" variant={mode === 'view' ? 'secondary' : 'ghost'} size="sm" disabled={isBusy} onClick={() => setMode('view')}><Eye className="mr-2 h-4 w-4" />Visualizar</Button>
                <Button type="button" variant={mode === 'edit' ? 'secondary' : 'ghost'} size="sm" disabled={isBusy} onClick={() => { setDraftContent(minuta?.content ?? ''); setMode('edit') }}><Pencil className="mr-2 h-4 w-4" />Editar texto</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {mode === 'edit' ? <>
                  <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={() => setMode('view')}>Cancelar</Button>
                  <Button type="button" size="sm" disabled={isBusy || !draftContent.trim()} onClick={() => void saveDraft()}>{isSaving ? 'Salvando…' : 'Salvar alterações'}</Button>
                </> : <>
                  <Button type="button" variant="ghost" size="sm" disabled={isGenerating || !hasContent} onClick={exportTxt}><Download className="mr-2 h-4 w-4" />TXT</Button>
                  <Button type="button" variant="outline" size="sm" disabled={isGenerating || !hasContent} onClick={() => void exportDocx()}><FileDown className="mr-2 h-4 w-4" />Exportar DOCX</Button>
                </>}
              </div>
            </div>
            {isGenerating && <div role="status" className="flex items-center gap-2 border-b bg-primary/5 px-5 py-3 text-sm text-primary"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />{displayedContent ? 'Escrevendo a minuta…' : 'Analisando a transcrição e os documentos…'}</div>}
            <div className="min-h-96 px-5 py-7 sm:px-9 sm:py-9">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Minuta de ata</p>
              <h3 className="mb-8 break-words border-b pb-5 text-lg font-semibold leading-snug">{ataTitle}</h3>
              {mode === 'edit' && !isGenerating ? <AtaTranscriptionEditor value={draftContent} onChange={setDraftContent} disabled={isSaving} ariaLabel="Texto da minuta" textareaClassName="min-h-96 text-sm leading-7" />
                : <AtaMinutaViewer content={displayedContent} />}
            </div>
          </section>

          <aside aria-label="Revisão da minuta" className="min-w-0 space-y-5">
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="space-y-2 border-b px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-primary" />Ajuste com o agente</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">Peça uma correção. Cada ajuste fica salvo em uma nova versão.</p>
              </div>
              <div className="p-5">
                {mode === 'edit' && <p className="mb-3 text-xs text-muted-foreground">Salve ou cancele a edição para usar o chat.</p>}
                <AtaMinutaChat messages={messages} initialContent={initialContent} initialVersionId={versions.find((version) => version.origin === 'generation')?.id} isSending={isGenerating} disabled={!canSendChat} onSend={(instruction) => void run(instruction)} />
              </div>
            </section>
            <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-5 py-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />Documentos de apoio <span className="text-xs text-muted-foreground">({documents.length})</span></span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t p-5">{documentUploader}</div>
            </details>
            {versions.length > 0 && <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-5 py-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" />Histórico de versões <span className="text-xs text-muted-foreground">({versions.length})</span></span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t p-4"><AtaMinutaVersions versions={versions} currentContent={minuta?.content ?? ''} disabled={isBusy || mode === 'edit'} onRestore={(version) => void restoreVersion(version)} /></div>
            </details>}
          </aside>
        </div>
      )}
    </div>
  )
}
