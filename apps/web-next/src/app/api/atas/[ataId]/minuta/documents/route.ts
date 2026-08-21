import { NextResponse } from 'next/server'
import { deleteMinutaDocument, uploadMinutaDocument, type MinutaDocumentKind } from '@/server/ataMinutaService'

export const runtime = 'nodejs'

const VALID_KINDS = new Set<MinutaDocumentKind>(['convocacao', 'apuracao', 'outro'])

export async function POST(request: Request, context: { params: Promise<{ ataId: string }> }) {
  const { ataId } = await context.params
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const kind = formData.get('kind')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Selecione um arquivo.' }, { status: 400 })
    if (typeof kind !== 'string' || !VALID_KINDS.has(kind as MinutaDocumentKind)) {
      return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const document = await uploadMinutaDocument(request.headers.get('Authorization'), ataId, {
      fileName: file.name,
      kind: kind as MinutaDocumentKind,
      bytes,
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
