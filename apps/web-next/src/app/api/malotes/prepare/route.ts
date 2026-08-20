import { NextResponse } from 'next/server'
import { prepareMalote } from '@/server/maloteService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try { return NextResponse.json(await prepareMalote(request.headers.get('Authorization'), await request.json())) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao preparar malote.' }, { status: 400 }) }
}
