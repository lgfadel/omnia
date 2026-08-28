import { describe, expect, it } from 'vitest'
import {
  AUDIO_TRANSCRIPTION_MAX_DURATION_SECONDS,
  getAudioValidationError,
  getTranscriptionProgress,
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

  it('accepts the .m4a recordings that phone and Mac voice recorders produce', () => {
    expect(getAudioValidationError({
      name: 'Tapuias 2026-08-17.m4a',
      type: 'audio/x-m4a',
      durationSeconds: 3618,
    })).toBeNull()
  })

  it('accepts a supported M4A when the browser cannot report its duration', () => {
    expect(getAudioValidationError({
      name: 'Avenida Canadá.m4a',
      type: 'audio/mp4',
      durationSeconds: null,
    })).toBeNull()
  })

  it('rejects unsupported audio types', () => {
    expect(getAudioValidationError({
      name: 'assembleia.wma',
      type: 'audio/x-ms-wma',
      durationSeconds: 60,
    })).toBe('Formato não suportado. Envie MP3, M4A, AAC, WAV, MP4, WebM ou OGG.')
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

describe('getTranscriptionProgress', () => {
  it('advances with each transcribed chunk instead of sitting at a fixed value', () => {
    const first = getTranscriptionProgress({ status: 'processing', stage: 'transcribing', totalChunks: 4, processedChunks: 0 })
    const third = getTranscriptionProgress({ status: 'processing', stage: 'transcribing', totalChunks: 4, processedChunks: 2 })
    expect(first.percent).toBeLessThan(third.percent)
    expect(third.label).toBe('Transcrevendo bloco 3 de 4')
  })

  it('names the preparation stages so short phases still show movement', () => {
    expect(getTranscriptionProgress({ status: 'processing', stage: 'downloading', processedChunks: 0 }).label)
      .toBe('Baixando a gravação')
    expect(getTranscriptionProgress({ status: 'processing', stage: 'splitting', processedChunks: 0 }).label)
      .toBe('Preparando o áudio')
  })

  it('never reports progress beyond the chunk count', () => {
    const progress = getTranscriptionProgress({ status: 'processing', stage: 'transcribing', totalChunks: 3, processedChunks: 9 })
    expect(progress.percent).toBeLessThanOrEqual(100)
    expect(progress.label).toBe('Transcrevendo bloco 3 de 3')
  })

  it('reports a complete job as finished', () => {
    expect(getTranscriptionProgress({ status: 'completed', processedChunks: 4, totalChunks: 4 }).percent).toBe(100)
  })
})
