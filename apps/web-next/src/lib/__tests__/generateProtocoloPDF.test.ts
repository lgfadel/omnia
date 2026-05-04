import { PDFPage } from 'pdf-lib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateProtocoloPDF } from '../generateProtocoloPDF'

describe('generateProtocoloPDF', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza o rodape de assinatura apenas na via EURO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('logo indisponivel')))

    const drawTextSpy = vi.spyOn(PDFPage.prototype, 'drawText')

    await generateProtocoloPDF({
      numeroProtocolo: 1,
      dataEnvio: '2026-05-04',
      balancetes: [
        {
          id: '1',
          condominium_id: 'cond-1',
          condominium_name: 'Condominio Teste',
          competencia: '04/2026',
          received_at: '2026-05-01',
          volumes: 1,
          observations: null,
          status: 'received',
          sent_at: '2026-05-04',
          protocolo_id: 'proto-1',
          balancete_digital: false,
          created_at: null,
          updated_at: null,
        },
      ],
    })

    const receivedByCalls = drawTextSpy.mock.calls.filter(([text]) => text === 'Recebido por:')
    expect(receivedByCalls).toHaveLength(1)
  })
})
