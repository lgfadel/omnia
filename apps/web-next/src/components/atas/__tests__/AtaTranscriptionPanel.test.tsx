import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AtaTranscriptionPanel } from '../AtaTranscriptionPanel'
import { ataTranscriptionsRepoSupabase } from '@/repositories/ataTranscriptionsRepo.supabase'

vi.mock('@/repositories/ataTranscriptionsRepo.supabase', () => ({
  ataTranscriptionsRepoSupabase: {
    load: vi.fn().mockResolvedValue({ job: null, transcription: null }),
    upload: vi.fn(),
    retry: vi.fn(),
    wake: vi.fn().mockResolvedValue({ workerAvailable: true, stalled: false }),
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

  it('continues uploading when the browser never responds with audio metadata', async () => {
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
    const revoke = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn().mockReturnValue('blob:assembleia'), writable: true, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, writable: true, configurable: true })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'src', { set() {}, configurable: true })
      const file = new File(['audio'], 'assembleia.m4a', { type: 'audio/mp4' })
      repo.load.mockResolvedValue({ job: null, transcription: null })
      repo.upload.mockResolvedValue({ jobId: 'job-1', workerAvailable: true })
      render(<AtaTranscriptionPanel ataId="ata-1" />)
      await screen.findByRole('button', { name: 'Selecionar gravação' })
      fireEvent.change(document.querySelector('input[type="file"][accept*="audio"]')!, { target: { files: [file] } })
      expect(screen.getByRole('button', { name: 'Selecionar gravação' })).toBeDisabled()
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(repo.upload).toHaveBeenCalledWith('ata-1', file, null, undefined)
      expect(revoke).toHaveBeenCalledWith('blob:assembleia')
      expect(screen.getByRole('button', { name: 'Selecionar gravação' })).toBeEnabled()
    } finally {
      vi.useRealTimers()
      if (srcDescriptor) Object.defineProperty(HTMLMediaElement.prototype, 'src', srcDescriptor)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'src')
    }
  })

  it('sends a supported M4A with an unknown browser duration to the worker', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:assembleia')
    const durationDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true, configurable: true })
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => Number.NaN, configurable: true })
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        set() {
          queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')))
        },
        configurable: true,
      })
      const file = new File(['audio'], 'assembleia.m4a', { type: 'audio/mp4' })

      repo.load.mockResolvedValue({ job: null, transcription: null })
      render(<AtaTranscriptionPanel ataId="ata-1" />)

      const audioInput = await screen.findByRole('button', { name: 'Selecionar gravação' })
      fireEvent.change(document.querySelector('input[type="file"][accept*="audio"]')!, { target: { files: [file] } })

      await waitFor(() => expect(repo.upload).toHaveBeenCalledWith('ata-1', file, null, undefined))
      expect(audioInput).toBeInTheDocument()
    } finally {
      if (durationDescriptor) Object.defineProperty(HTMLMediaElement.prototype, 'duration', durationDescriptor)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'duration')
      if (srcDescriptor) Object.defineProperty(HTMLMediaElement.prototype, 'src', srcDescriptor)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'src')
    }
  })

  it('sends a supported M4A when the browser cannot open its metadata', async () => {
    const durationDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn().mockReturnValue('blob:assembleia'), writable: true, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true, configurable: true })
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        set() {
          queueMicrotask(() => this.dispatchEvent(new Event('error')))
        },
        configurable: true,
      })
      const file = new File(['audio'], 'assembleia.m4a', { type: 'audio/mp4' })

      repo.load.mockResolvedValue({ job: null, transcription: null })
      render(<AtaTranscriptionPanel ataId="ata-1" />)

      await screen.findByRole('button', { name: 'Selecionar gravação' })
      const fileInput = document.querySelector('input[type="file"][accept*="audio"]')
      expect(fileInput).not.toBeNull()
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => expect(repo.upload).toHaveBeenCalledWith('ata-1', file, null, undefined))
    } finally {
      if (durationDescriptor) Object.defineProperty(HTMLMediaElement.prototype, 'duration', durationDescriptor)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'duration')
      if (srcDescriptor) Object.defineProperty(HTMLMediaElement.prototype, 'src', srcDescriptor)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'src')
    }
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
    expect(screen.getByLabelText('Texto da transcrição')).toHaveAttribute('readonly')
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

describe('AtaTranscriptionPanel · workspace actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo.load.mockResolvedValue(transcriptionWith())
    repo.audioUrl.mockResolvedValue(null)
    repo.saveReview.mockResolvedValue(undefined)
  })

  it('saves dirty text before opening the minuta', async () => {
    const onGenerateMinuta = vi.fn()
    let finishSave!: () => void
    repo.saveReview.mockImplementation(() => new Promise(resolve => { finishSave = resolve }))
    render(<AtaTranscriptionPanel ataId="ata-1" onGenerateMinuta={onGenerateMinuta} />)
    fireEvent.change(await screen.findByLabelText('Texto da transcrição'), { target: { value: 'Nome corrigido e votação conferida.' } })
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e preparar minuta' }))
    expect(repo.saveReview).toHaveBeenCalledWith('transcription-1', 'Nome corrigido e votação conferida.', false)
    expect(onGenerateMinuta).not.toHaveBeenCalled()
    await act(async () => finishSave())
    expect(onGenerateMinuta).toHaveBeenCalledOnce()
  })

  it('keeps dirty text and stays on transcription if saving before the minuta fails', async () => {
    const onGenerateMinuta = vi.fn()
    repo.saveReview.mockRejectedValue(new Error('Falha ao salvar'))
    render(<AtaTranscriptionPanel ataId="ata-1" onGenerateMinuta={onGenerateMinuta} />)
    fireEvent.change(await screen.findByLabelText('Texto da transcrição'), { target: { value: 'Texto corrigido.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e preparar minuta' }))
    expect(await screen.findByText('Não foi possível salvar a revisão.')).toBeInTheDocument()
    expect(screen.getByLabelText('Texto da transcrição')).toHaveValue('Texto corrigido.')
    expect(onGenerateMinuta).not.toHaveBeenCalled()
  })

  it('does not permit closing an empty review', async () => {
    render(<AtaTranscriptionPanel ataId="ata-1" />)
    fireEvent.change(await screen.findByLabelText('Texto da transcrição'), { target: { value: '  ' } })
    expect(screen.getByRole('button', { name: 'Marcar como revisada' })).toBeDisabled()
    expect(repo.saveReview).not.toHaveBeenCalled()
  })

  it('offers a retry when loading the recording fails without blocking text editing', async () => {
    repo.audioUrl.mockRejectedValueOnce(new Error('URL temporariamente indisponível'))
    render(<AtaTranscriptionPanel ataId="ata-1" />)
    const retry = await screen.findByRole('button', { name: 'Carregar áudio novamente' })
    expect(screen.getByLabelText('Texto da transcrição')).not.toHaveAttribute('readonly')
    repo.audioUrl.mockResolvedValue('https://storage.example/assembleia.m4a')
    fireEvent.click(retry)
    await waitFor(() => expect(document.querySelector('audio')).not.toBeNull())
    expect(repo.audioUrl).toHaveBeenCalledTimes(2)
  })

  it('shows progress in the processing stage with no edit or replacement actions', async () => {
    repo.load.mockResolvedValue({
      job: { ...transcriptionWith().job, status: 'processing', stage: 'transcribing', totalChunks: 4, processedChunks: 1, heartbeatAt: new Date().toISOString() },
      transcription: null,
    })
    render(<AtaTranscriptionPanel ataId="ata-1" />)
    expect(await screen.findByText('Transcrevendo bloco 2 de 4')).toBeInTheDocument()
    expect(screen.getByLabelText('Etapas da transcrição')).toBeInTheDocument()
    expect(screen.queryByLabelText('Texto da transcrição')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar nova gravação' })).not.toBeInTheDocument()
  })

  it('ignores an older poll that arrives after review and editing have started', async () => {
    const processing = { job: { ...transcriptionWith().job, status: 'processing' as const, heartbeatAt: new Date().toISOString() }, transcription: null }
    let finishOldPoll!: (data: typeof processing) => void
    repo.load.mockResolvedValueOnce(processing)
      .mockImplementationOnce(() => new Promise((resolve) => { finishOldPoll = resolve }))
      .mockResolvedValueOnce(transcriptionWith())
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<AtaTranscriptionPanel ataId="ata-1" />)
      await screen.findByText('assembleia.m4a')
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
      fireEvent.change(screen.getByLabelText('Texto da transcrição'), { target: { value: 'Correção que deve ser preservada.' } })
      await act(async () => { finishOldPoll(processing) })
      expect(screen.getByLabelText('Texto da transcrição')).toHaveValue('Correção que deve ser preservada.')
      expect(screen.getByText('Alterações não salvas')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('AtaTranscriptionPanel · worker fora do ar', () => {
  function queuedJob(ageMs: number) {
    return {
      job: {
        id: 'job-1',
        ataId: 'ata-1',
        status: 'queued' as const,
        originalFilename: 'assembleia.m4a',
        attemptCount: 1,
        createdAt: new Date(Date.now() - ageMs).toISOString(),
        processedChunks: 0,
      },
      transcription: null,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repo.audioUrl.mockResolvedValue(null)
  })

  it('warns that the recording is safe when nobody answers for a job stuck in the queue', async () => {
    repo.load.mockResolvedValue(queuedJob(5 * 60_000))
    repo.wake.mockResolvedValue({ workerAvailable: false, stalled: false })
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    expect(await screen.findByText('O serviço de transcrição está fora do ar')).toBeInTheDocument()
    expect(screen.getByText(/não é preciso enviar de novo/)).toBeInTheDocument()
    expect(repo.wake).toHaveBeenCalledWith('job-1')
  })

  it('stays quiet when the worker answers the wake', async () => {
    repo.load.mockResolvedValue(queuedJob(5 * 60_000))
    repo.wake.mockResolvedValue({ workerAvailable: true, stalled: false })
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    await waitFor(() => expect(repo.wake).toHaveBeenCalledWith('job-1'))
    expect(screen.queryByText('O serviço de transcrição está fora do ar')).not.toBeInTheDocument()
  })

  // O upload acabou de acordar o worker; perguntar de novo no mesmo segundo só
  // duplicaria a chamada.
  it('does not check a job that has only just entered the queue', async () => {
    repo.load.mockResolvedValue(queuedJob(5_000))
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    await screen.findByText('assembleia.m4a')
    expect(repo.wake).not.toHaveBeenCalled()
  })

  function processingJob(silentMs: number) {
    const job = queuedJob(60 * 60_000).job
    return {
      job: { ...job, status: 'processing' as const, stage: 'splitting' as const, heartbeatAt: new Date(Date.now() - silentMs).toISOString() },
      transcription: null,
    }
  }

  // Foi o que aconteceu com a Evidence em 23/09/2026: o container morreu no meio
  // do job e a tela ficou em "Preparando o áudio" sem erro nenhum.
  it('wakes the worker and says the job is being resumed when processing stops sending signs of life', async () => {
    repo.load.mockResolvedValue(processingJob(6 * 60_000))
    repo.wake.mockResolvedValue({ workerAvailable: true, stalled: true })
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    expect(await screen.findByText('O processamento foi interrompido')).toBeInTheDocument()
    expect(screen.getByText(/retomada automaticamente/)).toBeInTheDocument()
    expect(repo.wake).toHaveBeenCalledWith('job-1')
  })

  it('leaves a job that is still sending signs of life alone', async () => {
    repo.load.mockResolvedValue(processingJob(30_000))
    render(<AtaTranscriptionPanel ataId="ata-1" />)

    await screen.findByText('assembleia.m4a')
    expect(repo.wake).not.toHaveBeenCalled()
  })

  // A mesma tela, sem remontar: o sinal de vida novo chega pelo polling.
  it('drops the warning as soon as the polled job sends a new sign of life', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      repo.load.mockResolvedValue(processingJob(6 * 60_000))
      repo.wake.mockResolvedValue({ workerAvailable: true, stalled: true })
      render(<AtaTranscriptionPanel ataId="ata-1" />)
      await screen.findByText('O processamento foi interrompido')

      repo.load.mockResolvedValue(processingJob(0))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000)
      })

      expect(screen.queryByText('O processamento foi interrompido')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
