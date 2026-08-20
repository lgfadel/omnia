import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AtaTranscriptionPanel } from '../AtaTranscriptionPanel'
import { ataTranscriptionsRepoSupabase } from '@/repositories/ataTranscriptionsRepo.supabase'

vi.mock('@/repositories/ataTranscriptionsRepo.supabase', () => ({
  ataTranscriptionsRepoSupabase: {
    load: vi.fn().mockResolvedValue({ job: null, transcription: null }),
    upload: vi.fn(),
    retry: vi.fn(),
    saveReview: vi.fn(),
    discard: vi.fn(),
    audioUrl: vi.fn().mockResolvedValue(null),
  },
}))

const repo = vi.mocked(ataTranscriptionsRepoSupabase)

function segment(id: string, startMs: number, endMs: number, text: string) {
  return { id, sequence: Number(id.split('-')[1]), startMs, endMs, text }
}

function transcriptionWith(revisedText?: string) {
  return {
    job: {
      id: 'job-1',
      ataId: 'ata-1',
      status: 'completed' as const,
      originalFilename: 'assembleia.m4a',
      attemptCount: 1,
      createdAt: new Date().toISOString(),
      processedChunks: 1,
    },
    transcription: {
      id: 'transcription-1',
      jobId: 'job-1',
      rawText: 'texto do áudio',
      revisedText,
      language: 'pt',
      isReviewed: false,
      segments: [
        segment('seg-1', 0, 5_000, 'abertura da assembleia'),
        segment('seg-2', 5_000, 12_000, 'aprovação das contas'),
      ],
    },
  }
}

describe('AtaTranscriptionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo.load.mockResolvedValue({ job: null, transcription: null })
    repo.audioUrl.mockResolvedValue(null)
  })

  it('explains the asynchronous upload flow before a recording is selected', async () => {
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    expect(await screen.findByText('Envie uma gravação de até 6 horas')).toBeInTheDocument()
    // O envio dispara na seleção do arquivo, sem botão de confirmar; a tela precisa
    // dizer isso, senão o usuário não sabe se algo começou.
    expect(screen.getByText(/O envio começa assim que você escolher o arquivo/)).toBeInTheDocument()
    expect(screen.getByText(/processamento continua mesmo se você sair desta tela/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar gravação' })).toBeInTheDocument()
  })

  it('offers the discard even when the text was never edited', async () => {
    // Uma transcrição intacta também pode ser a errada — áudio trocado, gravação
    // inútil — então descartar não pode depender de ter havido edição.
    repo.load.mockResolvedValue(transcriptionWith())
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    expect(await screen.findByRole('button', { name: 'Descartar transcrição' })).toBeEnabled()
  })

  it('discards the transcription only after the confirmation', async () => {
    repo.load.mockResolvedValue(transcriptionWith('texto revisado à mão'))
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar transcrição' }))
    // Um clique acidental não pode apagar uma revisão inteira de assembleia.
    expect(repo.discard).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(repo.discard).toHaveBeenCalledWith('job-1'))
  })

  it('returns the panel to the upload state after discarding', async () => {
    repo.load.mockResolvedValue(transcriptionWith('texto revisado à mão'))
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar transcrição' }))
    repo.load.mockResolvedValue({ job: null, transcription: null })
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }))

    expect(await screen.findByText('Envie uma gravação de até 6 horas')).toBeInTheDocument()
  })
})

describe('AtaTranscriptionPanel · conferência pelo áudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo.load.mockResolvedValue(transcriptionWith())
    repo.audioUrl.mockResolvedValue('https://storage.example/assembleia.m4a')
  })

  it('seeks the recording to the clicked excerpt', async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(play)
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Ouvir o trecho de 00:05–00:12' }))

    const player = document.querySelector('audio') as HTMLAudioElement
    expect(player.currentTime).toBe(5)
    expect(play).toHaveBeenCalled()
  })

  it('keeps the excerpts readable when the recording is gone', async () => {
    repo.audioUrl.mockResolvedValue(null)
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    expect(await screen.findByText(/gravação desta ata não está mais disponível/)).toBeInTheDocument()
    expect(screen.getByText('aprovação das contas')).toBeInTheDocument()
    expect(document.querySelector('audio')).toBeNull()
  })
})

describe('AtaTranscriptionPanel · download do texto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo.load.mockResolvedValue(transcriptionWith('texto revisado à mão'))
    repo.audioUrl.mockResolvedValue(null)
  })

  it('saves the text under the name of the recording it came from', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true, configurable: true })
    let downloadName = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download
    })

    render(<AtaTranscriptionPanel ataId="ata-1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Baixar \.txt/ }))

    // "transcricao.txt" numa pasta de downloads não diz de qual assembleia é.
    expect(downloadName).toBe('assembleia-transcricao.txt')
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })
})
