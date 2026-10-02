import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { AtaTranscriptionEditor } from '../AtaTranscriptionEditor'

function Harness({ initial, onChange, disabled = false }: { initial: string; onChange?: (value: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState(initial)
  return (
    <AtaTranscriptionEditor
      value={value}
      onChange={(next) => { setValue(next); onChange?.(next) }}
      disabled={disabled}
    />
  )
}

const TEXT = 'O sindico abriu a assembleia. O sindico leu a pauta. O SINDICO encerrou.'

function openSearchTools() {
  fireEvent.click(screen.getByRole('button', { name: 'Localizar e substituir' }))
}

describe('AtaTranscriptionEditor', () => {
  it('reveals search tools on demand and preserves the query when closed', () => {
    render(<Harness initial={TEXT} />)

    const toggle = screen.getByRole('button', { name: 'Localizar e substituir' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Localizar no texto')).toBeNull()

    openSearchTools()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })
    fireEvent.click(toggle)
    expect(screen.queryByLabelText('Localizar no texto')).toBeNull()

    openSearchTools()
    expect(screen.getByLabelText('Localizar no texto')).toHaveValue('sindico')
    expect(screen.getByText('1 de 3')).toBeInTheDocument()
  })

  it('counts every occurrence, ignoring case by default', async () => {
    render(<Harness initial={TEXT} />)
    openSearchTools()

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })

    expect(screen.getByText('1 de 3')).toBeInTheDocument()
  })

  it('respects case sensitivity when asked', async () => {
    render(<Harness initial={TEXT} />)
    openSearchTools()

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })
    fireEvent.click(screen.getByLabelText('Diferenciar maiúsculas de minúsculas'))

    expect(screen.getByText('1 de 2')).toBeInTheDocument()
  })

  it('replaces a single occurrence without touching the others', async () => {
    const onChange = vi.fn()
    render(<Harness initial={TEXT} onChange={onChange} />)
    openSearchTools()

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })
    fireEvent.change(screen.getByLabelText('Substituir por'), { target: { value: 'síndico' } })
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    expect(onChange).toHaveBeenCalledWith('O síndico abriu a assembleia. O sindico leu a pauta. O SINDICO encerrou.')
  })

  it('replaces every occurrence and offers to undo it', async () => {
    const onChange = vi.fn()
    render(<Harness initial={TEXT} onChange={onChange} />)
    openSearchTools()

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })
    fireEvent.change(screen.getByLabelText('Substituir por'), { target: { value: 'síndico' } })
    fireEvent.click(screen.getByRole('button', { name: /Tudo/ }))

    expect(onChange).toHaveBeenLastCalledWith('O síndico abriu a assembleia. O síndico leu a pauta. O síndico encerrou.')
    // O Ctrl+Z do navegador não desfaz uma alteração feita por código: sem este
    // botão, um "substituir tudo" errado custaria a revisão inteira.
    expect(screen.getByText('3 ocorrências substituídas.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(onChange).toHaveBeenLastCalledWith(TEXT)
  })

  it('treats the search term as text, never as a regular expression', async () => {
    const onChange = vi.fn()
    render(<Harness initial="Aprovado o rateio (art. 5º) por unanimidade." onChange={onChange} />)
    openSearchTools()

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: '(art. 5º)' } })
    expect(screen.getByText('1 de 1')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Substituir por'), { target: { value: '(artigo 5º)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))
    expect(onChange).toHaveBeenCalledWith('Aprovado o rateio (artigo 5º) por unanimidade.')
  })

  it('selects the next match on Enter', async () => {
    render(<Harness initial={TEXT} />)
    openSearchTools()

    const search = screen.getByLabelText('Localizar no texto')
    fireEvent.change(search, { target: { value: 'sindico' } })
    fireEvent.keyDown(search, { key: 'Enter' })

    expect(screen.getByText('2 de 3')).toBeInTheDocument()
    const editor = screen.getByLabelText('Texto da transcrição') as HTMLTextAreaElement
    expect(editor.selectionStart).toBe(TEXT.indexOf('sindico', 5))
  })

  it('allows finding and navigating matches while the text is read-only', () => {
    render(<Harness initial={TEXT} disabled />)
    openSearchTools()

    const search = screen.getByLabelText('Localizar no texto')
    const editor = screen.getByLabelText('Texto da transcrição') as HTMLTextAreaElement
    expect(search).toBeEnabled()
    expect(editor).toHaveAttribute('readonly')
    fireEvent.change(search, { target: { value: 'sindico' } })
    fireEvent.click(screen.getByRole('button', { name: 'Próxima ocorrência' }))

    expect(screen.getByText('2 de 3')).toBeInTheDocument()
    expect(editor).toHaveFocus()
    expect(editor.selectionStart).toBe(32)
    expect(editor.selectionEnd).toBe(39)

    fireEvent.click(screen.getByRole('button', { name: 'Ocorrência anterior' }))
    expect(screen.getByText('1 de 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Diferenciar maiúsculas de minúsculas' }))
    expect(screen.getByText('1 de 2')).toBeInTheDocument()
  })

  it('blocks replacements and direct text changes while read-only', () => {
    const onChange = vi.fn()
    render(<Harness initial={TEXT} onChange={onChange} disabled />)
    openSearchTools()
    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })

    expect(screen.getByLabelText('Substituir por')).toBeDisabled()
    const replace = screen.getByRole('button', { name: 'Substituir' })
    const replaceAll = screen.getByRole('button', { name: /Tudo/ })
    expect(replace).toBeDisabled()
    expect(replaceAll).toBeDisabled()
    fireEvent.click(replace)
    fireEvent.click(replaceAll)
    fireEvent.change(screen.getByLabelText('Texto da transcrição'), { target: { value: 'Texto alterado' } })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Texto da transcrição')).toHaveValue(TEXT)
  })

  it('blocks undo after an editable text becomes read-only', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Harness initial={TEXT} onChange={onChange} />)
    openSearchTools()
    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })
    fireEvent.change(screen.getByLabelText('Substituir por'), { target: { value: 'síndico' } })
    fireEvent.click(screen.getByRole('button', { name: /Tudo/ }))
    rerender(<Harness initial={TEXT} onChange={onChange} disabled />)
    const undo = screen.getByRole('button', { name: 'Desfazer' })
    expect(undo).toBeDisabled()
    fireEvent.click(undo)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Texto da transcrição')).toHaveValue('O síndico abriu a assembleia. O síndico leu a pauta. O síndico encerrou.')
  })
})
