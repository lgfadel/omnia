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

function transcriptionWith(revisedText?: string, isReviewed = false) {
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
      isReviewed,
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

describe('AtaTranscriptionPanel · gravação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo.load.mockResolvedValue(transcriptionWith())
  })

  it('offers the recording while the text is being corrected', async () => {
    repo.audioUrl.mockResolvedValue('https://storage.example/assembleia.m4a')
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    expect(await screen.findByText('Gravação original')).toBeInTheDocument()
    expect(document.querySelector('audio')).not.toBeNull()
  })

  it('says nothing about a recording that no longer exists', async () => {
    repo.audioUrl.mockResolvedValue(null)
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    await screen.findByRole('button', { name: 'Descartar transcrição' })
    expect(screen.queryByText('Gravação original')).toBeNull()
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

describe('AtaTranscriptionPanel · estado da revisão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo.audioUrl.mockResolvedValue(null)
  })

  it('shows the review is closed and drops the actions that no longer apply', async () => {
    repo.load.mockResolvedValue(transcriptionWith('texto revisado à mão', true))
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    // A revisão é anunciada uma única vez, no cabeçalho: antes o selo do topo
    // dizia "Pronta para revisão" enquanto o de baixo já dizia "Revisada", e a
    // mesma tela se contradizia.
    expect(await screen.findByText('Revisado')).toBeInTheDocument()
    expect(screen.queryByText('Pronta para revisão')).toBeNull()
    expect(screen.queryByText('Revisada')).toBeNull()
    // Marcar de novo o que já está revisado, ou salvar rascunho de um texto
    // fechado, são botões que só confundem quem terminou a revisão.
    expect(screen.queryByRole('button', { name: 'Marcar como revisada' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull()
    expect(screen.getByRole('button', { name: /Baixar \.txt/ })).toBeEnabled()
    expect(screen.getByLabelText('Texto da transcrição')).toBeDisabled()
  })

  it('reopens a closed review for editing', async () => {
    repo.load.mockResolvedValue(transcriptionWith('texto revisado à mão', true))
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir para edição' }))

    await waitFor(() => expect(repo.saveReview).toHaveBeenCalledWith('transcription-1', 'texto revisado à mão', false))
  })

  it('surfaces a review that the database refused to store', async () => {
    repo.load.mockResolvedValue(transcriptionWith())
    repo.saveReview.mockRejectedValue(new Error('sem permissão'))
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como revisada' }))

    // O pior desfecho possível é o botão piscar e a revisão não existir.
    expect(await screen.findByText('Não foi possível salvar a revisão.')).toBeInTheDocument()
  })
})
