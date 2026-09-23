"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { AtaTranscriptionEditor } from './AtaTranscriptionEditor'
import { AtaTranscriptionStatus } from './AtaTranscriptionStatus'
import { getTranscriptionProgress, getAudioValidationError, type AtaTranscriptionStatus as TranscriptionStatus } from '@/lib/ataTranscription'
import { readConvocacao, type ConvocacaoContext } from '@/lib/convocacao'
import { ataTranscriptionsRepoSupabase } from '@/repositories/ataTranscriptionsRepo.supabase'
import type { AtaTranscription, AtaTranscriptionJob } from '@/data/types'
import { Download, FileAudio, FilePlus2, FileText, RefreshCcw, Sparkles, TriangleAlert, X } from 'lucide-react'

interface AtaTranscriptionPanelProps {
  ataId: string
  onGenerateMinuta?: () => void
}

const activeStatuses = new Set<TranscriptionStatus>(['uploading', 'queued', 'processing'])

// O upload e a nova tentativa já acordam o worker. Só um job que continua na fila
// depois disso merece nova chamada, e uma por minuto basta: o painel atualiza a
// cada 7,5 s, e acordar o worker nesse ritmo seria só ruído.
const WAKE_GRACE_MS = 60_000
const WAKE_INTERVAL_MS = 60_000
// O worker publica sinal de vida a cada minuto enquanto processa; cinco sem
// nenhum significam que o container morreu no meio do job. Precisa bater com
// STALE_LEASE_MINUTES do worker e STALE_LEASE_MS da Edge Function.
const STALE_HEARTBEAT_MS = 5 * 60_000

type WorkerHealth = 'ok' | 'unavailable' | 'stalled'
// Um aviso vale para o job e o estado em que foi emitido. Guardá-lo com esse
// contexto, e derivar o que mostrar, faz um sinal de vida novo ou a saída da
// fila encerrarem o aviso sem efeito nenhum para limpá-lo.
type HealthReport = { jobId: string; status: TranscriptionStatus; since?: string; value: WorkerHealth }

function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const durationSeconds = audio.duration
      resolve(Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      // Alguns M4A válidos não são decodificáveis pelo navegador, mas o worker
      // usa FFmpeg para validar o arquivo enviado. Não bloquear a gravação por
      // uma limitação de metadados do cliente.
      resolve(null)
    }
    audio.src = url
  })
}


type AudioState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'gone' }
  | { status: 'error' }

export function AtaTranscriptionPanel({ ataId, onGenerateMinuta }: AtaTranscriptionPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const convocacaoRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [job, setJob] = useState<AtaTranscriptionJob | null>(null)
  const [transcription, setTranscription] = useState<AtaTranscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [replacement, setReplacement] = useState<{ file: File; durationSeconds: number | null } | null>(null)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [audio, setAudio] = useState<AudioState>({ status: 'loading' })
  const [convocacao, setConvocacao] = useState<ConvocacaoContext | null>(null)
  const [isReadingConvocacao, setIsReadingConvocacao] = useState(false)
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null)
  const isJobActive = Boolean(job && activeStatuses.has(job.status))
  const transcriptionId = transcription?.id
  const isReviewed = Boolean(transcription?.isReviewed)

  const refresh = useCallback(async () => {
    try {
      const data = await ataTranscriptionsRepoSupabase.load(ataId)
      setJob(data.job)
      setTranscription(data.transcription)
      setDraftText(data.transcription?.revisedText ?? data.transcription?.rawText ?? '')
      setError(null)
    } catch {
      setError('Não foi possível carregar a transcrição desta ata.')
    } finally {
      setIsLoading(false)
    }
  }, [ataId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!isJobActive) return
    const interval = window.setInterval(() => void refresh(), 7_500)
    return () => window.clearInterval(interval)
  }, [isJobActive, refresh])

  // Sem isto, um worker fora do ar deixa a tela em "Na fila" para sempre, sem
  // erro nenhum — foi assim que o trial expirado do Railway passou despercebido.
  // E um container encerrado no meio do job deixava "Preparando o áudio" parado
  // para sempre: foi assim que a Evidence ficou travada em 23/09/2026. Nos dois
  // casos o painel insiste no wake; um worker novo retoma o job sozinho.
  const watchedJobId = job && (job.status === 'queued' || job.status === 'processing') ? job.id : null
  const watchedStatus = job?.status
  // Na fila, conta desde a criação; processando, desde o último sinal de vida.
  const watchedSince = job?.status === 'processing' ? (job.heartbeatAt ?? job.createdAt) : job?.createdAt
  useEffect(() => {
    if (!watchedJobId || !watchedSince) return
    let cancelled = false
    const check = async () => {
      const silentFor = Date.now() - Date.parse(watchedSince)
      const due = watchedStatus === 'processing' ? silentFor >= STALE_HEARTBEAT_MS : silentFor >= WAKE_GRACE_MS
      if (!due) return
      const { workerAvailable, stalled } = await ataTranscriptionsRepoSupabase.wake(watchedJobId)
      if (cancelled) return
      setHealthReport({
        jobId: watchedJobId,
        status: watchedStatus!,
        since: watchedSince,
        value: !workerAvailable ? 'unavailable' : stalled ? 'stalled' : 'ok',
      })
    }
    void check()
    const interval = window.setInterval(() => void check(), WAKE_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [watchedJobId, watchedStatus, watchedSince])

  const workerHealth: WorkerHealth =
    !healthReport || healthReport.jobId !== job?.id || healthReport.status !== job?.status ? 'ok'
      : healthReport.value === 'stalled' && healthReport.since !== watchedSince ? 'ok'
        : healthReport.value

  // A URL assinada é buscada uma vez por transcrição, e não a cada refresh: o
  // painel repete o load a cada 7,5 s enquanto há trabalho ativo.
  useEffect(() => {
    const jobId = job?.id
    if (!jobId || !transcriptionId || isJobActive) {
      setAudio({ status: 'loading' })
      return
    }
    let cancelled = false
    setAudio({ status: 'loading' })
    ataTranscriptionsRepoSupabase.audioUrl(jobId)
      .then((url) => {
        if (cancelled) return
        setAudio(url ? { status: 'ready', url } : { status: 'gone' })
      })
      .catch(() => {
        if (!cancelled) setAudio({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [job?.id, transcriptionId, isJobActive])

  const uploadFile = async (file: File, durationSeconds: number | null) => {
    try {
      setIsUploading(true)
      setJob({
        id: 'uploading',
        ataId,
        status: 'uploading',
        originalFilename: file.name,
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        processedChunks: 0,
      })
      const { jobId, workerAvailable } = await ataTranscriptionsRepoSupabase.upload(ataId, file, durationSeconds, convocacao?.text)
      await refresh()
      setHealthReport({ jobId, status: 'queued', value: workerAvailable ? 'ok' : 'unavailable' })
    } catch (uploadError) {
      // refresh() zera o erro ao carregar com sucesso, então a mensagem precisa
      // ser definida depois dele — caso contrário a falha some da tela.
      const message = uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar a gravação.'
      await refresh()
      setError(message)
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleConvocacaoSelection = async (file: File) => {
    setError(null)
    setIsReadingConvocacao(true)
    try {
      setConvocacao(await readConvocacao(file))
    } catch (readError) {
      setConvocacao(null)
      setError(readError instanceof Error ? readError.message : 'Não foi possível ler esta convocação.')
    } finally {
      setIsReadingConvocacao(false)
      if (convocacaoRef.current) convocacaoRef.current.value = ''
    }
  }

  const handleFileSelection = async (file: File) => {
    setError(null)
    try {
      const durationSeconds = await readAudioDuration(file)
      const validationError = getAudioValidationError({ name: file.name, type: file.type, durationSeconds })
      if (validationError) {
        setError(validationError)
        return
      }

      if (job) {
        setReplacement({ file, durationSeconds })
        return
      }
      await uploadFile(file, durationSeconds)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível preparar a gravação.')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRetry = async () => {
    if (!job) return
    setError(null)
    try {
      const { workerAvailable } = await ataTranscriptionsRepoSupabase.retry(job.id)
      await refresh()
      setHealthReport({ jobId: job.id, status: 'queued', value: workerAvailable ? 'ok' : 'unavailable' })
    } catch {
      setError('Não foi possível reenfileirar a transcrição.')
    }
  }

  const handleSaveReview = async (isReviewed: boolean) => {
    if (!transcription) return
    setIsSaving(true)
    setError(null)
    try {
      await ataTranscriptionsRepoSupabase.saveReview(transcription.id, draftText, isReviewed)
      await refresh()
    } catch {
      setError('Não foi possível salvar a revisão.')
    } finally {
      setIsSaving(false)
    }
  }

  const downloadTranscription = () => {
    if (!job) return
    // O nome do arquivo enviado é a única referência que quem revisa reconhece
    // depois, fora desta tela: preservá-lo evita uma pasta de "transcricao.txt".
    const base = job.originalFilename.replace(/\.[^.]+$/, '') || 'transcricao'
    const blob = new Blob([draftText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${base}-transcricao.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleDiscard = async () => {
    if (!job) return
    setIsDiscarding(true)
    setError(null)
    try {
      await ataTranscriptionsRepoSupabase.discard(job.id)
      await refresh()
    } catch (discardError) {
      const message = discardError instanceof Error ? discardError.message : 'Não foi possível descartar a transcrição.'
      await refresh()
      setError(message)
    } finally {
      setIsDiscarding(false)
    }
  }

  if (isLoading) return <p className="py-10 text-sm text-muted-foreground">Carregando transcrição…</p>

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 via-background to-background dark:from-violet-950/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileAudio className="h-5 w-5 text-violet-600" />
                Áudio da assembleia
              </CardTitle>
              <CardDescription>Envie a gravação para criar uma transcrição revisável, com marcação de horário em cada trecho.</CardDescription>
            </div>
            {job && <AtaTranscriptionStatus status={job.status} isReviewed={isReviewed} />}
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

          <Input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a,audio/aac,audio/wav,video/mp4,audio/webm,video/webm,audio/ogg,.mp3,.m4a,.wav,.mp4,.webm,.aac,.ogg,.oga,.opus"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFileSelection(file)
            }}
          />

          <Input
            ref={convocacaoRef}
            className="hidden"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleConvocacaoSelection(file)
            }}
          />

          {!job && (
            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-6 text-center dark:border-violet-900 dark:bg-violet-950/10">
              <FilePlus2 className="mx-auto mb-3 h-7 w-7 text-violet-600" />
              <p className="font-medium">Envie uma gravação de até 6 horas</p>
              <p className="mt-1 text-sm text-muted-foreground">MP3, M4A, AAC, WAV, MP4, WebM ou OGG. O envio começa assim que você escolher o arquivo, e o processamento continua mesmo se você sair desta tela.</p>
              <Button className="mt-4" onClick={() => inputRef.current?.click()} disabled={isUploading || isReadingConvocacao}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                {isUploading ? 'Enviando…' : 'Selecionar gravação'}
              </Button>

              <div className="mt-6 border-t border-dashed border-violet-200 pt-4 text-left dark:border-violet-900">
                {convocacao ? (
                  <div className="rounded-lg border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">Convocação lida</p>
                          <ul className="text-muted-foreground">
                            {convocacao.condominio && <li>Condomínio: {convocacao.condominio}</li>}
                            {convocacao.sindico && <li>Síndico: {convocacao.sindico}</li>}
                            {convocacao.data && <li>Data: {convocacao.data}</li>}
                            <li>
                              {convocacao.pautaItems.length > 0
                                ? `${convocacao.pautaItems.length} ${convocacao.pautaItems.length === 1 ? 'item de pauta' : 'itens de pauta'}`
                                : 'Pauta não identificada — o texto da convocação será usado assim mesmo'}
                            </li>
                          </ul>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Remover convocação" onClick={() => setConvocacao(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      Tem a convocação em PDF? Ela ancora o nome do condomínio, do síndico e a pauta na transcrição.
                    </span>
                    <Button variant="outline" size="sm" disabled={isReadingConvocacao || isUploading} onClick={() => convocacaoRef.current?.click()}>
                      <FileText className="mr-2 h-4 w-4" />
                      {isReadingConvocacao ? 'Lendo…' : 'Anexar convocação (opcional)'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {job && isJobActive && (
            <div className="space-y-3 rounded-lg border bg-muted/25 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{job.originalFilename}</span>
                <span className="shrink-0 text-muted-foreground">Execução em background</span>
              </div>
              {(() => {
                const { percent, label } = getTranscriptionProgress(job)
                return (
                  <>
                    <Progress value={percent} />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">{percent}%</span>
                    </div>
                  </>
                )
              })()}
              {workerHealth === 'stalled' && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100 [&>svg]:text-amber-600">
                  <RefreshCcw className="h-4 w-4" />
                  <AlertTitle>O processamento foi interrompido</AlertTitle>
                  <AlertDescription>
                    A transcrição está sendo retomada automaticamente. A gravação está guardada — não é preciso enviar de novo.
                  </AlertDescription>
                </Alert>
              )}
              {workerHealth === 'unavailable' && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100 [&>svg]:text-amber-600">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>O serviço de transcrição está fora do ar</AlertTitle>
                  <AlertDescription>
                    A gravação foi recebida e está guardada. A transcrição começa sozinha quando o serviço voltar — não é preciso enviar de novo. Avise o administrador do Omnia.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {job?.status === 'failed' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
              <div>
                <p className="font-medium text-rose-900 dark:text-rose-100">A transcrição falhou</p>
                <p className="text-sm text-rose-700 dark:text-rose-300">{job.errorMessage ?? 'Tente novamente. O áudio será reutilizado com segurança.'}</p>
              </div>
              <Button variant="outline" onClick={() => void handleRetry()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          )}

          {job && !isJobActive && (
            <Button variant="outline" disabled={isUploading} onClick={() => inputRef.current?.click()}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              Enviar nova gravação
            </Button>
          )}
        </CardContent>
      </Card>

      {transcription && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{isReviewed ? 'Transcrição revisada' : 'Transcrição para revisão'}</CardTitle>
                </div>
                <CardDescription>
                  {isReviewed
                    ? 'O texto está fechado. Reabra para editar, ou baixe o .txt para usar fora daqui.'
                    : 'Edite o texto antes de usar o conteúdo na futura geração da minuta.'}
                </CardDescription>
              </div>
              {onGenerateMinuta && (
                <Button variant="outline" onClick={onGenerateMinuta}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar minuta de ATA
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <AtaTranscriptionEditor
              value={draftText}
              onChange={setDraftText}
              disabled={isSaving || isDiscarding || isReviewed}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={isSaving || isDiscarding}
                onClick={() => setShowDiscardDialog(true)}
              >
                {isDiscarding ? 'Descartando…' : 'Descartar transcrição'}
              </Button>
              {isReviewed ? (
                <>
                  <Button variant="outline" disabled={isSaving || isDiscarding} onClick={() => void handleSaveReview(false)}>
                    {isSaving ? 'Reabrindo…' : 'Reabrir para edição'}
                  </Button>
                  <Button disabled={!draftText.trim()} onClick={downloadTranscription}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar .txt
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" disabled={isSaving || isDiscarding || !draftText.trim()} onClick={downloadTranscription}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar .txt
                  </Button>
                  <Button variant="outline" disabled={isSaving || isDiscarding} onClick={() => void handleSaveReview(false)}>Salvar rascunho</Button>
                  <Button disabled={isSaving || isDiscarding} onClick={() => void handleSaveReview(true)}>
                    {isSaving ? 'Salvando…' : 'Marcar como revisada'}
                  </Button>
                </>
              )}
            </div>

            {audio.status === 'ready' && (
              <div className="space-y-2 border-t pt-5">
                <div>
                  <h3 className="font-medium">Gravação original</h3>
                  <p className="text-sm text-muted-foreground">Disponível para conferir uma passagem duvidosa enquanto você corrige o texto.</p>
                </div>
                <audio
                  ref={audioRef}
                  src={audio.url}
                  controls
                  preload="metadata"
                  className="w-full rounded-lg"
                  onError={() => setAudio({ status: 'error' })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar esta transcrição?</AlertDialogTitle>
            <AlertDialogDescription>
              A ata volta a pedir uma gravação e a revisão feita neste texto deixa de valer. O áudio é apagado em definitivo; o texto continua no histórico, mas não será usado na futura geração da minuta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter transcrição</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDiscard()}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(replacement)} onOpenChange={(open) => {
        if (!open) {
          setReplacement(null)
          if (inputRef.current) inputRef.current.value = ''
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir a transcrição atual?</AlertDialogTitle>
            <AlertDialogDescription>
              A nova gravação se tornará a transcrição atual desta ata. A transcrição anterior continuará no histórico, mas não será usada na futura geração da minuta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const selectedFile = replacement
                setReplacement(null)
                if (selectedFile) void uploadFile(selectedFile.file, selectedFile.durationSeconds)
              }}
            >
              Substituir e enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
