import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AtaTranscriptionStatus } from '../AtaTranscriptionStatus'

describe('AtaTranscriptionStatus', () => {
  it('announces the review instead of still asking for it once the text is closed', () => {
    render(<AtaTranscriptionStatus status="completed" isReviewed />)

    expect(screen.getByText('Revisado')).toBeInTheDocument()
    expect(screen.queryByText('Pronta para revisão')).toBeNull()
  })

  it('keeps asking for review while nobody has closed the text', () => {
    render(<AtaTranscriptionStatus status="completed" />)

    expect(screen.getByText('Pronta para revisão')).toBeInTheDocument()
  })

  it('makes it clear that a queued transcription continues in background', () => {
    render(<AtaTranscriptionStatus status="queued" />)

    expect(screen.getByText('Na fila')).toBeInTheDocument()
    expect(screen.getByText('Você pode continuar usando o Omnia enquanto processamos a gravação.')).toBeInTheDocument()
  })
})
