"use client"

import type { AtaTranscription, AtaTranscriptionJob } from '@/data/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AtaTranscriptionEditor } from './AtaTranscriptionEditor'
import { Check, Download, FilePlus2, Headphones, RefreshCcw, Save, Sparkles } from 'lucide-react'

export type TranscriptionAudioState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'gone' }
  | { status: 'error' }

interface AtaTranscriptionReviewProps {
  job: AtaTranscriptionJob
  transcription: AtaTranscription
  value: string
  audio: TranscriptionAudioState
  hasUnsavedChanges: boolean
  isSaving: boolean
  isDiscarding: boolean
  isPreparingRecording: boolean
  onChange: (value: string) => void
  onSave: (reviewed: boolean) => void
  onPrepareMinuta?: () => void
  onDownload: () => void
  onRetryAudio: () => void
  onAudioError: () => void
  onReplace: () => void
  onDiscard: () => void
}

export function AtaTranscriptionReview({ job, transcription, value, audio, hasUnsavedChanges, isSaving, isDiscarding, isPreparingRecording, onChange, onSave, onPrepareMinuta, onDownload, onRetryAudio, onAudioError, onReplace, onDiscard }: AtaTranscriptionReviewProps) {
  const reviewed = transcription.isReviewed
  const busy = isSaving || isDiscarding || isPreparingRecording
  const empty = !value.trim()

  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <Card className="min-w-0 overflow-hidden shadow-none">
        <div className="space-y-1 border-b px-5 py-5 sm:px-6">
          <h3 className="text-base font-semibold">{reviewed ? 'Transcrição revisada' : 'Transcrição para revisão'}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {reviewed ? 'O texto está fechado. Reabra a revisão para fazer novas correções.' : 'Confira nomes, falas e decisões. Use o áudio para conferir uma passagem duvidosa.'}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <AtaTranscriptionEditor
            value={value}
            onChange={onChange}
            disabled={busy || reviewed}
            textareaClassName="min-h-[28rem] resize-y border-0 bg-transparent px-1 py-3 text-base leading-8 shadow-none focus-visible:ring-1 sm:min-h-[36rem] sm:px-2"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
          <p role="status" className={`text-xs ${hasUnsavedChanges ? 'text-foreground' : 'text-muted-foreground'}`}>
            {isSaving ? 'Salvando alterações…' : hasUnsavedChanges ? 'Alterações não salvas' : reviewed ? 'Revisão concluída' : 'Texto salvo'}
          </p>
          <Button variant="ghost" size="sm" disabled={empty || busy} onClick={onDownload}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar .txt
          </Button>
        </div>
      </Card>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-6" aria-label="Áudio e ações de revisão">
        {audio.status !== 'gone' && (
          <Card className="space-y-4 p-5 shadow-none">
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Headphones className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Gravação original
              </h3>
              <p className="break-words text-xs leading-relaxed text-muted-foreground">{job.originalFilename}</p>
            </div>
            {audio.status === 'ready' && <audio src={audio.url} controls preload="metadata" className="w-full" onError={onAudioError} />}
            {audio.status === 'loading' && <p role="status" className="text-sm text-muted-foreground">Carregando áudio…</p>}
            {audio.status === 'error' && (
              <div className="space-y-3">
                <p role="status" className="text-sm leading-relaxed text-muted-foreground">O áudio não carregou. Você pode continuar revisando o texto.</p>
                <Button variant="outline" size="sm" className="h-auto w-full whitespace-normal py-2" onClick={onRetryAudio}>
                  <RefreshCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Carregar áudio novamente
                </Button>
              </div>
            )}
          </Card>
        )}

        <Card className="p-5 shadow-none">
          <div className="mb-4 space-y-2">
            <h3 className="text-sm font-medium">{reviewed ? 'Pronta para a minuta' : 'Conclua a revisão'}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {reviewed ? 'Use a transcrição revisada para preparar o documento da assembleia.' : 'Corrija o texto e marque como revisado quando os nomes e as decisões estiverem conferidos.'}
            </p>
          </div>
          <div className="space-y-2">
            {reviewed ? (
              <Button variant="outline" className="w-full" disabled={busy} onClick={() => onSave(false)}>
                {isSaving ? 'Reabrindo…' : 'Reabrir para edição'}
              </Button>
            ) : (
              <>
                <Button className="w-full" disabled={busy || empty} onClick={() => onSave(true)}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {isSaving ? 'Salvando…' : 'Marcar como revisada'}
                </Button>
                <Button variant="outline" className="w-full" disabled={busy || empty} onClick={() => onSave(false)}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Salvar rascunho
                </Button>
              </>
            )}
            {onPrepareMinuta && (
              <Button variant={reviewed ? 'default' : 'ghost'} className="h-auto min-h-10 w-full whitespace-normal py-2" disabled={busy || empty} onClick={onPrepareMinuta}>
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                {hasUnsavedChanges ? 'Salvar e preparar minuta' : 'Preparar minuta'}
              </Button>
            )}
          </div>
          <div className="mt-5 space-y-1 border-t pt-4">
            <Button variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal px-2 py-2 text-muted-foreground" disabled={busy} onClick={onReplace}>
              <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {isPreparingRecording ? 'Preparando gravação…' : 'Enviar nova gravação'}
            </Button>
            <Button variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal px-2 py-2 text-muted-foreground hover:text-destructive" disabled={busy} onClick={onDiscard}>
              {isDiscarding ? 'Descartando…' : 'Descartar transcrição'}
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  )
}
