"use client"

import { useId, useRef, useState, type DragEvent } from 'react'
import { FileAudio, FileText, LoaderCircle, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ConvocacaoContext } from '@/lib/convocacao'
import { cn } from '@/lib/utils'

interface AtaTranscriptionUploadProps {
  convocacao: ConvocacaoContext | null
  isReadingConvocacao: boolean
  disabled?: boolean
  isPreparingRecording?: boolean
  onRecordingSelect: (file: File) => void
  onConvocacaoSelect: (file: File) => void
  onRemoveConvocacao: () => void
}

const RECORDING_ACCEPT = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a,audio/aac,audio/wav,video/mp4,audio/webm,video/webm,audio/ogg,.mp3,.m4a,.aac,.wav,.mp4,.webm,.ogg,.oga,.opus'

export function AtaTranscriptionUpload({
  convocacao,
  isReadingConvocacao,
  disabled = false,
  isPreparingRecording = false,
  onRecordingSelect,
  onConvocacaoSelect,
  onRemoveConvocacao,
}: AtaTranscriptionUploadProps) {
  const recordingRef = useRef<HTMLInputElement>(null)
  const convocacaoRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [convocacaoError, setConvocacaoError] = useState<string | null>(null)
  const id = useId()
  const isBlocked = disabled || isReadingConvocacao || isPreparingRecording
  const showDragPrompt = isDragging && !isBlocked

  const selectRecording = (files: FileList | readonly File[]) => {
    if (isBlocked || files.length === 0) return
    if (files.length > 1) {
      setRecordingError('Envie uma gravação por vez.')
      return
    }
    setRecordingError(null)
    onRecordingSelect(files[0])
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (isBlocked || !Array.from(event.dataTransfer.types).includes('Files')) return
    dragDepth.current += 1
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setIsDragging(false)
    if (isBlocked) return
    selectRecording(event.dataTransfer.files)
  }

  return (
    <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8">
      <input
        ref={recordingRef}
        type="file"
        className="hidden"
        aria-label="Selecionar arquivo de gravação"
        accept={RECORDING_ACCEPT}
        disabled={isBlocked}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          if (isBlocked) return
          selectRecording(files)
        }}
      />
      <input
        ref={convocacaoRef}
        type="file"
        className="hidden"
        aria-label="Selecionar convocação em PDF"
        accept="application/pdf,.pdf"
        disabled={isBlocked}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          if (isBlocked || files.length === 0) return
          if (files.length > 1) {
            setConvocacaoError('Anexe uma convocação por vez.')
            return
          }
          setConvocacaoError(null)
          onConvocacaoSelect(files[0])
        }}
      />

      <div
        className="min-w-0 space-y-4"
        onDragEnter={handleDragEnter}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = isBlocked ? 'none' : 'copy'
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-2">
          <h3 className="text-base font-semibold tracking-tight">Envie uma gravação de até 6 horas</h3>
          <p id={`${id}-formats`} className="text-sm leading-relaxed text-muted-foreground">
            MP3, M4A, AAC, WAV, MP4, WebM, OGG, OGA ou OPUS.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          aria-label="Selecionar gravação"
          aria-describedby={`${id}-formats ${id}-limits ${id}-flow${recordingError ? ` ${id}-recording-error` : ''}`}
          disabled={isBlocked}
          onClick={() => {
            if (isBlocked) return
            recordingRef.current?.click()
          }}
          className={cn(
            'h-auto min-h-56 w-full flex-col gap-5 whitespace-normal rounded-xl border-dashed bg-muted/15 px-5 py-7 text-center hover:border-primary/50 hover:bg-primary/5 motion-reduce:transition-none sm:px-8',
            showDragPrompt && 'border-primary bg-primary/5 ring-2 ring-primary/15',
          )}
        >
          <FileAudio className="!h-7 !w-7 text-primary/75" aria-hidden="true" />
          <span className="space-y-1.5">
            <span className="block text-base font-medium">
              {showDragPrompt ? 'Solte a gravação aqui' : 'Arraste a gravação para cá'}
            </span>
            <span id={`${id}-limits`} className="block text-xs font-normal text-muted-foreground">Até 1 GB · 6 horas</span>
          </span>
          <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {isPreparingRecording ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            {isPreparingRecording ? 'Preparando gravação…' : 'Selecionar gravação'}
          </span>
        </Button>

        {recordingError ? (
          <p id={`${id}-recording-error`} role="alert" className="text-sm text-destructive">{recordingError}</p>
        ) : null}
        <p id={`${id}-flow`} className="text-sm leading-relaxed text-muted-foreground">
          O envio começa assim que você escolher o arquivo, e o processamento continua mesmo se você sair desta tela.
        </p>
        {isPreparingRecording ? <p role="status" className="sr-only">Preparando gravação…</p> : null}
      </div>

      <div className="min-w-0 space-y-4 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Convocação <span className="font-normal text-muted-foreground">· opcional</span></h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Anexe o PDF antes da gravação para orientar os nomes do condomínio, do síndico e os itens da pauta.
          </p>
        </div>

        {convocacao ? (
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-2 break-words text-sm">
              <p className="font-medium">Convocação lida</p>
              <ul className="space-y-1 text-muted-foreground">
                {convocacao.condominio ? <li>Condomínio: {convocacao.condominio}</li> : null}
                {convocacao.sindico ? <li>Síndico: {convocacao.sindico}</li> : null}
                {convocacao.data ? <li>Data: {convocacao.data}</li> : null}
                <li>
                  {convocacao.pautaItems.length > 0
                    ? `${convocacao.pautaItems.length} ${convocacao.pautaItems.length === 1 ? 'item de pauta' : 'itens de pauta'}`
                    : 'Pauta não identificada — o texto da convocação será usado assim mesmo'}
                </li>
              </ul>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Remover convocação"
              disabled={isBlocked}
              onClick={() => {
                if (isBlocked) return
                setConvocacaoError(null)
                onRemoveConvocacao()
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-10 max-w-full whitespace-normal text-left"
            aria-label="Anexar convocação (opcional)"
            aria-describedby={convocacaoError ? `${id}-convocacao-error` : undefined}
            disabled={isBlocked}
            onClick={() => {
              if (isBlocked) return
              convocacaoRef.current?.click()
            }}
          >
            {isReadingConvocacao ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FileText aria-hidden="true" />}
            {isReadingConvocacao ? 'Lendo convocação…' : 'Anexar convocação (opcional)'}
          </Button>
        )}
        {isReadingConvocacao ? <p role="status" className="text-sm text-muted-foreground">Lendo o texto da convocação…</p> : null}
        {convocacaoError ? <p id={`${id}-convocacao-error`} role="alert" className="text-sm text-destructive">{convocacaoError}</p> : null}
      </div>
    </div>
  )
}
