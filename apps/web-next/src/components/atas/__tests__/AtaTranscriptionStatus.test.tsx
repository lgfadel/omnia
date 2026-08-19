import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AtaTranscriptionStatus } from '../AtaTranscriptionStatus'

describe('AtaTranscriptionStatus', () => {
  it('makes it clear that a queued transcription continues in background', () => {
    render(<AtaTranscriptionStatus status="queued" />)

    expect(screen.getByText('Na fila')).toBeInTheDocument()
    expect(screen.getByText('Você pode continuar usando o Omnia enquanto processamos a gravação.')).toBeInTheDocument()
  })
})
