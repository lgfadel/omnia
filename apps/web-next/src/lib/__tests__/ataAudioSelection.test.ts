import { describe, expect, it } from 'vitest'
import { getAudioSelectionError, formatRecordingDuration } from '../ataAudioSelection'

const part = (size: number, durationSeconds: number | null = 60) => ({
  file: { name: 'parte.mp3', type: 'audio/mpeg', size } as File,
  durationSeconds,
})

describe('audio selection limits', () => {
  it('accepts three parts at the aggregate limits, including unknown metadata', () => {
    expect(getAudioSelectionError([part(500_000_000, 10800), part(500_000_000, 10800), part(73_741_824, null)])).toBeNull()
  })
  it('rejects a fourth part and an empty selection', () => {
    expect(getAudioSelectionError([])).toMatch(/Adicione/)
    expect(getAudioSelectionError([part(1), part(1), part(1), part(1)])).toMatch(/três/)
  })
  it('rejects a set exceeding one GB even if every file fits alone', () => {
    expect(getAudioSelectionError([part(600_000_000), part(600_000_000)])).toMatch(/1 GB/)
  })
  it('rejects the sum of known durations above six hours', () => {
    expect(getAudioSelectionError([part(1, 10800), part(1, 10801)])).toMatch(/6 horas/)
  })
  it('rejects empty files and unsupported formats before upload', () => {
    expect(getAudioSelectionError([part(0)])).toMatch(/vazia/)
    expect(getAudioSelectionError([{ file: { name: 'ata.exe', type: 'application/octet-stream', size: 1 } as File, durationSeconds: null }])).toMatch(/Formato/)
  })
  it('formats durations without losing hours or the unknown state', () => {
    expect(formatRecordingDuration(3661)).toBe('1:01:01')
    expect(formatRecordingDuration(61)).toBe('1:01')
    expect(formatRecordingDuration(null)).toBe('Duração a verificar')
  })
})
