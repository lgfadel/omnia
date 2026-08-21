import { NextResponse } from 'next/server'
import { deleteMalote } from '@/server/maloteService'

export const runtime = 'nodejs'

export async function DELETE(request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await context.params
    await deleteMalote(request.headers.get('Authorization'), batchId)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao excluir malote.' }, { status: 400 })
  }
}
