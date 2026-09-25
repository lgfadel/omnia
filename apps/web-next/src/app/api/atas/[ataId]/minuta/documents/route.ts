import { NextResponse } from 'next/server'
import { confirmMinutaDocumentUpload, deleteMinutaDocument, type MinutaDocumentKind } from '@/server/ataMinutaService'

export const runtime = 'nodejs'

const VALID_KINDS = new Set<MinutaDocumentKind>(['convocacao', 'apuracao', 'outro'])

export async function POST(request: Request, context: { params: Promise<{ ataId: string }> }) {
  const { ataId } = await context.params
  try {
    const body = await request.json() as {
      fileName?: unknown
      kind?: unknown
      sizeBytes?: unknown
      storagePath?: unknown
    }
    if (typeof body.fileName !== 'string' || !body.fileName.trim()) {
      return NextResponse.json({ error: 'Informe o nome do arquivo.' }, { status: 400 })
    }
    if (typeof body.kind !== 'string' || !VALID_KINDS.has(body.kind as MinutaDocumentKind)) {
      return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 })
    }
    if (typeof body.sizeBytes !== 'number' || !Number.isSafeInteger(body.sizeBytes) || body.sizeBytes <= 0) {
      return NextResponse.json({ error: 'Tamanho do arquivo inválido.' }, { status: 400 })
    }
    if (typeof body.storagePath !== 'string') {
      return NextResponse.json({ error: 'Informe o caminho do documento enviado.' }, { status: 400 })
    }

    const document = await confirmMinutaDocumentUpload(request.headers.get('Authorization'), ataId, {
      fileName: body.fileName,
      kind: body.kind as MinutaDocumentKind,
      sizeBytes: body.sizeBytes,
      storagePath: body.storagePath,
    })
    return NextResponse.json(document)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o documento.' }, { status: 400 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ ataId: string }> }) {
  const { ataId } = await context.params
  const documentId = new URL(request.url).searchParams.get('documentId')
  if (!documentId) return NextResponse.json({ error: 'Informe o documento a remover.' }, { status: 400 })
  try {
    await deleteMinutaDocument(request.headers.get('Authorization'), ataId, documentId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível remover o documento.' }, { status: 400 })
  }
}
