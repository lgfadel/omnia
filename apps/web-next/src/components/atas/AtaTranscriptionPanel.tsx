"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { AtaTranscriptionReview, type TranscriptionAudioState } from './AtaTranscriptionReview'
import { AtaTranscriptionUpload } from './AtaTranscriptionUpload'
import { AtaTranscriptionStatus } from './AtaTranscriptionStatus'
import { getTranscriptionProgress, getAudioValidationError, type AtaTranscriptionStatus as TranscriptionStatus } from '@/lib/ataTranscription'
import { readConvocacao, type ConvocacaoContext } from '@/lib/convocacao'
import { ataTranscriptionsRepoSupabase } from '@/repositories/ataTranscriptionsRepo.supabase'
import type { AtaTranscription, AtaTranscriptionJob } from '@/data/types'
import { Check, FileAudio, FilePlus2, RefreshCcw, TriangleAlert } from 'lucide-react'

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
    let settled = false
    const finish = (durationSeconds: number | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(durationSeconds)
    }
    // A duração desconhecida já é validada pelo FFmpeg no worker. Não deixar a
    // seleção bloqueada quando o navegador não emite nem metadados nem erro.
    const timeout = window.setTimeout(() => finish(null), 10_000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const durationSeconds = audio.duration
      finish(Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null)
    }
    audio.onerror = () => {
      // Alguns M4A válidos não são decodificáveis pelo navegador, mas o worker
      // usa FFmpeg para validar o arquivo enviado. Não bloquear a gravação por
      // uma limitação de metadados do cliente.
      finish(null)
    }
    audio.src = url
  })
}


export function AtaTranscriptionPanel({ ataId, onGenerateMinuta }: AtaTranscriptionPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const recordingSelectionLock = useRef(false)
  const loadRequest = useRef(0)
  const [job, setJob] = useState<AtaTranscriptionJob | null>(null)
  const [transcription, setTranscription] = useState<AtaTranscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isPreparingRecording, setIsPreparingRecording] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [replacement, setReplacement] = useState<{ file: File; durationSeconds: number | null } | null>(null)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [audio, setAudio] = useState<TranscriptionAudioState>({ status: 'loading' })
  const [audioRetry, setAudioRetry] = useState(0)
  const [convocacao, setConvocacao] = useState<ConvocacaoContext | null>(null)
  const [isReadingConvocacao, setIsReadingConvocacao] = useState(false)
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null)
  const isJobActive = Boolean(job && activeStatuses.has(job.status))
  const transcriptionId = transcription?.id
  const isReviewed = Boolean(transcription?.isReviewed)
  const isBusy = isUploading || isPreparingRecording || isSaving || isDiscarding || isRetrying || isReadingConvocacao
  const hasUnsavedChanges = draftText !== (transcription?.revisedText ?? transcription?.rawText ?? '')

  const refresh = useCallback(async () => {
    const request = ++loadRequest.current
    try {
      const data = await ataTranscriptionsRepoSupabase.load(ataId)
      if (request !== loadRequest.current) return
      setJob(data.job)
      setTranscription(data.transcription)
      setDraftText(data.transcription?.revisedText ?? data.transcription?.rawText ?? '')
      setHasLoaded(true)
      setError(null)
    } catch {
      if (request === loadRequest.current) setError('Não foi possível carregar a transcrição desta ata.')
    } finally {
      if (request === loadRequest.current) setIsLoading(false)
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
  }, [job?.id, transcriptionId, isJobActive, audioRetry])

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
    if (isBusy || recordingSelectionLock.current) return
    setError(null)
    setIsReadingConvocacao(true)
    try {
      setConvocacao(await readConvocacao(file))
    } catch (readError) {
      setConvocacao(null)
      setError(readError instanceof Error ? readError.message : 'Não foi possível ler esta convocação.')
    } finally {
      setIsReadingConvocacao(false)
    }
  }

  const handleFileSelection = async (file: File) => {
    if (isBusy || isJobActive || recordingSelectionLock.current) return
    recordingSelectionLock.current = true
    setIsPreparingRecording(true)
    setError(null)
    try {
      const formatError = getAudioValidationError({ name: file.name, type: file.type, durationSeconds: null })
      if (formatError) {
        setError(formatError)
        return
      }
      if (file.size === 0 || file.size > 1024 * 1024 * 1024) {
        setError(file.size === 0 ? 'A gravação está vazia. Escolha outro arquivo.' : 'A gravação ultrapassa o limite de 1 GB.')
        return
      }
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
    } finally {
      recordingSelectionLock.current = false
      setIsPreparingRecording(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRetry = async () => {
    if (!job || isBusy) return
    setIsRetrying(true)
    setError(null)
    try {
      const { workerAvailable } = await ataTranscriptionsRepoSupabase.retry(job.id)
      await refresh()
      setHealthReport({ jobId: job.id, status: 'queued', value: workerAvailable ? 'ok' : 'unavailable' })
    } catch {
      setError('Não foi possível reenfileirar a transcrição.')
    } finally {
      setIsRetrying(false)
    }
  }

  const handleSaveReview = async (isReviewed: boolean) => {
    if (!transcription || isBusy || isJobActive || !draftText.trim()) return false
    setIsSaving(true)
    setError(null)
    try {
      await ataTranscriptionsRepoSupabase.saveReview(transcription.id, draftText, isReviewed)
      // O repositório só resolve depois de confirmar a linha salva. Atualizar o
      // estado evita um load extra que poderia repor texto antigo após a edição.
      setTranscription({ ...transcription, revisedText: draftText, isReviewed })
      return true
    } catch {
      setError('Não foi possível salvar a revisão.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrepareMinuta = async () => {
    if (!onGenerateMinuta || isBusy || !draftText.trim()) return
    if (hasUnsavedChanges && !await handleSaveReview(false)) return
    onGenerateMinuta()
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
    if (!job || isBusy || isJobActive) return
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

  if (isLoading) return <p role="status" className="py-10 text-sm text-muted-foreground">Carregando transcrição…</p>

  const stageIndex = !job || job.status === 'uploading' ? 0 : job.status === 'completed' ? 2 : 1
  const progress = job ? getTranscriptionProgress(job) : null
  const canReview = Boolean(job?.status === 'completed' && transcription && transcription.jobId === job.id)

  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">Transcrição da assembleia</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">Da gravação ao texto revisado, pronto para preparar a minuta.</p>
          </div>
          {job && <AtaTranscriptionStatus status={job.status} isReviewed={isReviewed} />}
        </div>
        <ol aria-label="Etapas da transcrição" className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/15 p-3 sm:gap-5 sm:p-4">
          {['Gravação', 'Transcrição', 'Revisão'].map((label, index) => {
            const complete = index < stageIndex || (index === 2 && job?.status === 'completed' && isReviewed)
            const current = index === stageIndex && !complete
            return (
              <li key={label} aria-current={current ? 'step' : undefined} className={`flex min-w-0 flex-col items-start gap-2 text-xs sm:flex-row sm:items-center sm:text-sm ${complete || current ? 'text-foreground' : 'text-muted-foreground'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${current ? 'border-foreground bg-foreground text-background' : complete ? 'border-border bg-background' : 'border-border'}`}>
                  {complete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span className={current ? 'font-medium' : ''}>{label}</span>
              </li>
            )
          })}
        </ol>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Não foi possível continuar</AlertTitle>
          <AlertDescription>
            {error}
            {!hasLoaded && <Button variant="outline" size="sm" className="mt-3 block" onClick={() => void refresh()}>Carregar novamente</Button>}
          </AlertDescription>
        </Alert>
      )}

      {job && <Input
        ref={inputRef}
        className="hidden"
        type="file"
        aria-label="Selecionar arquivo de gravação"
        disabled={isBusy || isJobActive}
        accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a,audio/aac,audio/wav,video/mp4,audio/webm,video/webm,audio/ogg,.mp3,.m4a,.wav,.mp4,.webm,.aac,.ogg,.oga,.opus"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFileSelection(file)
        }}
      />}

      {hasLoaded && !job && <AtaTranscriptionUpload
        convocacao={convocacao}
        isReadingConvocacao={isReadingConvocacao}
        disabled={isBusy}
        isPreparingRecording={isPreparingRecording}
        onRecordingSelect={(file) => void handleFileSelection(file)}
        onConvocacaoSelect={(file) => void handleConvocacaoSelection(file)}
        onRemoveConvocacao={() => setConvocacao(null)}
      />}

      {job && isJobActive && progress && (
        <Card className="space-y-6 p-5 shadow-none sm:p-7">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/25">
              <FileAudio className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <h3 className="break-words text-base font-medium">{job.originalFilename}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">O processamento continua em segundo plano. Você pode sair desta tela e voltar depois.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">{progress.label}</span>
              <span className="tabular-nums text-muted-foreground">{progress.percent}%</span>
            </div>
            <Progress value={progress.percent} aria-label="Progresso da transcrição" className="h-2" />
          </div>
          {workerHealth === 'stalled' && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100 [&>svg]:text-amber-600">
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>O processamento foi interrompido</AlertTitle>
              <AlertDescription>A transcrição está sendo retomada automaticamente. A gravação está guardada — não é preciso enviar de novo.</AlertDescription>
            </Alert>
          )}
          {workerHealth === 'unavailable' && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100 [&>svg]:text-amber-600">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>O serviço de transcrição está fora do ar</AlertTitle>
              <AlertDescription>A gravação foi recebida e está guardada. A transcrição começa sozinha quando o serviço voltar — não é preciso enviar de novo. Avise o administrador do Omnia.</AlertDescription>
            </Alert>
          )}
        </Card>
      )}

      {job?.status === 'failed' && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>A transcrição falhou</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="break-words">{job.errorMessage ?? 'Tente novamente. O áudio será reutilizado com segurança.'}</p>
            <Button variant="outline" disabled={isBusy} onClick={() => void handleRetry()}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {isRetrying ? 'Reenfileirando…' : 'Tentar novamente'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {job && !isJobActive && !canReview && <Button variant="outline" disabled={isBusy} onClick={() => inputRef.current?.click()}>
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        {isPreparingRecording ? 'Preparando gravação…' : 'Enviar nova gravação'}
      </Button>}

      {canReview && job && transcription && <AtaTranscriptionReview
        job={job}
        transcription={transcription}
        value={draftText}
        audio={audio}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        isDiscarding={isDiscarding}
        isPreparingRecording={isPreparingRecording}
        onChange={setDraftText}
        onSave={(reviewed) => void handleSaveReview(reviewed)}
        onPrepareMinuta={onGenerateMinuta ? () => void handlePrepareMinuta() : undefined}
        onDownload={downloadTranscription}
        onRetryAudio={() => setAudioRetry((attempt) => attempt + 1)}
        onAudioError={() => setAudio({ status: 'error' })}
        onReplace={() => inputRef.current?.click()}
        onDiscard={() => setShowDiscardDialog(true)}
      />}

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
