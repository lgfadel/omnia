"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { AtaTranscriptionStatus } from './AtaTranscriptionStatus'
import { getAudioValidationError, type AtaTranscriptionStatus as TranscriptionStatus } from '@/lib/ataTranscription'
import { ataTranscriptionsRepoSupabase } from '@/repositories/ataTranscriptionsRepo.supabase'
import type { AtaTranscription, AtaTranscriptionJob } from '@/data/types'
import { FileAudio, FilePlus2, RefreshCcw, Sparkles, TriangleAlert } from 'lucide-react'

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

export function AtaTranscriptionPanel({ ataId }: AtaTranscriptionPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [job, setJob] = useState<AtaTranscriptionJob | null>(null)
  const [transcription, setTranscription] = useState<AtaTranscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [showMinutaNotice, setShowMinutaNotice] = useState(false)
  const [replacement, setReplacement] = useState<{ file: File; durationSeconds: number } | null>(null)
  const isJobActive = Boolean(job && activeStatuses.has(job.status))

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
      })
      await ataTranscriptionsRepoSupabase.upload(ataId, file, durationSeconds)
      await refresh()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar a gravação.')
      await refresh()
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
              <CardDescription>Envie a gravação para criar uma transcrição revisável, com timestamps e locutores.</CardDescription>
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
            accept="audio/mpeg,audio/mp4,audio/wav,video/mp4,audio/webm,video/webm,.mp3,.m4a,.wav,.mp4,.webm"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFileSelection(file)
            }}
          />

          {!job && (
            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-6 text-center dark:border-violet-900 dark:bg-violet-950/10">
              <FilePlus2 className="mx-auto mb-3 h-7 w-7 text-violet-600" />
              <p className="font-medium">Envie uma gravação de até 6 horas</p>
              <p className="mt-1 text-sm text-muted-foreground">MP3, M4A, WAV, MP4 ou WebM. O processamento continua mesmo se você sair desta tela.</p>
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
              <Progress value={job.status === 'uploading' ? 25 : job.status === 'queued' ? 45 : 70} />
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

            <Textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} className="min-h-72 font-mono text-sm leading-6" />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={isSaving} onClick={() => void handleSaveReview(false)}>Salvar rascunho</Button>
              <Button disabled={isSaving} onClick={() => void handleSaveReview(true)}>{isSaving ? 'Salvando…' : 'Marcar como revisada'}</Button>
            </div>

            <div className="space-y-3 border-t pt-5">
              <div>
                <h3 className="font-medium">Falantes e trechos</h3>
                <p className="text-sm text-muted-foreground">Os rótulos são editáveis. Em áudios divididos, revise a correspondência entre trechos.</p>
              </div>
              <div className="max-h-[32rem] space-y-2 overflow-auto pr-1" style={{ contentVisibility: 'auto' }}>
                {transcription.segments.map((segment) => (
                  <div key={segment.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[7rem_13rem_1fr] md:items-start">
                    <span className="pt-2 font-mono text-xs text-muted-foreground">{formatTimestamp(segment.startMs)}–{formatTimestamp(segment.endMs)}</span>
                    <Input
                      defaultValue={segment.speakerName ?? segment.speakerLabel}
                      aria-label={`Nome do ${segment.speakerLabel}`}
                      onBlur={(event) => {
                        void ataTranscriptionsRepoSupabase.renameSpeaker(segment.id, event.target.value)
                          .catch(() => setError('Não foi possível salvar o nome do falante.'))
                      }}
                    />
                    <p className="pt-2 text-sm leading-6">{segment.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
