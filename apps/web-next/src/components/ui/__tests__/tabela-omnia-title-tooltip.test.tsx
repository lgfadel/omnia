import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../tooltip'
import { TabelaOmnia } from '../tabela-omnia'

const columns = [{ key: 'title', label: 'Título' }]
const data = [
  { id: '1', title: 'Renovar contrato do condomínio', description: 'Falta anexar a ata assinada.' },
]

function renderTable(showTitleTooltip: boolean) {
  return render(
    <TooltipProvider>
      <TabelaOmnia columns={columns} data={data} showTitleTooltip={showTitleTooltip} />
    </TooltipProvider>,
  )
}

describe('TabelaOmnia — tooltip do título', () => {
  // O Radix calcula por qual lado o mouse saiu a partir dos retângulos; no jsdom
  // eles são todos zero, então damos geometria ao trigger e ao conteúdo.
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const isContent = this.getAttribute('role') === 'tooltip' || this.closest('[data-radix-popper-content-wrapper]')
      return (isContent
        ? { x: 0, y: 40, left: 0, top: 40, right: 200, bottom: 100, width: 200, height: 60 }
        : { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }) as DOMRect
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('abre com título e descrição no hover e fecha ao sair', async () => {
    renderTable(true)
    const title = screen.getByText('Renovar contrato do condomínio')

    fireEvent.pointerMove(title)
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('Renovar contrato do condomínio')
    expect(tooltip).toHaveTextContent('Falta anexar a ata assinada.')

    // jsdom não tem PointerEvent e descartaria as coordenadas que o Radix lê.
    act(() => {
      title.dispatchEvent(new MouseEvent('pointerleave', { clientX: 300, clientY: 10 }))
    })
    // Sem entrar no tooltip, o mouse se afasta e a grace area do Radix se desfaz
    // (o listener só existe depois do re-render, por isso o segundo act).
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 900, clientY: 900 }))
    })
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  })

  it('não abre tooltip quando a opção está desligada', () => {
    renderTable(false)
    fireEvent.pointerMove(screen.getByText('Renovar contrato do condomínio'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
