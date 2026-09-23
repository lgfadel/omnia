import type { CompletedPart, S3Client } from '@aws-sdk/client-s3'
import { abortR2Multipart, completeR2Multipart, startR2Multipart, uploadR2Part } from './r2.js'
import { COMPACTED_MIME_TYPE, compactedKeyFor, isCompactedKey } from './storedAudio.js'

export type CompactedUpload = {
  addPart(path: string, partSize: number): Promise<void>
  readonly sizeBytes: number
  complete(): Promise<void>
  abort(): Promise<void>
}

// Guarda, em paralelo à transcrição, o áudio compactado que substitui o original
// no bucket. Só existe para áudios no R2 que ainda não foram compactados; uma
// reprocessada já lê a versão compactada e não tem o que substituir.
export function createCompactedUpload(
  source: { storagePath: string; storageProvider: 'supabase' | 'r2' },
  r2: { client: S3Client; bucket: string },
): CompactedUpload | null {
  if (source.storageProvider !== 'r2' || isCompactedKey(source.storagePath)) return null
  const key = compactedKeyFor(source.storagePath)
  const parts: CompletedPart[] = []
  let uploadId: string | null = null
  let sizeBytes = 0
  // Abandonado uma vez, fica abandonado: um upload novo a partir do bloco
  // seguinte guardaria um áudio sem o começo.
  let abandoned = false
  return {
    async addPart(path, partSize) {
      if (abandoned) return
      uploadId ??= await startR2Multipart(r2.client, r2.bucket, key, COMPACTED_MIME_TYPE)
      parts.push(await uploadR2Part(r2.client, r2.bucket, key, uploadId, parts.length + 1, path, partSize))
      sizeBytes += partSize
    },
    get sizeBytes() { return abandoned ? 0 : sizeBytes },
    async complete() {
      if (!uploadId || abandoned) throw new Error('No compacted audio was uploaded.')
      await completeR2Multipart(r2.client, r2.bucket, key, uploadId, parts)
    },
    async abort() {
      abandoned = true
      if (uploadId) await abortR2Multipart(r2.client, r2.bucket, key, uploadId)
    },
  }
}
