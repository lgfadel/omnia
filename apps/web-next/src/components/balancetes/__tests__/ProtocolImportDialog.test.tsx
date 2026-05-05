import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProtocolImportDialog } from '../ProtocolImportDialog'

const mockImportBatch = vi.fn()
const mockToast = vi.fn()

vi.mock('@/repositories/balanceteProtocolImports.repo', () => ({
  balanceteProtocolImportsRepo: {
    importBatch: (...args: any[]) => mockImportBatch(...args),
    resolveItem: vi.fn(),
  },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

describe('ProtocolImportDialog', () => {
  it('exibe barra e mensagem de progresso enquanto a importacao esta em andamento', async () => {
    let resolveImport!: (value: any) => void
    mockImportBatch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveImport = resolve
      })
    )

    render(
      <ProtocolImportDialog
        open
        onOpenChange={vi.fn()}
        balancetes={[]}
        protocolos={[]}
      />
    )

    const file = new File(['fake pdf'], 'protocolos.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('PDF multipágina'), {
      target: { files: [file] },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Importar PDF' }))

    expect(await screen.findByText('Processando importação')).toBeInTheDocument()
    expect(
      screen.getByText('Identificando protocolos e anexando páginas. Isso pode levar alguns segundos.')
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresso da importação' })).toBeInTheDocument()

    resolveImport({
      batch: {
        id: 'batch-1',
        originalFilename: 'protocolos.pdf',
        totalPages: 1,
        matchedCount: 1,
        pendingCount: 0,
        failedCount: 0,
      },
      items: [],
    })

    await waitFor(() => {
      expect(screen.queryByText('Processando importação')).not.toBeInTheDocument()
    })
  })
})
