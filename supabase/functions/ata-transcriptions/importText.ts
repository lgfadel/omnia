// Shared by the browser and the Edge Function. Keep this module free of DOM and
// Deno APIs so the exact same file/content validation runs at both boundaries.
export const TRANSCRIPTION_IMPORT_MAX_BYTES = 5 * 1024 * 1024

export function validateTranscriptionFile(name: string, size: number): void {
  if (!/\.(txt|vtt)$/i.test(name)) throw new Error('Formato não suportado. Envie TXT ou VTT do Zoom.')
  if (!Number.isFinite(size) || size <= 0) throw new Error('O arquivo está vazio. Escolha outro arquivo.')
  if (size > TRANSCRIPTION_IMPORT_MAX_BYTES) throw new Error('O arquivo ultrapassa o limite de 5 MB.')
}

const timestamp = /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/

function timestampSeconds(value: string): number | null {
  const match = timestamp.exec(value)
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) return null
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000
}

function decodeEntities(text: string): string {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', nbsp: ' ', lrm: '\u200e', rlm: '\u200f' }
  return text.replace(/&(amp|lt|gt|nbsp|lrm|rlm);/g, (_, name: string) => entities[name])
}

function cueText(text: string): string {
  return decodeEntities(text
    .replace(/<v(?:\.[^\s>]+)*[ \t]+([^>]+)>/g, (_, name: string) => `${name.trim()}: `)
    .replace(/<[^>]*>/g, ''))
    .trim()
}

function parseVtt(content: string): string {
  const blocks = content.split(/\n[ \t]*\n+/)
  if (!/^WEBVTT(?:[ \t]|\n|$)/.test(blocks[0])) {
    throw new Error('Arquivo VTT inválido: o cabeçalho WEBVTT não foi encontrado.')
  }
  const cues: string[] = []
  for (const block of blocks.slice(1)) {
    if (!block.trim() || /^(?:NOTE(?:[ \t\n]|$)|STYLE(?:\n|$)|REGION(?:\n|$))/.test(block)) continue
    const lines = block.split('\n')
    const timingIndex = lines[0].includes('-->') ? 0 : 1
    const timing = /^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t]+.*)?$/.exec(lines[timingIndex] ?? '')
    const start = timing ? timestampSeconds(timing[1]) : null
    const end = timing ? timestampSeconds(timing[2]) : null
    if (start === null || end === null || end <= start) {
      throw new Error('Arquivo VTT inválido: confira os marcadores de tempo e exporte a transcrição novamente.')
    }
    const speech = cueText(lines.slice(timingIndex + 1).join('\n'))
    if (speech) cues.push(speech)
  }
  if (!cues.length) throw new Error('O arquivo VTT não contém falas para importar.')
  return cues.join('\n\n')
}

export function parseTranscriptionText(name: string, content: string): string {
  validateTranscriptionFile(name, new TextEncoder().encode(content).byteLength)
  // These control characters distinguish binary files from readable transcripts.
  // deno-lint-ignore no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content)) {
    throw new Error('O arquivo não contém texto válido. Envie um arquivo TXT ou VTT em UTF-8.')
  }
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) throw new Error('O arquivo não contém texto para importar.')
  return /\.vtt$/i.test(name) ? parseVtt(normalized) : normalized
}
