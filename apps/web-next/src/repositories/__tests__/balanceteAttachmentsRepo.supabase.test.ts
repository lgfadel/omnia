import { describe, expect, it, vi } from 'vitest'
import { balanceteAttachmentsRepoSupabase } from '../balanceteAttachmentsRepo.supabase'

const supabaseMocks = vi.hoisted(() => {
  const orderMock = vi.fn()
  const eqMock = vi.fn(() => ({ order: orderMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))

  return { fromMock, selectMock, eqMock, orderMock }
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
    warn: vi.fn(),
  },
}))

describe('balanceteAttachmentsRepoSupabase', () => {
  it('lista anexos individuais por balancete', async () => {
    supabaseMocks.orderMock.mockResolvedValueOnce({
      data: [
        {
          id: 'att-1',
          balancete_id: 'bal-1',
          protocolo_id: 'prot-1',
          source_page_number: 3,
          detected_protocol_number: 87,
          ocr_status: 'matched',
          name: 'pagina-3.pdf',
          url: 'https://example.com/pagina-3.pdf',
          size_kb: 120,
          mime_type: 'application/pdf',
          uploaded_by: 'user-1',
          created_at: '2026-05-05T10:00:00.000Z',
        },
      ],
      error: null,
    })

    const attachments = await balanceteAttachmentsRepoSupabase.listByBalancete('bal-1')

    expect(supabaseMocks.selectMock).toHaveBeenCalledWith('*')
    expect(supabaseMocks.eqMock).toHaveBeenCalledWith('balancete_id', 'bal-1')
    expect(attachments).toEqual([
      expect.objectContaining({
        id: 'att-1',
        balanceteId: 'bal-1',
        protocoloId: 'prot-1',
        sourcePageNumber: 3,
        detectedProtocolNumber: 87,
        ocrStatus: 'matched',
        name: 'pagina-3.pdf',
      }),
    ])
  })
})
