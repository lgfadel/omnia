import { describe, expect, it } from 'vitest'
import * as jobLease from '../jobLease.js'

type QueueJob = {
  id: string
  status: 'queued' | 'processing'
  is_current: boolean
  created_at: string
  started_at: string | null
  heartbeat_at: string | null
}

function createQueue(rows: QueueJob[], beforeClaim?: () => void) {
  const candidateFilters: Record<string, unknown> = {}
  const claimedIds: string[] = []

  const client = {
    from: (table: string) => {
      if (table !== 'omnia_ata_transcription_jobs') throw new Error(`Unexpected table: ${table}`)
      let filters: Record<string, unknown> = {}
      let update: Partial<QueueJob> | null = null

      const builder = {
        select: () => builder,
        update: (values: Partial<QueueJob>) => { update = values; return builder },
        eq: (column: string, value: unknown) => { filters[column] = value; return builder },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => {
          const match = (row: QueueJob) => Object.entries(filters).every(([column, value]) => row[column as keyof QueueJob] === value)
          if (!update) {
            Object.assign(candidateFilters, filters)
            const candidate = rows.filter(match).sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
            return { data: candidate ? { id: candidate.id } : null, error: null }
          }

          beforeClaim?.()
          const claimed = rows.find(match)
          if (claimed) {
            Object.assign(claimed, update)
            claimedIds.push(claimed.id)
          }
          return { data: claimed ?? null, error: null }
        },
      }
      return builder
    },
  }

  return { client, candidateFilters, claimedIds }
}

describe('claimCurrentQueuedJob', () => {
  it('claims the oldest current queued job and leaves replaced recordings queued', async () => {
    const claimCurrentQueuedJob = (jobLease as unknown as {
      claimCurrentQueuedJob?: (client: unknown, now: string) => Promise<QueueJob | null>
    }).claimCurrentQueuedJob

    expect(claimCurrentQueuedJob).toBeTypeOf('function')
    if (!claimCurrentQueuedJob) return

    const rows: QueueJob[] = [
      {
        id: 'replaced-job',
        status: 'queued',
        is_current: false,
        created_at: '2026-10-01T16:30:00.000Z',
        started_at: null,
        heartbeat_at: null,
      },
      {
        id: 'current-job',
        status: 'queued',
        is_current: true,
        created_at: '2026-10-01T16:42:00.000Z',
        started_at: null,
        heartbeat_at: null,
      },
    ]
    const queue = createQueue(rows)

    const claimed = await claimCurrentQueuedJob(queue.client, '2026-10-01T17:00:00.000Z')

    expect(queue.candidateFilters).toMatchObject({ status: 'queued', is_current: true })
    expect(queue.claimedIds).toEqual(['current-job'])
    expect(claimed?.id).toBe('current-job')
    expect(rows[0]).toMatchObject({ status: 'queued', is_current: false, started_at: null })
    expect(rows[1]).toMatchObject({ status: 'processing', is_current: true, started_at: '2026-10-01T17:00:00.000Z' })
  })

  it('does not claim a candidate that was replaced after the queue read', async () => {
    const claimCurrentQueuedJob = (jobLease as unknown as {
      claimCurrentQueuedJob?: (client: unknown, now: string) => Promise<QueueJob | null>
    }).claimCurrentQueuedJob

    expect(claimCurrentQueuedJob).toBeTypeOf('function')
    if (!claimCurrentQueuedJob) return

    const rows: QueueJob[] = [{
      id: 'replaced-during-claim',
      status: 'queued',
      is_current: true,
      created_at: '2026-10-01T16:42:00.000Z',
      started_at: null,
      heartbeat_at: null,
    }]
    const queue = createQueue(rows, () => { rows[0].is_current = false })

    const claimed = await claimCurrentQueuedJob(queue.client, '2026-10-01T17:00:00.000Z')

    expect(queue.claimedIds).toEqual([])
    expect(claimed).toBeNull()
    expect(rows[0]).toMatchObject({ status: 'queued', is_current: false, started_at: null })
  })
})
