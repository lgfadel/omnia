import { File } from 'node:buffer'
import { NextResponse } from 'next/server'
import { MINUTA_DOCUMENT_PROXY_MAX_SIZE_BYTES } from '@/lib/ataMinutaDocuments'
import { uploadMinutaDocument, type MinutaDocumentKind } from '@/server/ataMinutaService'

export const runtime = 'nodejs'
const VALID_KINDS = new Set<MinutaDocumentKind>(['convocacao', 'apuracao', 'outro'])
// Margem para cabeçalhos e os três campos multipart, abaixo do teto da Vercel.
const MAX_BODY_SIZE_BYTES = MINUTA_DOCUMENT_PROXY_MAX_SIZE_BYTES + 64 * 1024

class RequestBodyTooLargeError extends Error {}

async function readBoundedFormData(request: Request): Promise<FormData> {
  if (!request.body) throw new Error('Envie o PDF.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_SIZE_BYTES) {
        await reader.cancel()
        throw new RequestBodyTooLargeError()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' } }).formData()
}

export async function POST(request: Request, context: { params: Promise<{ ataId: string }> }) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ') || !authHeader.slice(7).trim()) {
    return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 })
  }
  const contentType = request.headers.get('Content-Type') ?? ''
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return NextResponse.json({ error: 'Envie o PDF como formulário multipart.' }, { status: 400 })
  }
  const contentLength = request.headers.get('Content-Length')
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || !Number.isSafeInteger(Number(contentLength)))) {
    return NextResponse.json({ error: 'Tamanho do envio inválido.' }, { status: 400 })
  }
  if (contentLength !== null && Number(contentLength) > MAX_BODY_SIZE_BYTES) {
    return NextResponse.json({ error: 'A recuperação do envio aceita PDFs de até 4 MB.' }, { status: 413 })
  }

  try {
    const form = await readBoundedFormData(request)
    const file = form.get('file')
    const kind = form.get('kind')
    const storagePath = form.get('storagePath')
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Envie um arquivo PDF.' }, { status: 400 })
    }
    if (typeof kind !== 'string' || !VALID_KINDS.has(kind as MinutaDocumentKind)) {
      return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 })
    }
    if (typeof storagePath !== 'string' || !storagePath.trim()) {
      return NextResponse.json({ error: 'O caminho do documento enviado é inválido.' }, { status: 400 })
    }
    if (!Number.isSafeInteger(file.size) || file.size <= 0) {
      return NextResponse.json({ error: 'Tamanho do arquivo inválido.' }, { status: 400 })
    }
    if (file.size > MINUTA_DOCUMENT_PROXY_MAX_SIZE_BYTES) throw new RequestBodyTooLargeError()

    const { ataId } = await context.params
    const document = await uploadMinutaDocument(authHeader, ataId, {
      fileName: file.name,
      kind: kind as MinutaDocumentKind,
      storagePath,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
    return NextResponse.json(document)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'A recuperação do envio aceita PDFs de até 4 MB.' }, { status: 413 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o PDF.' }, { status: 400 })
  }
}
