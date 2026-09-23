export interface ChunkWindow {
  index: number
  startSeconds: number
  durationSeconds: number
}

// Menos que isto não é fala: um resto desses vira um bloco que o modelo
// preenche com ruído, e uma parte vazia no multipart do áudio guardado.
const MIN_TAIL_SECONDS = 1

// Janelas fixas sobre a gravação, lidas uma de cada vez direto do bucket. É o
// que mantém a memória do worker constante: nenhum passo depende da duração
// total nem do tamanho do arquivo enviado.
export function planChunks(durationSeconds: number, chunkSeconds: number): ChunkWindow[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Audio duration must be a positive number.')
  }
  const windows: ChunkWindow[] = []
  for (let start = 0; start < durationSeconds; start += chunkSeconds) {
    const remaining = durationSeconds - start
    const last = windows.at(-1)
    if (remaining < MIN_TAIL_SECONDS && last) {
      last.durationSeconds = round(last.durationSeconds + remaining)
      break
    }
    windows.push({ index: windows.length, startSeconds: start, durationSeconds: round(Math.min(chunkSeconds, remaining)) })
  }
  return windows
}

function round(seconds: number): number {
  return Math.round(seconds * 1000) / 1000
}
