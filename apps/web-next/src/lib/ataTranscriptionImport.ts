import { parseTranscriptionText, validateTranscriptionFile } from '../../../../supabase/functions/ata-transcriptions/importText'

export { parseTranscriptionText, validateTranscriptionFile } from '../../../../supabase/functions/ata-transcriptions/importText'

// Return the original content, not the extracted text: the server parses the VTT
// independently before persisting it. Validation here gives immediate feedback.
export async function readTranscriptionFile(file: File): Promise<string> {
  validateTranscriptionFile(file.name, file.size)
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo. Selecione-o novamente.'))
    reader.readAsArrayBuffer(file)
  })
  let content: string
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new Error('Não foi possível ler a codificação. Salve o arquivo como UTF-8 e tente novamente.')
  }
  parseTranscriptionText(file.name, content)
  return content
}
