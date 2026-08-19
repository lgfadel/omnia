import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AtaTranscriptionPanel } from '../AtaTranscriptionPanel'

vi.mock('@/repositories/ataTranscriptionsRepo.supabase', () => ({
  ataTranscriptionsRepoSupabase: {
    load: vi.fn().mockResolvedValue({ job: null, transcription: null }),
    upload: vi.fn(),
    retry: vi.fn(),
    saveReview: vi.fn(),
    renameSpeaker: vi.fn(),
  },
}))

describe('AtaTranscriptionPanel', () => {
  it('explains the asynchronous upload flow before a recording is selected', async () => {
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    expect(await screen.findByText('Envie uma gravação de até 6 horas')).toBeInTheDocument()
    expect(screen.getByText(/O processamento continua mesmo se você sair desta tela/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar gravação' })).toBeInTheDocument()
  })
})
