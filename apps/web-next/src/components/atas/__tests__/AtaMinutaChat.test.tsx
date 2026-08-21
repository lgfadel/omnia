import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AtaMinutaChat } from '../AtaMinutaChat'
import type { AtaMinutaMessage } from '@/data/types'

const initialContent = '## Prestação de contas\nTexto original.\n\n## Eleição\nOutro texto.'

function message(overrides: Partial<AtaMinutaMessage>): AtaMinutaMessage {
  return {
    id: 'm1',
    minutaId: 'minuta-1',
    sequence: 0,
    role: 'user',
    content: '',
    createdAt: '2026-08-20T10:00:00Z',
    ...overrides,
  }
}

describe('AtaMinutaChat', () => {
  it('shows the user instruction verbatim', () => {
    render(<AtaMinutaChat messages={[message({ role: 'user', content: 'Corrija o nome do síndico.' })]} initialContent={initialContent} isSending={false} onSend={vi.fn()} />)

    expect(screen.getByText('Corrija o nome do síndico.')).toBeInTheDocument()
  })

  it('names only the sections that actually changed in the assistant bubble, not model-authored text', () => {
    const messages: AtaMinutaMessage[] = [
      message({ id: 'm1', sequence: 0, role: 'user', content: 'Remova valores da seção de eleição.' }),
      message({
        id: 'm2',
        sequence: 1,
        role: 'assistant',
        content: '## Prestação de contas\nTexto original.\n\n## Eleição\nTexto sem valores.',
      }),
    ]
    render(<AtaMinutaChat messages={messages} initialContent={initialContent} isSending={false} onSend={vi.fn()} />)

    expect(screen.getByText('Seção alterada: Eleição.')).toBeInTheDocument()
  })

  it('sends the trimmed instruction and clears the input', () => {
    const onSend = vi.fn()
    render(<AtaMinutaChat messages={[]} initialContent={initialContent} isSending={false} onSend={onSend} />)

    const textarea = screen.getByLabelText('Instrução para a minuta')
    fireEvent.change(textarea, { target: { value: '  Deixe mais formal.  ' } })
    fireEvent.click(screen.getByLabelText('Enviar instrução'))

    expect(onSend).toHaveBeenCalledWith('Deixe mais formal.')
    expect(textarea).toHaveValue('')
  })

  it('does not send an empty instruction', () => {
    const onSend = vi.fn()
    render(<AtaMinutaChat messages={[]} initialContent={initialContent} isSending={false} onSend={onSend} />)

    fireEvent.click(screen.getByLabelText('Enviar instrução'))

    expect(onSend).not.toHaveBeenCalled()
  })
})
