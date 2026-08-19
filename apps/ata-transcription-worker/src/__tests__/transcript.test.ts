import { describe, expect, it } from 'vitest'
import { mergeDiarizedChunks } from '../transcript.js'

describe('mergeDiarizedChunks', () => {
  it('keeps segment order and makes chunk-scoped speaker labels explicit', () => {
    const result = mergeDiarizedChunks([
      {
        chunkIndex: 1,
        segments: [{ start: 0, end: 2.5, speaker: 'A', text: 'Primeiro item.' }],
      },
      {
        chunkIndex: 2,
        segments: [{ start: 1, end: 3, speaker: 'A', text: 'Segundo item.' }],
      },
    ])

    expect(result.segments).toEqual([
      { sequence: 0, startMs: 0, endMs: 2500, speakerLabel: 'T1-A', text: 'Primeiro item.' },
      { sequence: 1, startMs: 1_201_000, endMs: 1_203_000, speakerLabel: 'T2-A', text: 'Segundo item.' },
    ])
    expect(result.rawText).toBe('[T1-A] Primeiro item.\n[T2-A] Segundo item.')
  })
})
