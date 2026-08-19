import { describe, expect, it } from 'vitest'
import { mergeTranscribedChunks } from '../transcript.js'

describe('mergeTranscribedChunks', () => {
  it('offsets timestamps so later chunks continue the recording timeline', () => {
    const { segments } = mergeTranscribedChunks([
      { chunkIndex: 1, startOffsetSeconds: 0, segments: [{ start: 0, end: 4, text: 'abertura' }] },
      { chunkIndex: 2, startOffsetSeconds: 1800, segments: [{ start: 2, end: 6, text: 'votação' }] },
    ])
    expect(segments.map((s) => [s.sequence, s.startMs, s.endMs])).toEqual([
      [0, 0, 4000],
      [1, 1802000, 1806000],
    ])
  })

  it('breaks a paragraph on a long pause so the draft stays editable', () => {
    const { rawText } = mergeTranscribedChunks([
      {
        chunkIndex: 1,
        startOffsetSeconds: 0,
        segments: [
          { start: 0, end: 2, text: 'Primeiro assunto.' },
          { start: 2.2, end: 4, text: 'Ainda o primeiro.' },
          { start: 30, end: 32, text: 'Segundo assunto.' },
        ],
      },
    ])
    expect(rawText).toBe('Primeiro assunto. Ainda o primeiro.\n\nSegundo assunto.')
  })

  it('drops empty segments that whisper emits on silence', () => {
    const { segments } = mergeTranscribedChunks([
      { chunkIndex: 1, startOffsetSeconds: 0, segments: [{ start: 0, end: 1, text: '   ' }, { start: 1, end: 2, text: 'ok' }] },
    ])
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe('ok')
  })
})

describe('repetition loops', () => {
  it('collapses the near-identical lines whisper emits on inaudible audio', () => {
    const { segments } = mergeTranscribedChunks([
      {
        chunkIndex: 1,
        startOffsetSeconds: 0,
        segments: [
          { start: 18, end: 21, text: 'Ninguém se informou com o advogado, ninguém contou com o advogado.' },
          { start: 21, end: 23, text: 'Ninguém se informou com o advogado.' },
          { start: 23, end: 25, text: 'Ninguém se informou com o advogado.' },
          { start: 25, end: 27, text: 'Ninguém se informou com o advogado.' },
          { start: 27, end: 29, text: 'Ninguém se informou com o advogado.' },
          { start: 29, end: 32, text: 'Esse Flávio ainda é juiz, promotor, é seu familiar?' },
        ],
      },
    ])
    // Repetir de fato acontece em assembleia, então o corte para de ser agressivo
    // depois das primeiras ocorrências em vez de reduzir tudo a uma linha.
    const repeated = segments.filter((s) => s.text.includes('informou com o advogado'))
    expect(repeated.length).toBeLessThan(5)
    expect(segments.some((s) => s.text.includes('promotor'))).toBe(true)
  })

  it('keeps distinct sentences that merely share common words', () => {
    const { segments } = mergeTranscribedChunks([
      {
        chunkIndex: 1,
        startOffsetSeconds: 0,
        segments: [
          { start: 0, end: 3, text: 'O síndico apresentou a prestação de contas.' },
          { start: 3, end: 6, text: 'O conselho aprovou a prestação de contas por maioria.' },
        ],
      },
    ])
    expect(segments).toHaveLength(2)
  })
})
