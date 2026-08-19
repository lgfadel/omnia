export interface TranscribedSegment {
  start: number
  end: number
  text: string
}

export interface TranscribedChunk {
  chunkIndex: number
  startOffsetSeconds: number
  segments: TranscribedSegment[]
}

export interface PersistedSegment {
  sequence: number
  startMs: number
  endMs: number
  text: string
}

// Uma pausa longa entre trechos quase sempre marca troca de assunto ou de quem
// fala. Quebrar o parágrafo ali é o que torna 80 mil caracteres editáveis: sem
// isso a ata chega como um bloco único de texto corrido.
// O whisper entra em loop sobre trechos quase inaudíveis e repete a mesma frase
// várias vezes. Medido contra o áudio real: uma fala dita 2-3 vezes saiu 6 vezes.
// Comparar cada trecho com os últimos três, por coeficiente de Dice, derrubou as
// 6 para 3 sem perder um único ponto de cobertura nem nenhuma frase legítima —
// repetição real em assembleia é comum e não pode ser eliminada por completo.
const REPETITION_SIMILARITY = 0.8
const REPETITION_WINDOW = 3

function toComparableWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-zà-ú ]/g, ' ').split(/\s+/).filter(Boolean)
}

function diceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const counts = new Map<string, number>()
  for (const word of a) counts.set(word, (counts.get(word) ?? 0) + 1)
  let shared = 0
  for (const word of b) {
    const available = counts.get(word) ?? 0
    if (available > 0) {
      shared += 1
      counts.set(word, available - 1)
    }
  }
  return (2 * shared) / (a.length + b.length)
}

function dropRepeatedLoops<T extends { text: string }>(segments: T[]): T[] {
  const kept: T[] = []
  const recent: string[][] = []
  for (const segment of segments) {
    const words = toComparableWords(segment.text)
    if (words.length > 0 && recent.some((previous) => diceSimilarity(words, previous) > REPETITION_SIMILARITY)) {
      continue
    }
    kept.push(segment)
    recent.push(words)
    if (recent.length > REPETITION_WINDOW) recent.shift()
  }
  return kept
}

const PARAGRAPH_GAP_SECONDS = 2

export function mergeTranscribedChunks(
  chunks: TranscribedChunk[],
): { rawText: string; segments: PersistedSegment[] } {
  const merged = chunks
    .flatMap((chunk) =>
      chunk.segments.map((segment) => ({
        startMs: Math.round((chunk.startOffsetSeconds + segment.start) * 1000),
        endMs: Math.round((chunk.startOffsetSeconds + segment.end) * 1000),
        text: segment.text.trim(),
      })),
    )
    .filter((segment) => segment.text.length > 0)
    .sort((a, b) => a.startMs - b.startMs)
  const deduped = dropRepeatedLoops(merged)
    .map((segment, sequence) => ({ ...segment, sequence }))

  const paragraphs: string[] = []
  let current: string[] = []
  let previousEndMs: number | null = null

  for (const segment of deduped) {
    const gapSeconds = previousEndMs === null ? 0 : (segment.startMs - previousEndMs) / 1000
    if (current.length > 0 && gapSeconds >= PARAGRAPH_GAP_SECONDS) {
      paragraphs.push(current.join(' '))
      current = []
    }
    current.push(segment.text)
    previousEndMs = segment.endMs
  }
  if (current.length > 0) paragraphs.push(current.join(' '))

  return { rawText: paragraphs.join('\n\n'), segments: deduped }
}
