import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AtaMinutaDocuments } from '../AtaMinutaDocuments'

describe('AtaMinutaDocuments', () => {
  it('prevents a PDF that exceeds remaining aggregate capacity from being uploaded', async () => {
    const onUpload = vi.fn()
    render(<AtaMinutaDocuments documents={[{ id: 'doc-1', ataId: 'ata-1', kind: 'apuracao', originalFilename: 'votos.pdf', sizeBytes: 30 * 1024 * 1024, createdAt: '2026-10-02T10:00:00Z' }]} onUpload={onUpload} onDelete={vi.fn()} />)
    const file = new File(['pdf'], 'pauta.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 })
    fireEvent.change(screen.getByLabelText('PDF de apoio'), { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('limite total de 45 MB')
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('accepts a dropped PDF above 25 MB and notifies the parent while uploading', async () => {
    const file = new File(['pdf'], 'votacao.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 30 * 1024 * 1024 })
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const onBusyChange = vi.fn()
    render(<AtaMinutaDocuments documents={[]} onUpload={onUpload} onDelete={vi.fn()} onBusyChange={onBusyChange} />)
    fireEvent.drop(screen.getByRole('button', { name: /Selecionar PDF/ }), { dataTransfer: { files: [file] } })
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file, 'apuracao'))
    expect(onBusyChange).toHaveBeenNthCalledWith(1, true)
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
  })

  it('does not accept a drop while the agent is generating', () => {
    const onUpload = vi.fn()
    render(<AtaMinutaDocuments documents={[]} disabled onUpload={onUpload} onDelete={vi.fn()} />)
    fireEvent.drop(screen.getByRole('button', { name: /Selecionar PDF/ }), { dataTransfer: { files: [new File(['pdf'], 'pauta.pdf', { type: 'application/pdf' })] } })
    expect(onUpload).not.toHaveBeenCalled()
  })
})
