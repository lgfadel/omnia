import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import {
  calculateHeaderBottomY,
  generateBalancetesRelatorioPDF,
} from '../generateBalancetesRelatorio'

describe('generateBalancetesRelatorio', () => {
  it('reserva mais espaço vertical no header quando existe logo', () => {
    const withoutLogo = calculateHeaderBottomY(0)
    const withLogo = calculateHeaderBottomY(60)

    expect(withLogo).toBeLessThan(withoutLogo)
    expect(withLogo).toBe(687)
  })

  it('gera páginas em formato A4', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem logo')))

    const pdfBytes = await generateBalancetesRelatorioPDF(
      [
        {
          condominium: 'Residencial A',
          competencia: '02/2026',
          defasagemLabel: '2 meses atrás',
          status: 'yellow',
          balanceteDigital: true,
        },
      ],
      []
    )

    const pdfDoc = await PDFDocument.load(pdfBytes)
    const page = pdfDoc.getPage(0)
    const { width, height } = page.getSize()

    expect(width).toBe(595)
    expect(height).toBe(842)
  })
})
