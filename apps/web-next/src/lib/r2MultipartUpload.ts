export type R2MultipartPartPlan = { partNumber: number; url: string }

export type R2MultipartUploadPlan = {
  partSize: number
  parts: R2MultipartPartPlan[]
}

export type R2CompletedPart = { partNumber: number; etag: string }

const MAX_ATTEMPTS = 3
const MAX_CONCURRENCY = 3

async function putPart(url: string, body: Blob, contentType: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body,
      })
      if (!response.ok) throw new Error(`Não foi possível enviar esta parte (HTTP ${response.status}).`)
      const etag = response.headers.get('ETag')
      if (!etag) throw new Error('O armazenamento não devolveu o ETag desta parte.')
      return etag
    } catch (error) {
      lastError = error
      if (attempt === MAX_ATTEMPTS) break
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Não foi possível enviar esta parte.')
}

export async function uploadR2Multipart(
  file: File,
  plan: R2MultipartUploadPlan,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void,
): Promise<R2CompletedPart[]> {
  if (plan.partSize <= 0 || plan.parts.length === 0) throw new Error('Plano de envio inválido.')

  let nextIndex = 0
  let uploadedBytes = 0
  const completed = new Array<R2CompletedPart>(plan.parts.length)
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, plan.parts.length) }, async () => {
    for (;;) {
      const index = nextIndex
      nextIndex += 1
      if (index >= plan.parts.length) return

      const part = plan.parts[index]
      const start = index * plan.partSize
      const body = file.slice(start, Math.min(start + plan.partSize, file.size))
      if (body.size === 0) throw new Error('Plano de envio contém uma parte vazia.')
      const etag = await putPart(part.url, body, file.type)
      completed[index] = { partNumber: part.partNumber, etag }
      uploadedBytes += body.size
      onProgress?.(uploadedBytes, file.size)
    }
  })

  await Promise.all(workers)
  return completed
}
