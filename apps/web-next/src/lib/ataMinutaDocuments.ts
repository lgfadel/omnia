// Responses aceita até 50 MB somando os arquivos de um pedido. 45 MiB deixa
// margem abaixo desse teto sem retirar o PDF da análise visual do modelo.
export const MINUTA_DOCUMENT_MAX_SIZE_MB = 45
export const MINUTA_DOCUMENT_MAX_SIZE_BYTES = MINUTA_DOCUMENT_MAX_SIZE_MB * 1024 * 1024
export const MINUTA_DOCUMENT_TOTAL_MAX_SIZE_BYTES = MINUTA_DOCUMENT_MAX_SIZE_BYTES
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
