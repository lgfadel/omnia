import { NextResponse } from 'next/server'
import { getMinutaSettings, updateMinutaSettings } from '@/server/ataMinutaService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    return NextResponse.json(await getMinutaSettings(request.headers.get('Authorization')))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar configuração.' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { model: string; reasoningEffort: 'low' | 'medium' | 'high'; systemPrompt: string }
    return NextResponse.json(await updateMinutaSettings(request.headers.get('Authorization'), body))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar configuração.' }, { status: 400 })
  }
}
