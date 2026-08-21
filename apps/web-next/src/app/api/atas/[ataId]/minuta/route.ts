import { NextResponse } from 'next/server'
import { saveMinutaManualEdit, streamMinutaTurn } from '@/server/ataMinutaService'

export const runtime = 'nodejs'
// Teto do plano Hobby da Vercel para este projeto — 300 é o máximo aceito, não uma
// escolha de conforto. Uma geração que ultrapassa isso é interrompida como qualquer
// desconexão de cliente: o texto parcial fica salvo e "Continuar"/"Gerar de novo"
// retomam sem perda (ver streamMinutaTurn).
export const maxDuration = 300

export async function POST(request: Request, context: { params: Promise<{ ataId: string }> }) {
  const { ataId } = await context.params
  const body = await request.json().catch(() => ({})) as { instruction?: string }
  const events = streamMinutaTurn(request.headers.get('Authorization'), ataId, body.instruction?.trim() || undefined)

  // O corpo do gerador só roda no primeiro next(): autenticação, autorização e a
  // validação de contexto (transcrição ausente, modelo não configurado) ainda falham
  // com status HTTP, antes de qualquer byte ir para o cliente.
  let first: Awaited<ReturnType<typeof events.next>>
  try {
    first = await events.next()
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar a minuta.' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        let step = first
        while (!step.done) {
          write(step.value)
          step = await events.next()
        }
      } catch (error) {
        try {
          write({ type: 'error', message: error instanceof Error ? error.message : 'Não foi possível gerar a minuta.' })
        } catch {
          // O cliente já desconectou; não há para quem escrever.
        }
      } finally {
        controller.close()
      }
    },
    // Aba fechada ou conexão perdida cancela o stream sem passar pelo catch acima. Sem
    // isso, o gerador fica suspenso para sempre segurando a conexão aberta com a OpenAI
    // — o cleanup de verdade (liberar o reader, marcar a minuta como falha) está no
    // finally de streamMinutaTurn, disparado por este return().
    async cancel() {
      await events.return(undefined).catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ ataId: string }> }) {
  const { ataId } = await context.params
  try {
    const body = await request.json() as { content?: string }
    if (typeof body.content !== 'string') return NextResponse.json({ error: 'Informe o texto da minuta.' }, { status: 400 })
    await saveMinutaManualEdit(request.headers.get('Authorization'), ataId, body.content)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível salvar a minuta.' }, { status: 400 })
  }
}
