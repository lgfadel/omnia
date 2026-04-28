import { describe, expect, it, vi } from 'vitest'
import { balancetesRepoSupabase } from '../balancetesRepo.supabase'

const supabaseMocks = vi.hoisted(() => {
  const orderMock = vi.fn()
  const selectMock = vi.fn(() => ({ order: orderMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))

  return { fromMock, orderMock, selectMock }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: supabaseMocks.fromMock,
  },
}))

vi.mock('@/lib/logging', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

describe('balancetesRepoSupabase', () => {
  it('mapeia o tipo de envio do condomínio em cada balancete listado', async () => {
    supabaseMocks.orderMock.mockResolvedValueOnce({
      data: [
        {
          id: 'balancete-1',
          condominium_id: 'cond-1',
          received_at: '2026-04-01',
          competencia: '03/2026',
          volumes: 1,
          observations: null,
          status: 'received',
          sent_at: null,
          protocolo_id: null,
          created_by: null,
          created_at: '2026-04-01',
          updated_at: '2026-04-01',
          omnia_condominiums: {
            name: 'Condomínio Digital',
            balancete_digital: true,
          },
        },
      ],
      error: null,
    })

    const balancetes = await balancetesRepoSupabase.list()

    expect(supabaseMocks.selectMock).toHaveBeenCalledWith('*, omnia_condominiums(name, balancete_digital)')
    expect(balancetes[0]).toMatchObject({
      condominium_name: 'Condomínio Digital',
      balancete_digital: true,
    })
  })
})
