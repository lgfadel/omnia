export interface CondominiumMatchCandidate {
  id: string
  name: string
}

export interface CondominiumMatchResult {
  condominiumId: string | null
  matchedName: string | null
  score: number
  needsReview: boolean
}

const HIGH_CONFIDENCE_SCORE = 0.85
const HIGH_CONFIDENCE_MARGIN = 0.1
const MIN_SUGGESTION_SCORE = 0.35
const COMBINING_DIACRITIC_RANGE = { start: 0x300, end: 0x36f }

function stripDiacritics(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0
      return codePoint < COMBINING_DIACRITIC_RANGE.start || codePoint > COMBINING_DIACRITIC_RANGE.end
    })
    .join('')
}

export function normalizeCondominiumName(value: string): string {
  return stripDiacritics(value.normalize('NFD'))
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getBigrams(value: string): string[] {
  const bigrams: string[] = []
  for (let i = 0; i < value.length - 1; i += 1) {
    bigrams.push(value.substring(i, i + 2))
  }
  return bigrams
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0

  const bigramsA = getBigrams(a)
  const bigramsBPool = getBigrams(b)
  let intersectionSize = 0

  for (const bigram of bigramsA) {
    const index = bigramsBPool.indexOf(bigram)
    if (index !== -1) {
      intersectionSize += 1
      bigramsBPool.splice(index, 1)
    }
  }

  return (2 * intersectionSize) / (bigramsA.length + getBigrams(b).length)
}

export function matchCondominiumName(
  csvName: string,
  candidates: CondominiumMatchCandidate[]
): CondominiumMatchResult {
  const normalizedCsvName = normalizeCondominiumName(csvName)

  const exact = candidates.find((candidate) => normalizeCondominiumName(candidate.name) === normalizedCsvName)
  if (exact) {
    return { condominiumId: exact.id, matchedName: exact.name, score: 1, needsReview: false }
  }

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: diceCoefficient(normalizedCsvName, normalizeCondominiumName(candidate.name)),
    }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.score < MIN_SUGGESTION_SCORE) {
    return { condominiumId: null, matchedName: null, score: best?.score ?? 0, needsReview: true }
  }

  const second = scored[1]
  const isUnambiguous = !second || best.score - second.score >= HIGH_CONFIDENCE_MARGIN
  const needsReview = !(best.score >= HIGH_CONFIDENCE_SCORE && isUnambiguous)

  return {
    condominiumId: best.candidate.id,
    matchedName: best.candidate.name,
    score: best.score,
    needsReview,
  }
}
