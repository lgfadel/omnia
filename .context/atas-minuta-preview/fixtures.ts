import type { AtaMinuta, AtaMinutaDocument, AtaMinutaMessage, AtaMinutaVersion } from '@/data/types'

const date = '2026-10-02T12:00:00.000Z'
const state = new URLSearchParams(window.location.search).get('state') ?? 'preparation'
const initialInstruction = 'Use linguagem formal, organize por item da pauta e registre os resultados de cada votação.'

const initialContent = `## Abertura e composição da mesa
Aos dois dias do mês de outubro de dois mil e vinte e seis, às dezenove horas, reuniram-se no salão de festas os condôminos do Condomínio Jardim das Palmeiras, em Assembleia Geral Ordinária, convocada nos termos do edital previamente encaminhado.

Assumiu a presidência da mesa a senhora Marina Costa, que convidou o senhor Rafael Almeida para secretariar os trabalhos. Conferida a lista de presença, a presidente declarou aberta a assembleia em segunda convocação, conforme previsto no edital.

## Prestação de contas
A administração apresentou o demonstrativo das receitas e despesas do exercício, acompanhado dos comprovantes disponíveis aos presentes. Foram esclarecidas as dúvidas relativas à manutenção preventiva, aos contratos de prestação de serviços e à composição do fundo de reserva.

Após discussão, a prestação de contas foi colocada em votação e aprovada por maioria, com vinte e três votos favoráveis, dois contrários e uma abstenção. A documentação ficará disponível para consulta dos condôminos junto à administração.

## Previsão orçamentária
Foi apresentada a proposta de orçamento para o próximo exercício, considerando a continuidade dos serviços essenciais e o cronograma de manutenção aprovado. Os presentes discutiram os critérios de rateio e os impactos das medidas propostas.

A previsão orçamentária foi aprovada por maioria dos presentes. A administração comunicará os novos valores de contribuição e as datas de início da cobrança pelos canais oficiais do condomínio.

## Obras e manutenção
Os condôminos avaliaram as propostas para recuperação das áreas comuns. Ficou deliberado que a administração solicitará três orçamentos comparáveis para a reforma da iluminação, contemplando prazo de execução, garantia e especificação dos materiais.

A contratação dependerá da análise das propostas pelo conselho e da observância do limite orçamentário aprovado. O cronograma será comunicado aos moradores antes do início dos serviços, com atenção à segurança e ao acesso às unidades.

## Assuntos gerais
Os presentes registraram sugestões para melhorar a comunicação sobre as intervenções e organizar a utilização das áreas comuns. A administração se comprometeu a consolidar os pedidos e apresentar retorno por meio de comunicado aos condôminos.

## Encerramento
Nada mais havendo a tratar, a presidente encerrou a reunião às vinte e uma horas e quinze minutos. Para constar, foi lavrada a presente minuta, que será submetida à conferência da mesa e à assinatura dos responsáveis. A lista de presença e a apuração de votos integram os documentos de apoio da assembleia.`

const currentContent = initialContent.replace('A previsão orçamentária foi aprovada por maioria dos presentes.', 'A previsão orçamentária foi aprovada com vinte e quatro votos favoráveis e duas abstenções, conforme apuração anexada.')

let minuta: AtaMinuta | null = state === 'ready' ? { id: 'fixture-minuta', ataId: 'fixture-ata', content: currentContent, status: 'ready', createdAt: date, updatedAt: date } : null
let documents: AtaMinutaDocument[] = [
  { id: 'fixture-doc-1', ataId: 'fixture-ata', kind: 'convocacao', originalFilename: 'Convocação — Assembleia Geral Ordinária.pdf', sizeBytes: 34 * 1024 * 1024, createdAt: date },
  { id: 'fixture-doc-2', ataId: 'fixture-ata', kind: 'apuracao', originalFilename: 'Apuração de votos — itens da pauta.pdf', sizeBytes: 1.5 * 1024 * 1024, createdAt: date },
]
const versions: AtaMinutaVersion[] = [
  { id: 'fixture-version-1', minutaId: 'fixture-minuta', sequence: 0, origin: 'generation', content: initialContent, createdAt: date },
  { id: 'fixture-version-2', minutaId: 'fixture-minuta', sequence: 1, origin: 'chat', content: currentContent, createdAt: date },
]
const messages: AtaMinutaMessage[] = [
  { id: 'fixture-message-1', minutaId: 'fixture-minuta', sequence: 0, role: 'user', content: initialInstruction, createdAt: date },
  { id: 'fixture-message-2', minutaId: 'fixture-minuta', sequence: 1, role: 'assistant', content: initialContent, versionId: 'fixture-version-1', createdAt: date },
  { id: 'fixture-message-3', minutaId: 'fixture-minuta', sequence: 2, role: 'user', content: 'Inclua o resultado exato da votação da previsão orçamentária: 24 votos favoráveis e duas abstenções.', createdAt: date },
  { id: 'fixture-message-4', minutaId: 'fixture-minuta', sequence: 3, role: 'assistant', content: currentContent, versionId: 'fixture-version-2', createdAt: date },
]

export const ataMinutasRepoSupabase = {
  load: async () => ({ minuta, documents, versions: minuta ? versions : [], messages: minuta ? messages : [] }),
  uploadDocument: async (ataId: string, file: File, kind: AtaMinutaDocument['kind']) => {
    const document = { id: `fixture-upload-${documents.length}`, ataId, kind, originalFilename: file.name, sizeBytes: file.size, createdAt: date }
    documents = [document, ...documents]
    return document
  },
  deleteDocument: async (_ataId: string, documentId: string) => { documents = documents.filter((document) => document.id !== documentId) },
  saveManualEdit: async (ataId: string, content: string) => { minuta = { id: 'fixture-minuta', ataId, content, status: 'ready', createdAt: date, updatedAt: date } },
  streamTurn: async (_ataId: string, _instruction: string | undefined, onEvent: (event: { type: 'delta'; text: string }) => void) => {
    onEvent({ type: 'delta', text: currentContent })
    minuta = { id: 'fixture-minuta', ataId: 'fixture-ata', content: currentContent, status: 'ready', createdAt: date, updatedAt: date }
  },
}

export const ataTranscriptionsRepoSupabase = { load: async () => ({ job: null, transcription: { id: 'fixture-transcription', isReviewed: true } }) }
export const buildMinutaDocxBlob = async () => new Blob(['Visual QA fixture'])
export const downloadBlob = () => undefined
