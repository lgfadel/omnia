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
    // O envio dispara na seleção do arquivo, sem botão de confirmar; a tela precisa
    // dizer isso, senão o usuário não sabe se algo começou.
    expect(screen.getByText(/O envio começa assim que você escolher o arquivo/)).toBeInTheDocument()
    expect(screen.getByText(/processamento continua mesmo se você sair desta tela/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar gravação' })).toBeInTheDocument()
  })
})
