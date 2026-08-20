import { NextResponse } from 'next/server'
import { confirmMaloteUpload } from '@/server/maloteService'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ itemId: string }> }) {
  try { const { itemId } = await context.params; await confirmMaloteUpload(request.headers.get('Authorization'), itemId); return NextResponse.json({ ok: true }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao confirmar upload.' }, { status: 400 }) }
}
