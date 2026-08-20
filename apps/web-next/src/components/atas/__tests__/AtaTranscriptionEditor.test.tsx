import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { AtaTranscriptionEditor } from '../AtaTranscriptionEditor'

function Harness({ initial, onChange }: { initial: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <AtaTranscriptionEditor
      value={value}
      onChange={(next) => { setValue(next); onChange?.(next) }}
    />
  )
}

const TEXT = 'O sindico abriu a assembleia. O sindico leu a pauta. O SINDICO encerrou.'

describe('AtaTranscriptionEditor', () => {
  it('counts every occurrence, ignoring case by default', async () => {
    render(<Harness initial={TEXT} />)

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })

    expect(screen.getByText('1 de 3')).toBeInTheDocument()
  })

  it('respects case sensitivity when asked', async () => {
    render(<Harness initial={TEXT} />)

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })
    fireEvent.click(screen.getByLabelText('Diferenciar maiúsculas de minúsculas'))

    expect(screen.getByText('1 de 2')).toBeInTheDocument()
  })

  it('replaces a single occurrence without touching the others', async () => {
    const onChange = vi.fn()
    render(<Harness initial={TEXT} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: 'sindico' } })
    fireEvent.change(screen.getByLabelText('Substituir por'), { target: { value: 'síndico' } })
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    expect(onChange).toHaveBeenCalledWith('O síndico abriu a assembleia. O sindico leu a pauta. O SINDICO encerrou.')
  })

  it('replaces every occurrence and offers to undo it', async () => {
    const onChange = vi.fn()
    render(<Harness initial={TEXT} onChange={onChange} />)

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

    fireEvent.change(screen.getByLabelText('Localizar no texto'), { target: { value: '(art. 5º)' } })
    expect(screen.getByText('1 de 1')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Substituir por'), { target: { value: '(artigo 5º)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))
    expect(onChange).toHaveBeenCalledWith('Aprovado o rateio (artigo 5º) por unanimidade.')
  })

  it('selects the next match on Enter', async () => {
    render(<Harness initial={TEXT} />)

    const search = screen.getByLabelText('Localizar no texto')
    fireEvent.change(search, { target: { value: 'sindico' } })
    fireEvent.keyDown(search, { key: 'Enter' })

    expect(screen.getByText('2 de 3')).toBeInTheDocument()
    const editor = screen.getByLabelText('Texto da transcrição') as HTMLTextAreaElement
    expect(editor.selectionStart).toBe(TEXT.indexOf('sindico', 5))
  })
})
