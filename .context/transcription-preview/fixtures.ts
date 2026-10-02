import type { AtaTranscription, AtaTranscriptionJob } from '@/data/types'

export interface ConvocacaoContext {
  text: string
  pages: number
  condominio?: string
  sindico?: string
  data?: string
  pautaItems: string[]
}

const state = new URLSearchParams(window.location.search).get('state') ?? 'empty'
const now = new Date().toISOString()
const rawText = `[00:00:12] Boa noite a todos. São dezenove horas e damos início à Assembleia Geral Ordinária do Condomínio Jardim das Palmeiras. Conferimos a lista de presença e há vinte e seis unidades representadas. A senhora Marina Costa assume a presidência da mesa e convida Rafael Almeida para secretariar os trabalhos.

[00:04:38] O primeiro item da pauta é a prestação de contas. A administração apresenta as receitas, as despesas e os comprovantes do exercício. O síndico esclarece os valores da manutenção preventiva e informa que o fundo de reserva permanece aplicado na conta do condomínio. Os moradores podem consultar a documentação completa junto à administração.

[00:18:06] Depois dos esclarecimentos, a presidente coloca as contas em votação. São vinte e três votos favoráveis, dois contrários e uma abstenção. A prestação de contas é aprovada por maioria. A unidade cento e dois solicita que a ata registre a sua abstenção e o pedido é acolhido pela mesa.

[00:32:45] Passamos à previsão orçamentária do próximo exercício. O síndico explica o cronograma de manutenção e os critérios de rateio. Após a discussão, a proposta é aprovada com vinte e quatro votos favoráveis e duas abstenções. A administração comunicará os novos valores e a data de início das cobranças aos moradores.

[00:48:20] Em relação às obras das áreas comuns, os presentes deliberam que serão solicitados três orçamentos para a recuperação da iluminação. Cada proposta deverá indicar os materiais, o prazo de execução e a garantia. O conselho acompanhará a análise e a contratação observará o limite do orçamento aprovado nesta assembleia.

[01:12:10] Nos assuntos gerais, os moradores pedem uma comunicação mais clara sobre as intervenções e os horários de uso do salão. A administração consolidará as sugestões em um comunicado. Nada mais havendo a tratar, a presidente encerra os trabalhos às vinte e uma horas e quinze minutos. A minuta será conferida pela mesa antes das assinaturas.`

function silenceWavUrl() {
  const samples = 8_000
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const write = (offset: number, text: string) => [...text].forEach((character, index) => { bytes[offset + index] = character.charCodeAt(0) })
  write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 8_000, true); view.setUint32(28, 16_000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  write(36, 'data'); view.setUint32(40, samples * 2, true)
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`
}

let job: AtaTranscriptionJob | null = state === 'empty' ? null : {
  id: 'fixture-job', ataId: 'fixture-ata', status: state === 'processing' ? 'processing' : 'completed',
  originalFilename: 'AGO-jardim.m4a', attemptCount: 1, createdAt: now, totalChunks: 4,
  processedChunks: state === 'processing' ? 1 : 4, stage: state === 'processing' ? 'transcribing' : 'saving', heartbeatAt: now,
}
let transcription: AtaTranscription | null = state === 'review' || state === 'reviewed' ? {
  id: 'fixture-transcription', jobId: 'fixture-job', rawText, revisedText: state === 'reviewed' ? rawText : undefined,
  language: 'pt', isReviewed: state === 'reviewed',
} : null

export const ataTranscriptionsRepoSupabase = {
  load: async () => ({ job: job ? { ...job } : null, transcription: transcription ? { ...transcription } : null }),
  upload: async (ataId: string, file: File, _durationSeconds: number | null, _contextText?: string) => {
    job = { id: 'fixture-job', ataId, status: 'queued', originalFilename: file.name, attemptCount: 0, createdAt: new Date().toISOString(), processedChunks: 0 }
    transcription = null
    return { jobId: job.id, workerAvailable: true }
  },
  retry: async (_jobId: string) => { if (job) job = { ...job, status: 'queued', createdAt: new Date().toISOString(), heartbeatAt: undefined }; return { workerAvailable: true } },
  wake: async (_jobId: string) => ({ workerAvailable: true, stalled: false }),
  saveReview: async (_transcriptionId: string, revisedText: string, isReviewed: boolean) => {
    if (!transcription) throw new Error('No fixture transcription to save')
    transcription = { ...transcription, revisedText, isReviewed }
  },
  audioUrl: async (_jobId: string) => silenceWavUrl(),
  discard: async (_jobId: string) => { job = null; transcription = null },
}

export const readConvocacao = async (_file: File): Promise<ConvocacaoContext> => ({
  text: 'Condomínio Jardim das Palmeiras. Síndico: Eduardo Ribeiro. Assembleia Geral Ordinária em 02/10/2026. Pauta: prestação de contas, previsão orçamentária, obras e assuntos gerais.',
  pages: 2, condominio: 'Condomínio Jardim das Palmeiras', sindico: 'Eduardo Ribeiro', data: '02/10/2026',
  pautaItems: ['Prestação de contas', 'Previsão orçamentária', 'Obras e manutenção', 'Assuntos gerais'],
})
