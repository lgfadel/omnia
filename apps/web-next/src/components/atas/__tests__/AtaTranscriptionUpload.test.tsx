import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConvocacaoContext } from '@/lib/convocacao'
import { AtaTranscriptionUpload } from '../AtaTranscriptionUpload'

const convocacao: ConvocacaoContext = {
  text: 'Texto da convocação',
  pages: 2,
  condominio: 'Residencial das Oliveiras',
  sindico: 'Maria Silva',
  data: '02/10/2026',
  pautaItems: ['Prestação de contas', 'Manutenção dos elevadores'],
}

function setup(overrides: Partial<React.ComponentProps<typeof AtaTranscriptionUpload>> = {}) {
  const props = {
    convocacao: null,
    isReadingConvocacao: false,
    onRecordingSelect: vi.fn(),
    onConvocacaoSelect: vi.fn(),
    onRemoveConvocacao: vi.fn(),
    ...overrides,
  }
  const view = render(<AtaTranscriptionUpload {...props} />)
  return { ...view, props }
}

describe('AtaTranscriptionUpload', () => {
  it('explains immediate upload, background processing and the supported recording limits', () => {
    setup()

    expect(screen.getByText('Envie uma gravação de até 6 horas')).toBeInTheDocument()
    expect(screen.getByText(/O envio começa assim que você escolher o arquivo/)).toBeInTheDocument()
    expect(screen.getByText(/processamento continua mesmo se você sair desta tela/)).toBeInTheDocument()
    expect(screen.getByText('Até 1 GB · 6 horas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar gravação' })).toBeEnabled()

    const input = screen.getByLabelText('Selecionar arquivo de gravação')
    for (const extension of ['.mp3', '.m4a', '.aac', '.wav', '.mp4', '.webm', '.ogg', '.oga', '.opus']) {
      expect(input.getAttribute('accept')?.split(',')).toContain(extension)
    }
    expect(input).not.toHaveAttribute('multiple')
  })

  it('opens the recording picker and forwards the selected file with its input cleared for another attempt', () => {
    const { props } = setup()
    const input = screen.getByLabelText('Selecionar arquivo de gravação') as HTMLInputElement
    const picker = vi.spyOn(input, 'click').mockImplementation(() => {})
    const file = new File(['audio'], 'assembleia.m4a', { type: 'audio/mp4' })

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar gravação' }))
    expect(picker).toHaveBeenCalledOnce()

    // Um arquivo recusado pelo painel deve poder ser escolhido novamente.
    Object.defineProperty(input, 'value', { value: 'C:\\fakepath\\assembleia.m4a', writable: true })
    fireEvent.change(input, { target: { files: [file] } })

    expect(props.onRecordingSelect).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { files: [file] } })
    expect(props.onRecordingSelect).toHaveBeenCalledTimes(2)
  })

  it('accepts a recording dropped on the same button and restores the drag prompt afterward', () => {
    const { props } = setup()
    const dropzone = screen.getByRole('button', { name: 'Selecionar gravação' })
    const file = new File(['audio'], 'assembleia.opus', { type: 'audio/ogg' })
    const dataTransfer = { files: [file], types: ['Files'] }

    fireEvent.dragEnter(dropzone, { dataTransfer })
    expect(screen.getByText('Solte a gravação aqui')).toBeInTheDocument()
    fireEvent.drop(dropzone, { dataTransfer })

    expect(props.onRecordingSelect).toHaveBeenCalledOnce()
    expect(props.onRecordingSelect).toHaveBeenCalledWith(file)
    expect(screen.queryByText('Solte a gravação aqui')).toBeNull()
  })

  it('rejects multiple dropped recordings accessibly and allows a new single-file attempt', () => {
    const { props } = setup()
    const dropzone = screen.getByRole('button', { name: 'Selecionar gravação' })
    const file = new File(['audio'], 'assembleia.mp3', { type: 'audio/mpeg' })
    const secondFile = new File(['audio'], 'outra.mp3', { type: 'audio/mpeg' })

    fireEvent.drop(dropzone, { dataTransfer: { files: [file, secondFile], types: ['Files'] } })

    expect(props.onRecordingSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Envie uma gravação por vez.')
    expect(dropzone).toHaveAccessibleDescription(/Envie uma gravação por vez/)

    fireEvent.drop(dropzone, { dataTransfer: { files: [file], types: ['Files'] } })
    expect(props.onRecordingSelect).toHaveBeenCalledWith(file)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('ignores drops without files', () => {
    const { props } = setup()

    fireEvent.drop(screen.getByRole('button', { name: 'Selecionar gravação' }), {
      dataTransfer: { files: [], types: ['text/plain'] },
    })

    expect(props.onRecordingSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['disabled', { disabled: true }],
    ['reading the convocação', { isReadingConvocacao: true }],
    ['preparing the recording', { isPreparingRecording: true }],
  ])('blocks selection, dropping and removal while %s', (_, busyProps) => {
    const { props } = setup({ ...busyProps, convocacao })
    const recording = new File(['audio'], 'assembleia.mp3', { type: 'audio/mpeg' })
    const pdf = new File(['pdf'], 'convocacao.pdf', { type: 'application/pdf' })
    const dropzone = screen.getByRole('button', { name: 'Selecionar gravação' })
    const input = screen.getByLabelText('Selecionar arquivo de gravação')
    const pdfInput = screen.getByLabelText('Selecionar convocação em PDF')

    expect(dropzone).toBeDisabled()
    expect(input).toBeDisabled()
    expect(pdfInput).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remover convocação' })).toBeDisabled()

    // Eventos disparados enquanto um seletor já está aberto também precisam
    // respeitar o bloqueio; só desabilitar o botão não cobre este caminho.
    fireEvent.change(input, { target: { files: [recording] } })
    fireEvent.change(pdfInput, { target: { files: [pdf] } })
    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [recording], types: ['Files'] } })
    fireEvent.drop(dropzone, { dataTransfer: { files: [recording], types: ['Files'] } })
    fireEvent.click(screen.getByRole('button', { name: 'Remover convocação' }))

    expect(props.onRecordingSelect).not.toHaveBeenCalled()
    expect(props.onConvocacaoSelect).not.toHaveBeenCalled()
    expect(props.onRemoveConvocacao).not.toHaveBeenCalled()
    expect(screen.queryByText('Solte a gravação aqui')).toBeNull()
  })

  it('opens the optional PDF picker, forwards the selected PDF and clears its input', () => {
    const { props } = setup()
    const input = screen.getByLabelText('Selecionar convocação em PDF') as HTMLInputElement
    const picker = vi.spyOn(input, 'click').mockImplementation(() => {})
    const file = new File(['pdf'], 'convocacao.pdf', { type: 'application/pdf' })

    expect(input).toHaveAttribute('accept', 'application/pdf,.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Anexar convocação (opcional)' }))
    expect(picker).toHaveBeenCalledOnce()
    Object.defineProperty(input, 'value', { value: 'C:\\fakepath\\convocacao.pdf', writable: true })
    fireEvent.change(input, { target: { files: [file] } })

    expect(props.onConvocacaoSelect).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
  })

  it('shows the parsed convocação metadata and exposes removal', () => {
    const { props } = setup({ convocacao })

    expect(screen.getByText('Convocação lida')).toBeInTheDocument()
    expect(screen.getByText('Condomínio: Residencial das Oliveiras')).toBeInTheDocument()
    expect(screen.getByText('Síndico: Maria Silva')).toBeInTheDocument()
    expect(screen.getByText('Data: 02/10/2026')).toBeInTheDocument()
    expect(screen.getByText('2 itens de pauta')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remover convocação' }))
    expect(props.onRemoveConvocacao).toHaveBeenCalledOnce()
  })

  it('explains that a parsed PDF without identifiable agenda items will still be used', () => {
    setup({ convocacao: { text: 'Texto da convocação', pages: 1, pautaItems: [] } })

    expect(screen.getByText('Pauta não identificada — o texto da convocação será usado assim mesmo')).toBeInTheDocument()
  })
})
