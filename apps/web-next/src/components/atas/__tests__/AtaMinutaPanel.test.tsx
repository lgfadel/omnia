import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AtaMinutaPanel } from '../AtaMinutaPanel'

const repository = vi.hoisted(() => ({
  load: vi.fn(), streamTurn: vi.fn(), saveManualEdit: vi.fn(), uploadDocument: vi.fn(), deleteDocument: vi.fn(),
}))
const transcription = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('@/repositories/ataMinutasRepo.supabase', () => ({ ataMinutasRepoSupabase: repository }))
vi.mock('@/repositories/ataTranscriptionsRepo.supabase', () => ({ ataTranscriptionsRepoSupabase: transcription }))
vi.mock('@/lib/ataMinutaDocx', () => ({ buildMinutaDocxBlob: vi.fn(), downloadBlob: vi.fn() }))

const CONVOCACAO_AGO = `A ASSOCIAÇÃO RECREATIVA ÁGUA DA PRATA, localizada na Rod. Alvaro Luiz, Km 26, está CONVOCANDO
todos os associados para a ASSEMBLEIA GERAL ORDINÁRIA que será realizada no dia 08/10/2026, nas dependências
do Salão do Campo Suíço do Neno, para deliberação dos seguintes assuntos em Pauta:
1) PRESTAÇÃO DE CONTAS DA GESTÃO NOVEMBRO/2025 A SETEMBRO/2026;
2) ELEIÇÃO DA NOVA DIRETORIA EXECUTIVA E CONSELHO FISCAL;
Londrina, 28 de setembro de 2026.
Claudio Alves Ferreira
Presidente`

const empty = { minuta: null, versions: [], messages: [], documents: [] }

describe('AtaMinutaPanel preparation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    repository.load.mockResolvedValue(empty)
    repository.streamTurn.mockResolvedValue(undefined)
    transcription.load.mockResolvedValue({ transcription: { isReviewed: true } })
  })

  it('sends initial instructions with the first generation', async () => {
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" />)
    const field = await screen.findByLabelText('Instruções iniciais para o agente')
    fireEvent.change(field, { target: { value: '  Use linguagem formal e destaque as votações.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar primeira minuta' }))
    await waitFor(() => expect(repository.streamTurn).toHaveBeenCalledWith('ata-1', 'Use linguagem formal e destaque as votações.', expect.any(Function)))
  })

  it('allows a first generation without optional instructions', async () => {
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar primeira minuta' }))
    await waitFor(() => expect(repository.streamTurn).toHaveBeenCalledWith('ata-1', undefined, expect.any(Function)))
  })

  it('explains the missing transcription and opens that step without generating', async () => {
    transcription.load.mockResolvedValue({ transcription: null })
    const onOpenTranscription = vi.fn()
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" onOpenTranscription={onOpenTranscription} />)
    expect(await screen.findByRole('button', { name: 'Gerar primeira minuta' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ir para transcrição' }))
    expect(onOpenTranscription).toHaveBeenCalledOnce()
    expect(repository.streamTurn).not.toHaveBeenCalled()
  })

  it('keeps the stream error and initial instructions after a successful refresh', async () => {
    repository.streamTurn.mockRejectedValue(new Error('O agente está indisponível.'))
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" />)
    const field = await screen.findByLabelText('Instruções iniciais para o agente')
    fireEvent.change(field, { target: { value: 'Preserve os nomes completos.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar primeira minuta' }))
    expect(await screen.findByText('O agente está indisponível.')).toBeInTheDocument()
    expect(screen.getByLabelText('Instruções iniciais para o agente')).toHaveValue('Preserve os nomes completos.')
  })

  it('lets an empty failed first attempt retry with its saved instructions', async () => {
    repository.load.mockResolvedValue({ ...empty, minuta: {
      id: 'minuta-1', ataId: 'ata-1', status: 'failed', content: '', errorMessage: 'Falha temporária',
      createdAt: '2026-10-02T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z',
    }, messages: [{ id: 'message-1', minutaId: 'minuta-1', sequence: 0, role: 'user', content: 'Cite o quórum.', createdAt: '2026-10-02T10:00:00Z' }] })
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" />)
    expect(await screen.findByLabelText('Instruções iniciais para o agente')).toHaveValue('Cite o quórum.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar gerar novamente' }))
    await waitFor(() => expect(repository.streamTurn).toHaveBeenCalledWith('ata-1', 'Cite o quórum.', expect.any(Function)))
  })

  it('waits for a supporting document upload before enabling generation', async () => {
    let finishUpload!: () => void
    repository.uploadDocument.mockImplementation(() => new Promise(resolve => { finishUpload = () => resolve({ id: 'doc-1', kind: 'convocacao', originalFilename: 'pauta.pdf', sizeBytes: 100 }) }))
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" />)
    const generate = await screen.findByRole('button', { name: 'Gerar primeira minuta' })
    fireEvent.change(screen.getByLabelText('PDF de apoio'), { target: { files: [new File(['pdf'], 'pauta.pdf', { type: 'application/pdf' })] } })
    expect(generate).toBeDisabled()
    finishUpload()
    await waitFor(() => expect(generate).toBeEnabled())
    expect(screen.getByText('pauta.pdf')).toBeInTheDocument()
  })

  it('allows removing saved initial instructions before retrying an empty draft', async () => {
    repository.load.mockResolvedValue({ ...empty, minuta: {
      id: 'minuta-1', ataId: 'ata-1', status: 'failed', content: '',
      createdAt: '2026-10-02T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z',
    }, messages: [{ id: 'message-1', minutaId: 'minuta-1', sequence: 0, role: 'user', content: 'Orientação antiga.', createdAt: '2026-10-02T10:00:00Z' }] })
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" />)
    const field = await screen.findByLabelText('Instruções iniciais para o agente')
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar gerar novamente' }))
    await waitFor(() => expect(repository.streamTurn).toHaveBeenCalledWith('ata-1', '', expect.any(Function)))
  })
  it('shows the convocação already read during the transcription, so it need not be uploaded again', async () => {
    transcription.load.mockResolvedValue({
      transcription: { isReviewed: true },
      job: { id: 'job-1', convocacaoText: CONVOCACAO_AGO },
    })
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" />)

    expect(await screen.findByText('Convocação lida na transcrição')).toBeInTheDocument()
    expect(screen.getByText(/ASSOCIAÇÃO RECREATIVA ÁGUA DA PRATA/)).toBeInTheDocument()
    expect(screen.getByText(/08\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText('2 itens de pauta')).toBeInTheDocument()
    expect(screen.getByText(/não precisa enviar de novo/i)).toBeInTheDocument()
  })

  it('does not claim a convocação when the transcription had none', async () => {
    transcription.load.mockResolvedValue({ transcription: { isReviewed: true }, job: { id: 'job-1' } })
    render(<AtaMinutaPanel ataId="ata-1" ataTitle="Assembleia" />)

    await screen.findByRole('button', { name: 'Gerar primeira minuta' })
    expect(screen.queryByText('Convocação lida na transcrição')).not.toBeInTheDocument()
  })
})
