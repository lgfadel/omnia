import { describe, expect, it } from 'vitest'
import { planChunks } from '../chunkPlan.js'

describe('planChunks', () => {
  it('cuts the recording into fixed windows with a shorter last one', () => {
    expect(planChunks(4000, 1800)).toEqual([
      { index: 0, startSeconds: 0, durationSeconds: 1800 },
      { index: 1, startSeconds: 1800, durationSeconds: 1800 },
      { index: 2, startSeconds: 3600, durationSeconds: 400 },
    ])
  })

  it('keeps a recording shorter than one window in a single chunk', () => {
    expect(planChunks(95.4, 1800)).toEqual([{ index: 0, startSeconds: 0, durationSeconds: 95.4 }])
  })

  // Um resto de frações de segundo vira um bloco sem fala: o modelo devolveria
  // ruído, e a parte do multipart ficaria vazia.
  it('folds a sub-second remainder into the previous chunk', () => {
    expect(planChunks(3600.4, 1800)).toEqual([
      { index: 0, startSeconds: 0, durationSeconds: 1800 },
      { index: 1, startSeconds: 1800, durationSeconds: 1800.4 },
    ])
  })

  it('rejects a duration that is not a positive number', () => {
    expect(() => planChunks(0, 1800)).toThrow()
    expect(() => planChunks(Number.NaN, 1800)).toThrow()
  })
})
