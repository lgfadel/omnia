export const MINUTA_DOCUMENT_MAX_SIZE_MB = 100
export const MINUTA_DOCUMENT_MAX_SIZE_BYTES = MINUTA_DOCUMENT_MAX_SIZE_MB * 1024 * 1024
export const MINUTA_DOCUMENT_TOTAL_MAX_SIZE_BYTES = MINUTA_DOCUMENT_MAX_SIZE_BYTES
// O armazenamento aceita originais maiores que o orçamento de uma chamada visual.
// Acima de 45 MiB agregados, analisar os PDFs em partes antes de gerar a minuta.
export const MINUTA_DOCUMENT_AI_MAX_SIZE_BYTES = 45 * 1024 * 1024
// A recuperação pelo app precisa caber no limite de corpo da função Vercel.
export const MINUTA_DOCUMENT_PROXY_MAX_SIZE_BYTES = 4 * 1024 * 1024

type SizedDocument = { sizeBytes: number }

export function getMinutaDocumentsTotalSize(documents: readonly SizedDocument[]): number {
  return documents.reduce((total, document) => total + document.sizeBytes, 0)
}

export function getMinutaDocumentsValidationError(documents: readonly SizedDocument[], additionalSizeBytes?: number): string | null {
  const sizes = documents.map((document) => document.sizeBytes)
  if (additionalSizeBytes !== undefined) sizes.push(additionalSizeBytes)
  if (sizes.some((size) => !Number.isSafeInteger(size) || size <= 0)) {
    return 'Tamanho do arquivo inválido.'
  }
  if (sizes.some((size) => size > MINUTA_DOCUMENT_MAX_SIZE_BYTES)) {
    return `O arquivo ultrapassa o limite de ${MINUTA_DOCUMENT_MAX_SIZE_MB} MB.`
  }
  if (getMinutaDocumentsTotalSize(documents) + (additionalSizeBytes ?? 0) > MINUTA_DOCUMENT_TOTAL_MAX_SIZE_BYTES) {
    return `Os PDFs de apoio ultrapassam o limite total de ${MINUTA_DOCUMENT_MAX_SIZE_MB} MB por ata.`
  }
  return null
}
