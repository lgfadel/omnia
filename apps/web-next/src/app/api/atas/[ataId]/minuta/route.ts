import { after, NextResponse } from 'next/server'
import { saveMinutaManualEdit, streamMinutaTurn } from '@/server/ataMinutaService'

export const runtime = 'nodejs'
// Teto do plano Hobby da Vercel para este projeto — 300 é o máximo aceito, não uma
// escolha de conforto. A geração em si roda na OpenAI (background mode) e não depende
// disso: esta função só acompanha o stream por uma janela menor que o teto
// (STREAM_WINDOW_MS) e avisa "continue"; o cliente reabre com { resume: true } até a
// minuta ficar pronta (ver driveGeneration).
export const maxDuration = 300

export async function POST(request: Request, context: { params: Promise<{ ataId: string }> }) {
  const { ataId } = await context.params
  const body = await request.json().catch(() => ({})) as { instruction?: unknown; resume?: unknown }
  if (body.instruction !== undefined && typeof body.instruction !== 'string') {
    return NextResponse.json({ error: 'As instruções devem ser um texto.' }, { status: 400 })
  }
  const events = streamMinutaTurn(
    request.headers.get('Authorization'),
    ataId,
    typeof body.instruction === 'string' ? body.instruction.trim() : undefined,
    { resume: body.resume === true },
  )

  // O corpo do gerador só roda no primeiro next(): autenticação, autorização e a
  // validação de contexto (transcrição ausente, modelo não configurado) ainda falham
  // com status HTTP, antes de qualquer byte ir para o cliente.
  let first: Awaited<ReturnType<typeof events.next>>
  try {
    first = await events.next()
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar a minuta.' }, { status: 400 })
  }

  // A geração é uma tarefa da minuta, não da conexão: fechar a aba, trocar de
  // tela ou perder o wifi só tira o espectador. Quem a conduz até o fim é esta
  // tarefa, mantida viva por after() mesmo depois que a resposta termina; a
  // tela reencontra o resultado ao recarregar (a minuta fica "generating" e
  // depois "ready"). Cancelar o gerador aqui foi o que fazia uma ação inocente
  // do usuário virar "A conexão foi perdida".
  const encoder = new TextEncoder()
  let clientGone = false
  const stream = new ReadableStream({
    start(controller) {
      const write = (event: unknown) => {
        if (clientGone) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          clientGone = true
        }
      }
      const generation = (async () => {
        try {
          let step = first
          while (!step.done) {
            write(step.value)
            step = await events.next()
          }
        } catch (error) {
          write({ type: 'error', message: error instanceof Error ? error.message : 'Não foi possível gerar a minuta.' })
        } finally {
          if (!clientGone) {
            try { controller.close() } catch { /* o cliente saiu entre a checagem e o fechamento */ }
          }
        }
      })()
      after(generation)
    },
    cancel() {
      clientGone = true
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
