export const AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS = 6 * 60 * 60

export type AtaTranscriptionStatus =
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

interface AudioValidationInput {
  name: string
  type: string
  durationSeconds: number | null
}

const acceptedExtensions = new Set(['mp3', 'm4a', 'wav', 'mp4', 'webm', 'aac', 'ogg', 'oga', 'opus'])
const acceptedMimeTypes = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'video/mp4',
  'audio/webm',
  'video/webm',
  'audio/ogg',
  'audio/opus',
])

export function getAudioValidationError({ name, type, durationSeconds }: AudioValidationInput): string | null {
  const extension = name.split('.').pop()?.toLowerCase()
  const hasSupportedFormat = Boolean(extension && acceptedExtensions.has(extension))
    || acceptedMimeTypes.has(type.toLowerCase())

  if (!hasSupportedFormat) {
    return 'Formato não suportado. Envie MP3, M4A, AAC, WAV, MP4, WebM ou OGG.'
  }

  if (durationSeconds !== null && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    return 'Não foi possível identificar a duração da gravação.'
  }

  if (durationSeconds !== null && durationSeconds > AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS) {
    return 'A gravação ultrapassa o limite de 6 horas.'
  }

  return null
}

export function getTranscriptionStatusLabel(status: AtaTranscriptionStatus): string {
  const labels: Record<AtaTranscriptionStatus, string> = {
    uploading: 'Enviando',
    queued: 'Na fila',
    processing: 'Processando',
    completed: 'Pronta para revisão',
    failed: 'Falhou',
  }

  return labels[status]
}

export type AtaTranscriptionStage = 'downloading' | 'splitting' | 'transcribing' | 'saving'

interface TranscriptionProgressInput {
  status: AtaTranscriptionStatus
  stage?: AtaTranscriptionStage
  totalChunks?: number
  processedChunks: number
}

const stageLabels: Record<AtaTranscriptionStage, string> = {
  downloading: 'Baixando a gravação',
  splitting: 'Preparando o áudio',
  transcribing: 'Transcrevendo',
  saving: 'Salvando a transcrição',
}

// O envio e o preparo ocupam a faixa inicial da barra; a transcrição, que é a
// etapa longa, ocupa o restante. Sem isso o percentual saltaria de 15% para 100%
// e ficaria imóvel durante todo o trabalho de verdade.
const UPLOAD_PERCENT = 8
const QUEUED_PERCENT = 12
const PREPARATION_PERCENT = 20
const TRANSCRIPTION_RANGE = 75

export function getTranscriptionProgress(
  { status, stage, totalChunks, processedChunks }: TranscriptionProgressInput,
): { percent: number; label: string } {
  if (status === 'completed') return { percent: 100, label: 'Concluída' }
  if (status === 'failed') return { percent: 0, label: 'Falhou' }
  if (status === 'uploading') return { percent: UPLOAD_PERCENT, label: 'Enviando a gravação' }
  if (status === 'queued') return { percent: QUEUED_PERCENT, label: 'Na fila' }

  if (stage === 'saving') return { percent: 97, label: stageLabels.saving }
  if (!stage || stage === 'downloading') return { percent: PREPARATION_PERCENT, label: stageLabels.downloading }
  if (stage === 'splitting') return { percent: PREPARATION_PERCENT, label: stageLabels.splitting }

  if (!totalChunks || totalChunks <= 0) {
    return { percent: PREPARATION_PERCENT, label: stageLabels.transcribing }
  }

  const done = Math.min(processedChunks, totalChunks)
  const percent = Math.round(PREPARATION_PERCENT + (done / totalChunks) * TRANSCRIPTION_RANGE)
  return {
    percent,
    // O rótulo importa tanto quanto a barra: num bloco longo o percentual fica
    // parado, e "bloco 2 de 4" é o que comunica que há trabalho acontecendo.
    label: `Transcrevendo bloco ${Math.min(done + 1, totalChunks)} de ${totalChunks}`,
  }
}
