import { NextResponse } from 'next/server'
import { verifyMinutaModel } from '@/server/ataMinutaService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { model?: string }
    return NextResponse.json(await verifyMinutaModel(request.headers.get('Authorization'), body.model ?? ''))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao verificar o modelo.' }, { status: 400 })
  }
}
