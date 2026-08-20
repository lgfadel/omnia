import { NextResponse } from 'next/server'
import { sendMalote } from '@/server/maloteService'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await context.params
    const body = await request.json().catch(() => ({})) as { itemIds?: string[] }
    return NextResponse.json(await sendMalote(request.headers.get('Authorization'), batchId, body.itemIds))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao enviar malote.' }, { status: 400 })
  }
}
