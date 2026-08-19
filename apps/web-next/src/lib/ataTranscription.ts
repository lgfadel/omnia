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
  durationSeconds: number
}

const acceptedExtensions = new Set(['mp3', 'm4a', 'wav', 'mp4', 'webm'])
const acceptedMimeTypes = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'video/mp4',
  'audio/webm',
  'video/webm',
])

export function getAudioValidationError({ name, type, durationSeconds }: AudioValidationInput): string | null {
  const extension = name.split('.').pop()?.toLowerCase()
  const hasSupportedFormat = Boolean(extension && acceptedExtensions.has(extension))
    || acceptedMimeTypes.has(type.toLowerCase())

  if (!hasSupportedFormat) {
    return 'Formato não suportado. Envie MP3, M4A, WAV, MP4 ou WebM.'
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 'Não foi possível identificar a duração da gravação.'
  }

  if (durationSeconds > AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS) {
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
