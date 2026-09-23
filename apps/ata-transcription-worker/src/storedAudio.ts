// O áudio fica retido para permitir reprocessar a mesma gravação com outro
// modelo ou outro contexto. Reter o arquivo que veio do navegador, porém, é caro
// sem servir a esse propósito: o modelo nunca vê o original — vê a versão mono,
// 16 kHz, 64 kbps que o ffmpeg produz aqui. Guardar essa versão preserva o
// reprocessamento por inteiro e derruba o volume do bucket.
//
// Ela é montada bloco a bloco, como partes de um upload multipart enviadas à
// medida que cada bloco é transcrito: nunca existe no disco inteira, e o worker
// cabe no mesmo limite de memória para uma gravação de 10 minutos ou de 6 horas.
//
// A troca precisa ser segura contra falha parcial, porque o arquivo original é
// insubstituível depois de apagado. A ordem — completar, registrar, só então
// apagar — garante que qualquer interrupção deixe DOIS objetos, nunca nenhum, e
// que o `storage_path` do job sempre aponte para um objeto que existe.

export const COMPACTED_MIME_TYPE = 'audio/mpeg'
const COMPACTED_EXTENSION = '.mp3'

// O sufixo marca o objeto como produzido aqui. Sem ele, um MP3 enviado pelo
// navegador — formato aceito no upload e o mais comum em gravador de mão — teria
// a mesma chave e o mesmo mime type do objeto compactado, e seria confundido com
// um áudio já processado: ficaria retido em tamanho integral para sempre.
const COMPACTED_SUFFIX = '.compacted'

export type StoredAudioRecord = {
  storagePath: string
  sizeBytes: number
  mimeType: string
}

export type CommitCompactedAudioOptions = {
  key: string
  /** Soma das partes já enviadas. */
  sizeBytes: number
  /** Tamanho do objeto que está no bucket hoje; quando ausente, a troca não é comparada. */
  originalSizeBytes?: number
  complete: () => Promise<void>
  abort: () => Promise<void>
  persist: (record: StoredAudioRecord) => Promise<void>
  remove: (key: string) => Promise<void>
}

export type CommitCompactedAudioResult =
  | { replaced: false; reason: 'not-smaller' }
  | { replaced: true; storagePath: string; sizeBytes: number }

export function compactedKeyFor(key: string): string {
  return `${key.replace(/\.[^./]*$/, '')}${COMPACTED_SUFFIX}${COMPACTED_EXTENSION}`
}

// Uma reprocessada lê um áudio que já foi compactado. Refazê-lo subiria o mesmo
// conteúdo por cima de si mesmo e apagaria a chave que o job acabou de registrar.
export function isCompactedKey(key: string): boolean {
  return key.endsWith(`${COMPACTED_SUFFIX}${COMPACTED_EXTENSION}`)
}

export async function commitCompactedAudio(options: CommitCompactedAudioOptions): Promise<CommitCompactedAudioResult> {
  // Um áudio já curto e muito comprimido na origem pode sair maior do encoder do
  // que entrou. Trocar nesse caso gastaria o bucket para ocupar mais espaço.
  if (typeof options.originalSizeBytes === 'number' && options.sizeBytes >= options.originalSizeBytes) {
    await options.abort()
    return { replaced: false, reason: 'not-smaller' }
  }

  const storagePath = compactedKeyFor(options.key)
  await options.complete()
  try {
    await options.persist({ storagePath, sizeBytes: options.sizeBytes, mimeType: COMPACTED_MIME_TYPE })
  } catch (error) {
    // O job continua apontando para o original; o objeto novo não teria dono.
    await options.remove(storagePath).catch((removeError) => {
      console.error('Unable to remove the unreferenced compacted audio', removeError)
    })
    throw error
  }

  // Daqui em diante o job já aponta para o objeto compactado, então o original é
  // apenas lixo. Falhar ao removê-lo custa espaço, não corretude — e transformar
  // isso em erro descartaria uma troca que já foi concluída com sucesso.
  await options.remove(options.key).catch((error) => {
    console.error('Unable to remove the superseded original audio', error)
  })

  return { replaced: true, storagePath, sizeBytes: options.sizeBytes }
}
