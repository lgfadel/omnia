import { NextResponse } from 'next/server'
import { createMinutaDocumentUpload, type MinutaDocumentKind } from '@/server/ataMinutaService'

export const runtime = 'nodejs'
const VALID_KINDS = new Set<MinutaDocumentKind>(['convocacao', 'apuracao', 'outro'])

export async function POST(request: Request, context: { params: Promise<{ ataId: string }> }) {
  const { ataId } = await context.params
  try {
    const body = await request.json() as { fileName?: unknown; kind?: unknown; sizeBytes?: unknown }
    if (typeof body.fileName !== 'string' || !body.fileName.trim()) {
      return NextResponse.json({ error: 'Informe o nome do arquivo.' }, { status: 400 })
    }
    if (typeof body.kind !== 'string' || !VALID_KINDS.has(body.kind as MinutaDocumentKind)) {
      return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 })
    }
    if (typeof body.sizeBytes !== 'number' || !Number.isSafeInteger(body.sizeBytes) || body.sizeBytes <= 0) {
      return NextResponse.json({ error: 'Tamanho do arquivo inválido.' }, { status: 400 })
    }

    const upload = await createMinutaDocumentUpload(request.headers.get('Authorization'), ataId, {
      fileName: body.fileName,
      sizeBytes: body.sizeBytes,
    })
    return NextResponse.json(upload)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível preparar o envio do documento.' }, { status: 400 })
  }
}
