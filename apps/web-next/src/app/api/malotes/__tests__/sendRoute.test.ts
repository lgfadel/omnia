import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaloteSendEvent } from '@/lib/malotes'

const streamMaloteSend = vi.fn()

vi.mock('@/server/maloteService', () => ({
  streamMaloteSend: (...args: unknown[]) => streamMaloteSend(...args),
}))

const { POST } = await import('@/app/api/malotes/[batchId]/send/route')

const context = { params: Promise.resolve({ batchId: 'batch-1' }) }

function request(body: unknown = {}) {
  return new Request('http://localhost/api/malotes/batch-1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

async function readEvents(response: Response) {
  const text = await response.text()
  return text.trim().split('\n').map((line) => JSON.parse(line))
}

describe('POST /api/malotes/[batchId]/send', () => {
  beforeEach(() => {
    streamMaloteSend.mockReset()
  })

  it('fails with a status code when validation rejects before the first event', async () => {
    streamMaloteSend.mockImplementation(async function* () {
      if (streamMaloteSend) throw new Error('Malote não encontrado.')
      yield { type: 'start', total: 0 }
    })

    const response = await POST(request(), context)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Malote não encontrado.' })
  })

  it('streams one NDJSON line per event', async () => {
    const events: MaloteSendEvent[] = [
      { type: 'start', total: 2 },
      { type: 'item', itemId: 'item-1', fileName: 'a.pdf', status: 'sent' },
      { type: 'item', itemId: 'item-2', fileName: 'b.xlsx', status: 'failed', error: 'SMTP recusou' },
      { type: 'done', batchId: 'batch-1', results: [{ itemId: 'item-1', status: 'sent' }, { itemId: 'item-2', status: 'failed' }] },
    ]
    streamMaloteSend.mockImplementation(async function* () {
      for (const event of events) yield event
    })

    const response = await POST(request(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/x-ndjson')
    await expect(readEvents(response)).resolves.toEqual(events)
  })

  it('reports a failure raised after the stream already started', async () => {
    streamMaloteSend.mockImplementation(async function* () {
      yield { type: 'start', total: 1 }
      throw new Error('Conexão SMTP caiu.')
    })

    const response = await POST(request(), context)

    expect(response.status).toBe(200)
    await expect(readEvents(response)).resolves.toEqual([
      { type: 'start', total: 1 },
      { type: 'error', message: 'Conexão SMTP caiu.' },
    ])
  })

  it('forwards the requested item ids for a retry', async () => {
    streamMaloteSend.mockImplementation(async function* () {
      yield { type: 'done', batchId: 'batch-1', results: [] }
    })

    await POST(request({ itemIds: ['item-9'] }), context)

    expect(streamMaloteSend).toHaveBeenCalledWith('Bearer token', 'batch-1', ['item-9'])
  })
})
