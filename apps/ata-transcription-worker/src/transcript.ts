export interface DiarizedSegment {
  start: number
  end: number
  speaker: string
  text: string
}

export interface DiarizedChunk {
  chunkIndex: number
  startOffsetSeconds?: number
  segments: DiarizedSegment[]
}

export interface PersistedSegment {
  sequence: number
  startMs: number
  endMs: number
  speakerLabel: string
  text: string
}

const DEFAULT_CHUNK_SECONDS = 20 * 60

export function mergeDiarizedChunks(chunks: DiarizedChunk[]): { rawText: string; segments: PersistedSegment[] } {
  const segments = chunks
    .flatMap((chunk) => {
      const offsetSeconds = chunk.startOffsetSeconds ?? (chunk.chunkIndex - 1) * DEFAULT_CHUNK_SECONDS
      return chunk.segments.map((segment) => ({
        startMs: Math.round((offsetSeconds + segment.start) * 1000),
        endMs: Math.round((offsetSeconds + segment.end) * 1000),
        speakerLabel: `T${chunk.chunkIndex}-${segment.speaker}`,
        text: segment.text.trim(),
      }))
    })
    .filter((segment) => segment.text.length > 0)
    .map((segment, sequence) => ({ ...segment, sequence }))

  return {
    rawText: segments.map((segment) => `[${segment.speakerLabel}] ${segment.text}`).join('\n'),
    segments,
  }
}
