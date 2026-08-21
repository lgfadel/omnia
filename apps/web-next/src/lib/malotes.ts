export const MALOTE_MAX_FILE_SIZE_BYTES = 18 * 1024 * 1024
export const MALOTE_MAX_FILES_PER_BATCH = 20
export const MALOTE_DEFAULT_CONTENT_TYPE = 'application/octet-stream'

export type MaloteTemplateContext = {
  condominium: string
  fileName: string
  sentAt: Date
}

export type MaloteFileInput = { name: string; size: number; type?: string | null }

export type MaloteSendResult = { itemId: string; status: string; error?: string }

export type MaloteSendEvent =
  | { type: 'start'; total: number }
  | { type: 'item'; itemId: string; fileName: string; status: string; error?: string }
  | { type: 'done'; batchId: string; results: MaloteSendResult[] }
  | { type: 'error'; message: string }

export type MaloteItemStatus = 'pending' | 'uploaded' | 'sending' | 'sent' | 'failed' | 'purging' | 'purged'

export type MaloteBatchTone = 'success' | 'danger' | 'progress' | 'neutral'

export type MaloteBatchSummary = { label: string; tone: MaloteBatchTone }

export type MaloteFileValidation =
  | { valid: true }
  | { valid: false; error: string }

export type MaloteTemplateValidation =
  | { valid: true }
  | { valid: false; error: string }

const allowedTemplateVariables = new Set(['{{condominio}}', '{{data_envio}}', '{{arquivo}}'])

// Extensões que o próprio Gmail recusa no SMTP: barramos antes para falhar com uma
// mensagem clara em vez de estourar no meio do envio do malote.
const blockedExtensions = new Set([
  'ade', 'adp', 'apk', 'appx', 'appxbundle', 'bat', 'cab', 'chm', 'cmd', 'com', 'cpl',
  'diagcab', 'diagcfg', 'diagpack', 'dll', 'dmg', 'ex', 'ex_', 'exe', 'hta', 'img',
  'ins', 'iso', 'isp', 'jar', 'jnlp', 'js', 'jse', 'lib', 'lnk', 'mde', 'msc', 'msi',
  'msix', 'msixbundle', 'msp', 'mst', 'nsh', 'pif', 'ps1', 'scr', 'sct', 'shb', 'sys',
  'vb', 'vbe', 'vbs', 'vhd', 'vxd', 'wsc', 'wsf', 'wsh', 'xll',
])

const contentTypePattern = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/

const formatBrazilianDate = (date: Date) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
}).format(date)

export function renderMaloteTemplate(template: string, context: MaloteTemplateContext): string {
  return template
    .replace(/{{\s*condominio\s*}}/g, context.condominium)
    .replace(/{{\s*arquivo\s*}}/g, context.fileName)
    .replace(/{{\s*data_envio\s*}}/g, formatBrazilianDate(context.sentAt))
}

export function validateMaloteTemplate(template: string): MaloteTemplateValidation {
  const variables = template.match(/{{\s*[^{}]+\s*}}/g) ?? []
  const invalidVariable = variables.find((variable) => !allowedTemplateVariables.has(variable.replace(/\s/g, '')))

  if (invalidVariable) {
    return { valid: false, error: `A variável ${invalidVariable} não é permitida em malotes.` }
  }

  return { valid: true }
}

export function maloteFileExtension(fileName: string): string {
  const match = /\.([A-Za-z0-9]{1,12})$/.exec(fileName.trim())
  return match ? match[1].toLowerCase() : ''
}

/** Normaliza o MIME informado pelo browser: ele vira cabeçalho de anexo, então não pode vir arbitrário. */
export function resolveMaloteContentType(contentType?: string | null): string {
  const candidate = (contentType ?? '').split(';')[0].trim().toLowerCase()
  return contentTypePattern.test(candidate) ? candidate : MALOTE_DEFAULT_CONTENT_TYPE
}

export function validateMaloteFile(file: MaloteFileInput): MaloteFileValidation {
  const name = file.name.trim()

  if (!name) {
    return { valid: false, error: 'Um dos arquivos selecionados está sem nome.' }
  }

  if (!file.size) {
    return { valid: false, error: `O arquivo ${name} está vazio.` }
  }

  if (file.size > MALOTE_MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `O arquivo ${name} excede o limite de 18 MB.` }
  }

  if (blockedExtensions.has(maloteFileExtension(name))) {
    return { valid: false, error: `O Gmail bloqueia anexos .${maloteFileExtension(name)}. Compacte o arquivo com senha ou envie por link.` }
  }

  return { valid: true }
}

const itemStatusLabels: Record<MaloteItemStatus, string> = {
  pending: 'Aguardando upload',
  uploaded: 'Pronto para envio',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'Falhou',
  purging: 'Expurgando',
  purged: 'Expurgado',
}

export function maloteItemStatusLabel(status: string): string {
  return itemStatusLabels[status as MaloteItemStatus] ?? status
}

export function maloteItemStatusTone(status: string): MaloteBatchTone {
  if (status === 'sent') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'pending' || status === 'uploaded' || status === 'sending') return 'progress'
  return 'neutral'
}

/** Condensa o estado dos anexos de um malote em uma única situação para a linha do histórico. */
export function summarizeMaloteBatch(statuses: string[]): MaloteBatchSummary {
  if (statuses.length === 0) return { label: 'Sem arquivos', tone: 'neutral' }
  if (statuses.some((status) => status === 'failed')) return { label: 'Com falhas', tone: 'danger' }
  if (statuses.some((status) => status === 'pending' || status === 'uploaded' || status === 'sending')) {
    return { label: 'Em andamento', tone: 'progress' }
  }
  if (statuses.some((status) => status === 'sent')) return { label: 'Enviado', tone: 'success' }
  return { label: 'Expurgado', tone: 'neutral' }
}

/** Cada anexo conta dois passos — subir para o storage e sair por e-mail. */
export function maloteSendProgress(uploaded: number, sent: number, total: number): number {
  if (total <= 0) return 0
  const steps = Math.max(0, Math.min(uploaded + sent, total * 2))
  return Math.round((steps / (total * 2)) * 100)
}
