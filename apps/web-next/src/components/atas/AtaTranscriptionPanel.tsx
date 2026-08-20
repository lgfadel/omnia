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
import { ataTranscriptionsRepoSupabase } from '@/repositories/ataTranscriptionsRepo.supabase'
import type { AtaTranscription, AtaTranscriptionJob, AtaTranscriptionSegment } from '@/data/types'
import { Download, FileAudio, FilePlus2, RefreshCcw, Sparkles, TriangleAlert } from 'lucide-react'

interface AtaTranscriptionPanelProps {
  ataId: string
}

const activeStatuses = new Set<TranscriptionStatus>(['uploading', 'queued', 'processing'])

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a duração desta gravação.'))
    }
    audio.src = url
  })
}

function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

type AudioState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'gone' }
  | { status: 'error' }

// A lista de uma assembleia de uma hora passa de 2000 trechos: varrer tudo a cada
// evento de tempo do áudio (4x por segundo) travaria a rolagem da revisão.
function findSegmentAt(segments: AtaTranscriptionSegment[], timeMs: number): AtaTranscriptionSegment | null {
  let low = 0
  let high = segments.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const segment = segments[middle]
    if (timeMs < segment.startMs) high = middle - 1
    else if (timeMs >= segment.endMs) low = middle + 1
    else return segment
  }
  return null
}

export function AtaTranscriptionPanel({ ataId }: AtaTranscriptionPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [job, setJob] = useState<AtaTranscriptionJob | null>(null)
  const [transcription, setTranscription] = useState<AtaTranscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [showMinutaNotice, setShowMinutaNotice] = useState(false)
  const [replacement, setReplacement] = useState<{ file: File; durationSeconds: number } | null>(null)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [audio, setAudio] = useState<AudioState>({ status: 'loading' })
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const isJobActive = Boolean(job && activeStatuses.has(job.status))
  const transcriptionId = transcription?.id

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

  const handleTimeUpdate = () => {
    const player = audioRef.current
    if (!player || !transcription) return
    const current = findSegmentAt(transcription.segments, player.currentTime * 1000)
    setActiveSegmentId((previous) => (previous === (current?.id ?? null) ? previous : current?.id ?? null))
  }

  const playFrom = (startMs: number) => {
    const player = audioRef.current
    if (!player) return
    player.currentTime = startMs / 1000
    // play() rejeita quando o navegador bloqueia a reprodução; aqui sempre parte
    // de um clique, e não há o que fazer além de deixar o usuário apertar play.
    void player.play().catch(() => undefined)
  }

  const uploadFile = async (file: File, durationSeconds: number) => {
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
      await ataTranscriptionsRepoSupabase.upload(ataId, file, durationSeconds)
      await refresh()
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
      await ataTranscriptionsRepoSupabase.retry(job.id)
      await refresh()
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
            {job && <AtaTranscriptionStatus status={job.status} />}
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

          {!job && (
            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-6 text-center dark:border-violet-900 dark:bg-violet-950/10">
              <FilePlus2 className="mx-auto mb-3 h-7 w-7 text-violet-600" />
              <p className="font-medium">Envie uma gravação de até 6 horas</p>
              <p className="mt-1 text-sm text-muted-foreground">MP3, M4A, AAC, WAV, MP4, WebM ou OGG. O envio começa assim que você escolher o arquivo, e o processamento continua mesmo se você sair desta tela.</p>
              <Button className="mt-4" onClick={() => inputRef.current?.click()} disabled={isUploading}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                {isUploading ? 'Enviando…' : 'Selecionar gravação'}
              </Button>
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
              <div>
                <CardTitle className="text-lg">Transcrição para revisão</CardTitle>
                <CardDescription>Edite o texto antes de usar o conteúdo na futura geração da minuta.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setShowMinutaNotice(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar minuta de ATA
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {showMinutaNotice && (
              <Alert>
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>{transcription.isReviewed ? 'Geração da minuta em breve' : 'Transcrição ainda não revisada'}</AlertTitle>
                <AlertDescription>
                  {transcription.isReviewed
                    ? 'A fase de geração usará apenas esta transcrição salva e revisada.'
                    : 'A futura minuta poderá ser gerada, mas deverá destacar que o conteúdo pode conter imprecisões.'}
                </AlertDescription>
              </Alert>
            )}

            <AtaTranscriptionEditor value={draftText} onChange={setDraftText} disabled={isSaving || isDiscarding} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={isSaving || isDiscarding}
                onClick={() => setShowDiscardDialog(true)}
              >
                {isDiscarding ? 'Descartando…' : 'Descartar transcrição'}
              </Button>
              <Button variant="ghost" disabled={isSaving || isDiscarding || !draftText.trim()} onClick={downloadTranscription}>
                <Download className="mr-2 h-4 w-4" />
                Baixar .txt
              </Button>
              <Button variant="outline" disabled={isSaving || isDiscarding} onClick={() => void handleSaveReview(false)}>Salvar rascunho</Button>
              <Button disabled={isSaving || isDiscarding} onClick={() => void handleSaveReview(true)}>{isSaving ? 'Salvando…' : 'Marcar como revisada'}</Button>
            </div>

            <div className="space-y-3 border-t pt-5">
              <div>
                <h3 className="font-medium">Trechos com horário</h3>
                <p className="text-sm text-muted-foreground">
                  {audio.status === 'ready'
                    ? 'Clique em um trecho para ouvir aquele momento da gravação enquanto corrige o texto.'
                    : audio.status === 'error'
                      ? 'Não foi possível carregar a gravação agora. Os trechos continuam servindo de referência de horário.'
                      : audio.status === 'gone'
                        ? 'A gravação desta ata não está mais disponível. Os trechos continuam servindo de referência de horário.'
                        : 'Carregando a gravação…'}
                </p>
              </div>

              {audio.status === 'ready' && (
                <audio
                  ref={audioRef}
                  src={audio.url}
                  controls
                  preload="metadata"
                  className="w-full rounded-lg"
                  onTimeUpdate={handleTimeUpdate}
                  onError={() => setAudio({ status: 'error' })}
                />
              )}

              <div className="max-h-[32rem] space-y-2 overflow-auto pr-1" style={{ contentVisibility: 'auto' }}>
                {transcription.segments.map((segment) => {
                  const isActive = segment.id === activeSegmentId
                  const timestamp = `${formatTimestamp(segment.startMs)}–${formatTimestamp(segment.endMs)}`
                  const rowClass = `grid w-full gap-2 rounded-lg border p-3 text-left transition-colors md:grid-cols-[7rem_1fr] md:items-start ${
                    isActive
                      ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30'
                      : 'border-border'
                  }`
                  const body = (
                    <>
                      <span className={`pt-1 font-mono text-xs ${isActive ? 'text-violet-700 dark:text-violet-300' : 'text-muted-foreground'}`}>
                        {timestamp}
                      </span>
                      <p className="text-sm leading-6">{segment.text}</p>
                    </>
                  )

                  return audio.status === 'ready' ? (
                    <button
                      key={segment.id}
                      type="button"
                      className={`${rowClass} hover:border-violet-200 hover:bg-muted/60 dark:hover:border-violet-900`}
                      aria-current={isActive || undefined}
                      aria-label={`Ouvir o trecho de ${timestamp}`}
                      onClick={() => playFrom(segment.startMs)}
                    >
                      {body}
                    </button>
                  ) : (
                    <div key={segment.id} className={rowClass}>{body}</div>
                  )
                })}
              </div>
            </div>
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
