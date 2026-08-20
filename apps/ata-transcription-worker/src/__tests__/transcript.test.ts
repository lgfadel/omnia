import { describe, expect, it } from 'vitest'
import { buildCarryOver, mergeTranscribedChunks, splitSentences } from '../transcript.js'

describe('splitSentences', () => {
  it('keeps the closing punctuation of each sentence', () => {
    expect(splitSentences('Boa noite. Vamos começar? Sim!')).toEqual(['Boa noite.', 'Vamos começar?', 'Sim!'])
  })
})

describe('mergeTranscribedChunks', () => {
  it('joins the chunks in order, never by arrival', () => {
    const { rawText } = mergeTranscribedChunks([
      { chunkIndex: 2, text: 'Segunda parte.' },
      { chunkIndex: 1, text: 'Primeira parte.' },
    ])
    expect(rawText).toBe('Primeira parte. Segunda parte.')
  })

  it('breaks the transcript into paragraphs instead of one endless block', () => {
    const text = Array.from({ length: 9 }, (_, index) => `Frase número ${index + 1}.`).join(' ')
    const { rawText } = mergeTranscribedChunks([{ chunkIndex: 1, text }])
    const paragraphs = rawText.split('\n\n')
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0]).toBe('Frase número 1. Frase número 2. Frase número 3. Frase número 4.')
  })

  it('keeps sentences that differ only by a number', () => {
    // "unidade 101" e "unidade 102" são a mesma frase para quem ignora dígito —
    // e cada uma delas é uma deliberação diferente da assembleia.
    const { rawText } = mergeTranscribedChunks([{
      chunkIndex: 1,
      text: 'A unidade 101 votou a favor. A unidade 102 votou a favor.',
    }])
    expect(rawText).toBe('A unidade 101 votou a favor. A unidade 102 votou a favor.')
  })

  it('drops the loop the model falls into over inaudible audio', () => {
    const { rawText } = mergeTranscribedChunks([{
      chunkIndex: 1,
      text: 'A pauta foi aprovada. A pauta foi aprovada. A pauta foi aprovada. O balancete segue.',
    }])
    expect(rawText).toBe('A pauta foi aprovada. O balancete segue.')
  })
})

describe('buildCarryOver', () => {
  it('strips what the prompt cannot carry', () => {
    expect(buildCarryOver('linha um\nlinha <dois>')).toBe('linha um linha dois')
  })

  it('keeps only the tail, which is the context the next chunk continues from', () => {
    const carry = buildCarryOver('a'.repeat(500) + 'FIM')
    expect(carry).toHaveLength(400)
    expect(carry.endsWith('FIM')).toBe(true)
  })
})
