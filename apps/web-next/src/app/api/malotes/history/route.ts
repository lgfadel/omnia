import { NextResponse } from 'next/server'
import { listMalotes } from '@/server/maloteService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try { return NextResponse.json(await listMalotes(request.headers.get('Authorization'))) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar histórico.' }, { status: 400 }) }
}
