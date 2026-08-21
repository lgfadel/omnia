// Parsing puro do streaming SSE da Responses API da OpenAI, sem rede — o loop de
// leitura do socket fica no server, aqui só decide o que cada bloco significa.
// Isolado porque é a peça mais fácil de acertar errado (nomes de evento mudam
// entre famílias de modelo) e a mais fácil de testar sem mock de fetch.

export type OpenAiResponsesStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'completed'; usage?: Record<string, unknown> }
  | { type: 'failed'; message: string }
  | { type: 'ignored' }

// O corpo chega em pedaços que não respeitam fronteira de evento SSE (um "data: "
// pode ser cortado no meio). Eventos são separados por linha em branco dupla.
export function splitSseBlocks(buffer: string): { blocks: string[]; remainder: string } {
  const parts = buffer.split('\n\n')
  const remainder = parts.pop() ?? ''
  return { blocks: parts, remainder }
}

export function parseSseBlock(block: string): OpenAiResponsesStreamEvent {
  const dataLine = block.split('\n').find((line) => line.startsWith('data:'))
  if (!dataLine) return { type: 'ignored' }

  const raw = dataLine.slice(5).trim()
  if (!raw || raw === '[DONE]') return { type: 'ignored' }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw)
  } catch {
    return { type: 'ignored' }
  }

  const eventType = typeof payload.type === 'string' ? payload.type : ''

  if (eventType === 'response.output_text.delta' && typeof payload.delta === 'string') {
    return { type: 'delta', text: payload.delta }
  }

  if (eventType === 'response.completed') {
    const response = payload.response as { usage?: Record<string, unknown> } | undefined
    return { type: 'completed', usage: response?.usage }
  }

  if (eventType === 'response.failed' || eventType === 'response.incomplete' || eventType === 'error') {
    const response = payload.response as { error?: { message?: string } } | undefined
    const message = response?.error?.message
      ?? (typeof payload.message === 'string' ? payload.message : undefined)
      ?? 'A geração foi interrompida pela OpenAI.'
    return { type: 'failed', message }
  }

  return { type: 'ignored' }
}
