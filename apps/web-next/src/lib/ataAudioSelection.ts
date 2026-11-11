import { getAudioValidationError, AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS } from './ataTranscription'

export type PendingRecording = { file: File; durationSeconds: number | null }
export const MAX_RECORDING_FILES = 3
export const MAX_RECORDING_BYTES = 1024 * 1024 * 1024

export function getAudioSelectionError(recordings: readonly PendingRecording[]): string | null {
  if (recordings.length === 0) return 'Adicione ao menos uma parte da gravação.'
  if (recordings.length > MAX_RECORDING_FILES) return 'Adicione no máximo três partes da gravação.'
  for (const { file, durationSeconds } of recordings) {
    if (file.size === 0) return 'A gravação está vazia. Escolha outro arquivo.'
    const error = getAudioValidationError({ name: file.name, type: file.type, durationSeconds })
    if (error) return error
  }
  if (recordings.reduce((total, { file }) => total + file.size, 0) > MAX_RECORDING_BYTES) {
    return 'As partes da gravação ultrapassam o limite total de 1 GB.'
  }
  if (recordings.reduce((total, { durationSeconds }) => total + (durationSeconds === null ? 0 : Math.ceil(durationSeconds)), 0) > AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS) {
    return 'As partes da gravação ultrapassam o limite total de 6 horas.'
  }
  return null
}

export function formatRecordingDuration(seconds: number | null): string {
  if (seconds === null) return 'Duração a verificar'
  const rounded = Math.ceil(seconds)
  const minutes = Math.floor(rounded / 60)
  const end = String(rounded % 60).padStart(2, '0')
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${end}` : `${minutes}:${end}`
}
