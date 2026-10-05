import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { balancetesRepoSupabase } from '../balancetesRepo.supabase'

const mocks = vi.hoisted(() => {
  interface RecordedUpdate {
    payload: Record<string, unknown>
    filters: string[]
    selected: boolean
  }

  const updates: RecordedUpdate[] = []
  const createProtocolo = vi.fn()
  let sentRows: unknown[] = []

  const fromMock = vi.fn(() => ({
    update: (payload: Record<string, unknown>) => {
      const recorded: RecordedUpdate = { payload, filters: [], selected: false }
      updates.push(recorded)
      const builder = {
        in: (column: string) => {
          recorded.filters.push(`in:${column}`)
          return builder
        },
        is: (column: string, value: unknown) => {
          recorded.filters.push(`is:${column}:${String(value)}`)
          return builder
        },
        select: () => {
          recorded.selected = true
          return builder
        },
        then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
          resolve({ data: recorded.selected ? sentRows : null, error: null }),
      }
      return builder
    },
  }))

  return {
    updates,
    createProtocolo,
    fromMock,
    setSentRows: (rows: unknown[]) => {
      sentRows = rows
    },
  }
})

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.fromMock } }))
vi.mock('@/lib/logging', () => ({ logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }))
vi.mock('../protocolosRepo.supabase', () => ({
  protocolosRepoSupabase: { create: mocks.createProtocolo },
}))

describe('balancetesRepoSupabase.markAsSent', () => {
  beforeEach(() => {
    mocks.updates.length = 0
    mocks.createProtocolo.mockResolvedValue({ id: 'prot-1', numero: 7, data_envio: '2026-10-06' })
    mocks.setSentRows([
      { id: 'b1', condominium_id: 'c1', received_at: '2026-10-05', competencia: '08/2026', protocolo_id: 'prot-1' },
    ])
    vi.useFakeTimers()
    // 22:30 em Brasília do dia 05/10; em UTC já é dia 06.
    vi.setSystemTime(new Date('2026-10-06T01:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('da baixa no fisico (received_at = hoje em Brasilia) dos balancetes que ainda aguardavam', async () => {
    await balancetesRepoSupabase.markAsSent(['b1', 'b2'], '2026-10-06', 'user-1')

    const receivedUpdate = mocks.updates.find((update) => 'received_at' in update.payload)

    expect(receivedUpdate).toBeDefined()
    expect(receivedUpdate?.payload).toEqual({ received_at: '2026-10-05' })
    // Só toca em quem está com received_at vazio: nunca sobrescreve um recebimento já registrado.
    expect(receivedUpdate?.filters).toEqual(['in:id', 'is:received_at:null'])
  })

  it('grava sent_at e protocolo_id em todos os selecionados, sem mexer em received_at', async () => {
    await balancetesRepoSupabase.markAsSent(['b1', 'b2'], '2026-10-06', 'user-1')

    const sentUpdate = mocks.updates.find((update) => 'sent_at' in update.payload)

    expect(sentUpdate?.payload).toEqual({ sent_at: '2026-10-06', protocolo_id: 'prot-1' })
    expect(sentUpdate?.filters).toEqual(['in:id'])
  })

  it('da baixa no recebimento antes de gravar o envio', async () => {
    await balancetesRepoSupabase.markAsSent(['b1'], '2026-10-06')

    const order = mocks.updates.map((update) => ('received_at' in update.payload ? 'recebimento' : 'envio'))

    expect(order).toEqual(['recebimento', 'envio'])
  })
})
