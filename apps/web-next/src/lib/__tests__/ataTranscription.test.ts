import { describe, expect, it } from 'vitest'
import {
  AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS,
  getAudioValidationError,
  getTranscriptionStatusLabel,
} from '../ataTranscription'

describe('getAudioValidationError', () => {
  it('accepts a supported recording shorter than six hours', () => {
    expect(getAudioValidationError({
      name: 'assembleia.m4a',
      type: 'audio/mp4',
      durationSeconds: AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS - 1,
    })).toBeNull()
  })

  it('rejects unsupported audio types', () => {
    expect(getAudioValidationError({
      name: 'assembleia.aac',
      type: 'audio/aac',
      durationSeconds: 60,
    })).toBe('Formato não suportado. Envie MP3, M4A, WAV, MP4 ou WebM.')
  })

  it('rejects recordings longer than six hours', () => {
    expect(getAudioValidationError({
      name: 'assembleia.mp3',
      type: 'audio/mpeg',
      durationSeconds: AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS + 1,
    })).toBe('A gravação ultrapassa o limite de 6 horas.')
  })
})

describe('getTranscriptionStatusLabel', () => {
  it('maps background processing states to user-facing labels', () => {
    expect(getTranscriptionStatusLabel('queued')).toBe('Na fila')
    expect(getTranscriptionStatusLabel('processing')).toBe('Processando')
    expect(getTranscriptionStatusLabel('completed')).toBe('Pronta para revisão')
  })
})
