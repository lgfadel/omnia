import { describe, expect, it } from 'vitest'
import { isCurrentProcessingJob, MAX_JOB_ATTEMPTS, reclaimDecision } from '../jobLease.js'

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

describe('isCurrentProcessingJob', () => {
  it('only treats the current processing job as eligible for another paid chunk', async () => {
    const filters: Record<string, unknown> = {}
    const row = { id: 'job-1', status: 'processing', is_current: true }
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => { filters[column] = value; return query },
      maybeSingle: async () => ({
        data: Object.entries(filters).every(([column, value]) => row[column as keyof typeof row] === value) ? { id: row.id } : null,
        error: null,
      }),
    }
    const client = { from: () => query } as never

    expect(await isCurrentProcessingJob(client, 'job-1')).toBe(true)
    expect(filters).toMatchObject({ id: 'job-1', status: 'processing', is_current: true })

    row.is_current = false
    expect(await isCurrentProcessingJob(client, 'job-1')).toBe(false)
  })
})
