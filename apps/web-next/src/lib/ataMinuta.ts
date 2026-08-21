export const MINUTA_DOCUMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024

export interface MinutaSection {
  title: string
  body: string
}

// O modelo devolve "## Título" seguido de parágrafos. Sem título nenhum (falha do
// modelo, ou texto ainda vazio) o texto inteiro vira uma seção sem nome, em vez de
// desaparecer da tela.
export function parseMinutaSections(content: string): MinutaSection[] {
  const lines = content.split('\n')
  const sections: MinutaSection[] = []
  let current: MinutaSection | null = null

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      current = { title: heading[1], body: '' }
      sections.push(current)
      continue
    }
    if (!current) {
      current = { title: '', body: '' }
      sections.push(current)
    }
    current.body += (current.body ? '\n' : '') + line
  }

  return sections.map((section) => ({ title: section.title, body: section.body.trim() })).filter((section) => section.title || section.body)
}

export interface SectionDiff {
  changedTitles: string[]
  unchangedCount: number
}

// A bolha do chat não pode citar o que o modelo diz que mudou — só o que
// efetivamente mudou. Comparar por título casa seções mesmo quando o corpo
// inteiro foi reescrito, e uma seção nova (sem título correspondente no lado
// anterior) também conta como alterada.
export function diffMinutaSections(before: string, after: string): SectionDiff {
  const beforeSections = new Map(parseMinutaSections(before).map((section) => [section.title, section.body]))
  const afterSections = parseMinutaSections(after)

  const changedTitles: string[] = []
  let unchangedCount = 0

  for (const section of afterSections) {
    const previousBody = beforeSections.get(section.title)
    if (previousBody === undefined || previousBody !== section.body) {
      changedTitles.push(section.title || 'Seção sem título')
    } else {
      unchangedCount += 1
    }
  }

  return { changedTitles, unchangedCount }
}

export function getMinutaDocumentValidationError(file: { name: string; type: string; size: number }): string | null {
  const isPdf = file.type.toLowerCase() === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    return 'Formato não suportado. Envie um PDF.'
  }
  if (file.size <= 0) {
    return 'Este arquivo está vazio.'
  }
  if (file.size > MINUTA_DOCUMENT_MAX_SIZE_BYTES) {
    return 'O arquivo ultrapassa o limite de 25 MB.'
  }
  return null
}

// Mesmo predicado das policies de RLS da migration: ADMIN/SECRETARIO acessam
// qualquer ata, o responsável acessa a própria. Fica em código puro para não
// precisar de um banco em teste só para verificar essa regra.
export function canAccessMinuta(user: { roles: string[]; omniaUserId: string }, ata: { responsibleId: string | null }): boolean {
  return user.roles.includes('ADMIN') || user.roles.includes('SECRETARIO') || ata.responsibleId === user.omniaUserId
}

export type AtaMinutaStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; content: string }
  | { type: 'error'; message: string }

export interface MinutaDocumentInput {
  originalFilename: string
  base64: string
}

export interface MinutaGenerationContext {
  ataTitle: string
  condominiumName?: string
  meetingDate?: string
  transcriptionText: string
  convocacaoContextText?: string
  documents: MinutaDocumentInput[]
}

export interface MinutaRefinementContext extends MinutaGenerationContext {
  currentContent: string
  priorInstructions: string[]
  instruction: string
}

interface ResponsesTextPart {
  type: 'input_text' | 'output_text'
  text: string
}

interface ResponsesFilePart {
  type: 'input_file'
  filename: string
  file_data: string
}

export interface ResponsesInputMessage {
  role: 'developer' | 'user' | 'assistant'
  content: Array<ResponsesTextPart | ResponsesFilePart>
}

function buildContextMessage(context: MinutaGenerationContext): ResponsesInputMessage {
  const header = [
    `Ata: ${context.ataTitle}`,
    context.condominiumName ? `Condomínio: ${context.condominiumName}` : null,
    context.meetingDate ? `Data da assembleia: ${context.meetingDate}` : null,
  ].filter(Boolean).join('\n')

  const parts: Array<ResponsesTextPart | ResponsesFilePart> = [
    { type: 'input_text', text: `${header}\n\nTranscrição da assembleia:\n${context.transcriptionText}` },
  ]

  if (context.convocacaoContextText) {
    parts.push({ type: 'input_text', text: `Convocação da assembleia:\n${context.convocacaoContextText}` })
  }

  for (const document of context.documents) {
    parts.push({
      type: 'input_file',
      filename: document.originalFilename,
      file_data: `data:application/pdf;base64,${document.base64}`,
    })
  }

  return { role: 'user', content: parts }
}

// A geração inicial manda só o contexto: transcrição, convocação e PDFs de apoio. Um
// turno de refinamento reenvia o mesmo contexto e acrescenta a minuta ATUAL vinda do
// banco (não a última resposta do modelo) como se fosse a fala anterior do assistente —
// assim uma edição manual feita entre dois turnos do chat é respeitada, e não descartada
// pelo histórico da conversa.
export function buildMinutaResponsesInput(systemPrompt: string, context: MinutaGenerationContext | MinutaRefinementContext): ResponsesInputMessage[] {
  const messages: ResponsesInputMessage[] = [
    { role: 'developer', content: [{ type: 'input_text', text: systemPrompt }] },
    buildContextMessage(context),
  ]

  if (!('instruction' in context)) return messages

  messages.push({ role: 'assistant', content: [{ type: 'output_text', text: context.currentContent }] })

  if (context.priorInstructions.length > 0) {
    const history = context.priorInstructions.map((text, index) => `${index + 1}. ${text}`).join('\n')
    messages.push({ role: 'user', content: [{ type: 'input_text', text: `Instruções já aplicadas nesta revisão:\n${history}` }] })
  }

  messages.push({
    role: 'user',
    content: [{
      type: 'input_text',
      text: `Aplique esta instrução à minuta acima e devolva a minuta inteira revisada, no mesmo formato de seções ("## Título" seguido de parágrafos): ${context.instruction}`,
    }],
  })

  return messages
}
