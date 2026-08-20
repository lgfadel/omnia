import { NextResponse } from 'next/server'
import { getMaloteSettings, updateMaloteSettings } from '@/server/maloteService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try { return NextResponse.json(await getMaloteSettings(request.headers.get('Authorization'))) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar configuração.' }, { status: 400 }) }
}

export async function PUT(request: Request) {
  try { return NextResponse.json(await updateMaloteSettings(request.headers.get('Authorization'), await request.json())) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar configuração.' }, { status: 400 }) }
}
