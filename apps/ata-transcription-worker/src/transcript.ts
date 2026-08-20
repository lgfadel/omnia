export interface TranscribedChunk {
  chunkIndex: number
  text: string
}

// O modelo devolve um bloco corrido de texto. Sem quebra, a revisão de uma
// assembleia chega como 80 mil caracteres em um parágrafo único — impossível de
// editar. Agrupar por sentença é o substituto do que antes vinha das pausas do
// áudio, agora que a transcrição não traz mais marcação de tempo.
const SENTENCES_PER_PARAGRAPH = 4
const PARAGRAPH_MAX_CHARS = 700

// Todo ASR entra em loop sobre trechos quase inaudíveis e repete a mesma frase
// várias vezes. Medido contra o áudio real: uma fala dita 2-3 vezes saiu 6 vezes.
// Comparar cada sentença com as últimas três, por coeficiente de Dice, derruba a
// repetição sem perder cobertura — repetição real em assembleia é comum e não
// pode ser eliminada por completo.
// O limiar é quase identidade de propósito: comparando sentença a sentença, uma
// palavra diferente em seis já dá 0,83, e "a unidade 101 votou a favor" contra
// "a unidade 102 votou a favor" são duas deliberações, não um loop. O loop do
// modelo repete literalmente; é isso, e só isso, que este corte remove.
const REPETITION_SIMILARITY = 0.95
const REPETITION_WINDOW = 3
// Frase curta se repete de verdade em assembleia — "sim", "isso", "aprovado" —
// e nunca é o loop do modelo, que despeja períodos inteiros. Abaixo deste número
// de palavras a frase passa sem comparação.
const REPETITION_MIN_WORDS = 4

// Os dígitos entram na comparação: "unidade 101" e "unidade 102" são a mesma
// frase quando se ignora número, e apagar uma delas apagaria uma deliberação.
function toComparableWords(text: string): string[] {
  return text.toLowerCase().replace(/[^0-9a-zà-ú ]/g, ' ').split(/\s+/).filter(Boolean)
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

// Divide preservando a pontuação final, que é o que dá ritmo de leitura à ata.
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function dropRepeatedLoops(sentences: string[]): string[] {
  const kept: string[] = []
  const recent: string[][] = []
  for (const sentence of sentences) {
    const words = toComparableWords(sentence)
    if (words.length >= REPETITION_MIN_WORDS && recent.some((previous) => diceSimilarity(words, previous) > REPETITION_SIMILARITY)) {
      continue
    }
    kept.push(sentence)
    recent.push(words)
    if (recent.length > REPETITION_WINDOW) recent.shift()
  }
  return kept
}

function toParagraphs(sentences: string[]): string[] {
  const paragraphs: string[] = []
  let current: string[] = []
  let currentChars = 0

  for (const sentence of sentences) {
    current.push(sentence)
    currentChars += sentence.length + 1
    if (current.length >= SENTENCES_PER_PARAGRAPH || currentChars >= PARAGRAPH_MAX_CHARS) {
      paragraphs.push(current.join(' '))
      current = []
      currentChars = 0
    }
  }
  if (current.length > 0) paragraphs.push(current.join(' '))
  return paragraphs
}

export function mergeTranscribedChunks(chunks: TranscribedChunk[]): { rawText: string } {
  const sentences = [...chunks]
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .flatMap((chunk) => splitSentences(chunk.text))
  return { rawText: toParagraphs(dropRepeatedLoops(sentences)).join('\n\n') }
}

// O modelo aceita contexto por prompt, e o fim do bloco anterior é o contexto
// mais valioso que existe para o bloco seguinte: sem ele, cada 30 minutos
// recomeça sem saber de que assembleia se trata, e nomes próprios que já haviam
// sido acertados voltam a ser chutados.
const CARRY_OVER_CHARS = 400

export function buildCarryOver(previousText: string): string {
  // O prompt não aceita quebra de linha nem os sinais de maior e menor.
  const sanitized = previousText.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim()
  return sanitized.length <= CARRY_OVER_CHARS ? sanitized : sanitized.slice(-CARRY_OVER_CHARS)
}
