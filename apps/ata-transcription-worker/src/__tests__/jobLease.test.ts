import { describe, expect, it } from 'vitest'
import { MAX_JOB_ATTEMPTS, reclaimDecision } from '../jobLease.js'

describe('reclaimDecision', () => {
  it('puts an interrupted job back in the queue while it has attempts left', () => {
    expect(reclaimDecision(0)).toBe('requeue')
    expect(reclaimDecision(MAX_JOB_ATTEMPTS - 2)).toBe('requeue')
  })

  // Um job que derruba o worker toda vez voltaria para a fila para sempre,
  // derrubando junto os que vêm depois dele.
  it('gives up once the attempts are spent', () => {
    expect(reclaimDecision(MAX_JOB_ATTEMPTS - 1)).toBe('fail')
    expect(reclaimDecision(MAX_JOB_ATTEMPTS + 3)).toBe('fail')
  })
})
