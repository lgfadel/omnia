export const MALOTE_MAX_FILE_SIZE_BYTES = 18 * 1024 * 1024

export type MaloteTemplateContext = {
  condominium: string
  fileName: string
  sentAt: Date
}

export type MaloteFileValidation =
  | { valid: true }
  | { valid: false; error: string }

export type MaloteTemplateValidation =
  | { valid: true }
  | { valid: false; error: string }

const allowedTemplateVariables = new Set(['{{condominio}}', '{{data_envio}}', '{{arquivo}}'])

const readBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler o arquivo.'))
  reader.onload = () => resolve(reader.result as ArrayBuffer)
  reader.readAsArrayBuffer(blob)
})

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

export async function validateMalotePdf(file: File): Promise<MaloteFileValidation> {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
    return { valid: false, error: `O arquivo ${file.name} deve ser um PDF.` }
  }

  if (file.size > MALOTE_MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `O arquivo ${file.name} excede o limite de 18 MB.` }
  }

  const header = new TextDecoder().decode(await readBlobAsArrayBuffer(file.slice(0, 5)))
  if (header !== '%PDF-') {
    return { valid: false, error: `O arquivo ${file.name} não possui uma assinatura PDF válida.` }
  }

  return { valid: true }
}
