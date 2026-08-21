import { NextResponse } from 'next/server'
import { streamMaloteSend } from '@/server/maloteService'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await context.params
  const body = await request.json().catch(() => ({})) as { itemIds?: string[] }
  const events = streamMaloteSend(request.headers.get('Authorization'), batchId, body.itemIds)

  // O corpo do gerador só roda no primeiro next(): validação e autorização ainda
  // falham com status HTTP, antes de qualquer byte ir para o cliente.
  let first: IteratorResult<Awaited<ReturnType<typeof events.next>>['value']>
  try {
    first = await events.next()
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao enviar malote.' }, { status: 400 })
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
        write({ type: 'error', message: error instanceof Error ? error.message : 'Erro ao enviar malote.' })
      } finally {
        controller.close()
      }
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
