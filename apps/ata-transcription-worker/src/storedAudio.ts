// O áudio fica retido para permitir reprocessar a mesma gravação com outro
// modelo ou outro contexto. Reter o arquivo que veio do navegador, porém, é caro
// sem servir a esse propósito: o modelo nunca vê o original — vê a versão mono,
// 16 kHz, 64 kbps que o ffmpeg produz aqui. Guardar essa versão preserva o
// reprocessamento por inteiro e derruba o volume em uma ordem de magnitude; um
// WAV de assembleia cai de centenas de megabytes para dezenas.
//
// A troca precisa ser segura contra falha parcial, porque o arquivo original é
// insubstituível depois de apagado. A ordem — subir, registrar, só então apagar —
// garante que qualquer interrupção deixe DOIS objetos, nunca nenhum, e que o
// `storage_path` do job sempre aponte para um objeto que existe.

const COMPACTED_MIME_TYPE = 'audio/mpeg'
const COMPACTED_EXTENSION = '.mp3'

export type StoredAudioRecord = {
  storagePath: string
  sizeBytes: number
  mimeType: string
}

export type ReplaceStoredAudioOptions = {
  key: string
  compactPath: string
  /** Tamanho do objeto que está no bucket hoje; quando ausente, a troca não é comparada. */
  originalSizeBytes?: number
  readCompacted: (path: string) => Promise<Uint8Array>
  upload: (key: string, body: Uint8Array, contentType: string) => Promise<void>
  remove: (key: string) => Promise<void>
  persist: (record: StoredAudioRecord) => Promise<void>
}

export type ReplaceStoredAudioResult =
  | { replaced: false; reason: 'already-compacted' | 'not-smaller' }
  | { replaced: true; storagePath: string; sizeBytes: number }

// O sufixo marca o objeto como produzido aqui. Sem ele, um MP3 enviado pelo
// navegador — formato aceito no upload e o mais comum em gravador de mão — teria
// a mesma chave e o mesmo mime type do objeto compactado, e seria confundido com
// um áudio já processado: ficaria retido em tamanho integral para sempre.
const COMPACTED_SUFFIX = '.compacted'

export function compactedKeyFor(key: string): string {
  return `${key.replace(/\.[^./]*$/, '')}${COMPACTED_SUFFIX}${COMPACTED_EXTENSION}`
}

export function isCompactedKey(key: string): boolean {
  return key.endsWith(`${COMPACTED_SUFFIX}${COMPACTED_EXTENSION}`)
}

export async function replaceStoredAudio(options: ReplaceStoredAudioOptions): Promise<ReplaceStoredAudioResult> {
  const compactedKey = compactedKeyFor(options.key)

  // Uma reprocessada roda este caminho de novo sobre um job que já foi compactado.
  // Sem esta guarda, ela subiria o mesmo conteúdo por cima de si mesmo e, pior,
  // chamaria o delete sobre a chave que o job acabou de registrar.
  if (isCompactedKey(options.key)) {
    return { replaced: false, reason: 'already-compacted' }
  }

  const body = await options.readCompacted(options.compactPath)

  // Um áudio já curto e muito comprimido na origem pode sair maior do encoder do
  // que entrou. Trocar nesse caso gastaria banda para ocupar mais espaço.
  if (typeof options.originalSizeBytes === 'number' && body.byteLength >= options.originalSizeBytes) {
    return { replaced: false, reason: 'not-smaller' }
  }

  await options.upload(compactedKey, body, COMPACTED_MIME_TYPE)
  await options.persist({ storagePath: compactedKey, sizeBytes: body.byteLength, mimeType: COMPACTED_MIME_TYPE })

  // Daqui em diante o job já aponta para o objeto compactado, então o original é
  // apenas lixo. Falhar ao removê-lo custa espaço, não corretude — e transformar
  // isso em erro descartaria uma troca que já foi concluída com sucesso.
  if (compactedKey !== options.key) {
    await options.remove(options.key).catch((error) => {
      console.error('Unable to remove the superseded original audio', error)
    })
  }

  return { replaced: true, storagePath: compactedKey, sizeBytes: body.byteLength }
}
