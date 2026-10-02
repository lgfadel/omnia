import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResponsesInputMessage } from '@/lib/ataMinuta'
import { streamMinutaTurn } from '../ataMinutaService'
import { POST } from '@/app/api/atas/[ataId]/minuta/route'

type Row = Record<string, unknown>

// Exercise the real service and Supabase client; only external HTTP is replaced.
// Rows remain in memory across turns so tests can inspect persisted history.
const user = {
  id: 'auth-1', aud: 'authenticated', role: 'authenticated', email: 'secretaria@example.test',
  app_metadata: {}, user_metadata: {}, created_at: '2026-10-02T12:00:00Z',
}

let tables: Record<string, Row[]>
let providerInputs: ResponsesInputMessage[][]
let providerText: string
let providerFailure: boolean

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function externalHttp(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.hostname === 'api.openai.com') {
    providerInputs.push(JSON.parse(init?.body as string).input)
    if (providerFailure) return new Response('Serviço indisponível', { status: 503 })
    const sse = [
      { type: 'response.output_text.delta', delta: providerText },
      { type: 'response.completed', response: { usage: { input_tokens: 10, output_tokens: 5 } } },
    ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
    return new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } })
  }
  if (url.pathname === '/auth/v1/user') return json(user)
  if (url.hostname !== 'supabase.test' || !url.pathname.startsWith('/rest/v1/')) {
    throw new Error(`Unexpected test HTTP request: ${url.hostname}${url.pathname}`)
  }

  const table = url.pathname.split('/').at(-1)!
  const records = tables[table]
  if (!records) throw new Error(`Unexpected test table: ${table}`)
  const method = init?.method ?? 'GET'
  let rows = records.filter((row) => [...url.searchParams.entries()].every(([key, value]) => (
    !value.startsWith('eq.') || String(row[key]) === value.slice(3)
  )))
  if (method === 'POST') {
    const inserted: Row = {
      id: `${table}-${records.length + 1}`,
      ...(table === 'omnia_ata_minutas' ? { content: '', is_current: true, updated_at: new Date().toISOString() } : {}),
      ...JSON.parse(init?.body as string),
    }
    records.push(inserted)
    rows = [inserted]
  } else if (method === 'PATCH') {
    const patch = JSON.parse(init?.body as string)
    rows.forEach((row) => Object.assign(row, patch, { updated_at: new Date().toISOString() }))
  } else if (method !== 'GET') {
    throw new Error(`Unexpected test method: ${method}`)
  }
  const order = url.searchParams.get('order')
  if (order) {
    const [key, direction] = order.split('.')
    rows = [...rows].sort((a, b) => (Number(a[key]) - Number(b[key])) * (direction === 'desc' ? -1 : 1))
  }
  const limit = url.searchParams.get('limit')
  if (limit) rows = rows.slice(0, Number(limit))
  const headers = new Headers(init?.headers)
  const single = headers.get('Accept') === 'application/vnd.pgrst.object+json'
  return json(single ? rows[0] ?? null : rows)
}

async function turn(instruction?: string) {
  const events = []
  for await (const event of streamMinutaTurn('Bearer test-token', 'ata-1', instruction)) events.push(event)
  return events
}

function currentMinuta() {
  return tables.omnia_ata_minutas.find((row) => row.is_current)
}

function textOf(messages: ResponsesInputMessage[]) {
  return messages.flatMap((message) => message.content.flatMap((part) => 'text' in part ? [part.text] : [])).join('\n')
}

describe('minuta initial instructions', () => {
  beforeEach(() => {
    tables = {
      omnia_users: [{ id: 'user-1', auth_user_id: user.id, roles: ['SECRETARIO'] }],
      omnia_atas: [{ id: 'ata-1', title: 'AGO', meeting_date: '2026-10-02', responsible_id: 'user-1', condominium_id: null }],
      omnia_ata_minuta_settings: [{ model: 'test-model', reasoning_effort: 'high', system_prompt: 'Escreva a minuta.' }],
      omnia_ata_transcription_jobs: [{ id: 'job-1', ata_id: 'ata-1', is_current: true, context_text: 'Pauta: contas.' }],
      omnia_ata_transcriptions: [{ id: 'transcription-1', job_id: 'job-1', raw_text: 'Texto original.', revised_text: 'Texto revisado.' }],
      omnia_ata_minuta_documents: [],
      omnia_ata_minutas: [],
      omnia_ata_minuta_messages: [],
      omnia_ata_minuta_versions: [],
    }
    providerInputs = []
    providerText = '## Contas\nAprovadas por unanimidade.'
    providerFailure = false
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
    vi.stubEnv('OPENAI_ATA_MINUTA_API_KEY', 'test-model-key')
    vi.stubGlobal('fetch', externalHttp)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('generates the first draft with initial instructions and persists its user and assistant history', async () => {
    const events = await turn('  Registre os votos exatos.  ')

    expect(events.at(-1)).toEqual({ type: 'done', content: '## Contas\nAprovadas por unanimidade.' })
    expect(providerInputs[0].some((message) => message.role === 'assistant')).toBe(false)
    expect(textOf(providerInputs[0])).toContain('Registre os votos exatos.')
    expect(textOf(providerInputs[0])).toContain('Texto revisado.')
    expect(currentMinuta()).toMatchObject({ status: 'ready', content: '## Contas\nAprovadas por unanimidade.' })
    expect(tables.omnia_ata_minuta_versions).toEqual([
      expect.objectContaining({ origin: 'generation', sequence: 0, content: '## Contas\nAprovadas por unanimidade.' }),
    ])
    expect(tables.omnia_ata_minuta_messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Registre os votos exatos.', sequence: 0 }),
      expect.objectContaining({ role: 'assistant', content: '## Contas\nAprovadas por unanimidade.', sequence: 1, version_id: tables.omnia_ata_minuta_versions[0].id }),
    ])
  })

  it('refines the saved current draft while retaining initial instructions in later context', async () => {
    await turn('Registre os votos exatos.')
    const minutaId = currentMinuta()!.id
    currentMinuta()!.content = '## Contas\nTexto corrigido manualmente.'
    providerText = '## Contas\nTexto final formal.'

    await turn('Deixe mais formal.')

    expect(tables.omnia_ata_minutas).toHaveLength(1)
    expect(currentMinuta()!.id).toBe(minutaId)
    expect(providerInputs[1].find((message) => message.role === 'assistant')?.content).toEqual([
      { type: 'output_text', text: '## Contas\nTexto corrigido manualmente.' },
    ])
    expect(textOf(providerInputs[1])).toContain('Registre os votos exatos.')
    expect(tables.omnia_ata_minuta_versions.map((row) => row.origin)).toEqual(['generation', 'chat'])
    expect(tables.omnia_ata_minuta_messages.map((row) => row.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
  })

  it('treats whitespace-only instructions as a fresh generation without empty chat messages', async () => {
    await expect(turn(' \n  ')).resolves.toEqual([
      { type: 'delta', text: '## Contas\nAprovadas por unanimidade.' },
      { type: 'done', content: '## Contas\nAprovadas por unanimidade.' },
    ])
    expect(providerInputs[0]).toHaveLength(2)
    expect(tables.omnia_ata_minuta_messages).toHaveLength(0)
    expect(tables.omnia_ata_minuta_versions[0].origin).toBe('generation')
  })

  it('retries an empty failed generation using the saved initial instruction', async () => {
    providerFailure = true
    const failure = await turn('Registre os votos exatos.')
    expect(failure.at(-1)).toMatchObject({ type: 'error' })
    expect(currentMinuta()).toMatchObject({ status: 'failed', content: '' })

    providerFailure = false
    const events = await turn()

    expect(events.at(-1)).toMatchObject({ type: 'done' })
    expect(providerInputs[1].some((message) => message.role === 'assistant')).toBe(false)
    expect(textOf(providerInputs[1])).toContain('Registre os votos exatos.')
    expect(tables.omnia_ata_minuta_versions.at(-1)?.origin).toBe('generation')
    const activeMessages = tables.omnia_ata_minuta_messages.filter((row) => row.minuta_id === currentMinuta()!.id)
    expect(activeMessages.map((row) => [row.role, row.content])).toEqual([
      ['user', 'Registre os votos exatos.'],
      ['assistant', '## Contas\nAprovadas por unanimidade.'],
    ])
  })

  it('uses replacement initial instructions rather than refining a failed empty draft', async () => {
    tables.omnia_ata_minutas.push({ id: 'failed-1', ata_id: 'ata-1', content: '  ', is_current: true, status: 'failed', updated_at: new Date().toISOString() })
    tables.omnia_ata_minuta_messages.push({ id: 'message-1', minuta_id: 'failed-1', role: 'user', content: 'Orientação antiga.', sequence: 0 })

    await turn('Nova orientação.')

    expect(providerInputs[0].some((message) => message.role === 'assistant')).toBe(false)
    expect(textOf(providerInputs[0])).toContain('Nova orientação.')
    expect(textOf(providerInputs[0])).not.toContain('Orientação antiga.')
    expect(tables.omnia_ata_minuta_versions.at(-1)?.origin).toBe('generation')
  })

  it('retains initial and later instructions when regenerating a partially failed draft', async () => {
    tables.omnia_ata_minutas.push({ id: 'partial-1', ata_id: 'ata-1', content: '## Contas\nTexto parcial.', is_current: true, status: 'failed', updated_at: new Date().toISOString() })
    tables.omnia_ata_minuta_messages.push(
      { id: 'message-1', minuta_id: 'partial-1', role: 'user', content: 'Registre os votos exatos.', sequence: 0 },
      { id: 'message-2', minuta_id: 'partial-1', role: 'user', content: 'Use linguagem formal.', sequence: 2 },
    )

    await turn()

    expect(currentMinuta()!.id).not.toBe('partial-1')
    expect(textOf(providerInputs[0])).toContain('Registre os votos exatos.')
    expect(textOf(providerInputs[0])).toContain('Use linguagem formal.')
    expect(providerInputs[0].some(message => message.role === 'assistant')).toBe(false)
    expect(tables.omnia_ata_minuta_versions.at(-1)?.origin).toBe('generation')
  })

  it('respects explicitly cleared initial instructions through the route after an empty failure', async () => {
    tables.omnia_ata_minutas.push({ id: 'failed-1', ata_id: 'ata-1', content: '', is_current: true, status: 'failed', updated_at: new Date().toISOString() })
    tables.omnia_ata_minuta_messages.push({ id: 'message-1', minuta_id: 'failed-1', role: 'user', content: 'Orientação antiga.', sequence: 0 })
    const response = await POST(new Request('http://localhost/api/atas/ata-1/minuta', {
      method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction: '' }),
    }), { params: Promise.resolve({ ataId: 'ata-1' }) })
    await response.text()

    expect(response.status).toBe(200)
    expect(textOf(providerInputs[0])).not.toContain('Orientação antiga.')
    expect(tables.omnia_ata_minuta_messages.filter(row => row.minuta_id === currentMinuta()!.id)).toHaveLength(0)
  })

  it('continues a partial failed draft as a refinement using its saved content', async () => {
    tables.omnia_ata_minutas.push({ id: 'partial-1', ata_id: 'ata-1', content: '## Contas\nTexto parcial.', is_current: true, status: 'failed', updated_at: new Date().toISOString() })
    tables.omnia_ata_minuta_messages.push({ id: 'message-1', minuta_id: 'partial-1', role: 'user', content: 'Registre os votos exatos.', sequence: 0 })

    await turn('Continue a minuta.')

    expect(currentMinuta()!.id).toBe('partial-1')
    expect(providerInputs[0].find((message) => message.role === 'assistant')?.content).toEqual([
      { type: 'output_text', text: '## Contas\nTexto parcial.' },
    ])
    expect(textOf(providerInputs[0])).toContain('Registre os votos exatos.')
    expect(tables.omnia_ata_minuta_versions.at(-1)?.origin).toBe('chat')
  })

  it('regenerates a completed draft from context when no instruction is supplied', async () => {
    await turn('Registre os votos exatos.')
    const previousMinuta = currentMinuta()!

    await turn()

    expect(previousMinuta.is_current).toBe(false)
    expect(currentMinuta()!.id).not.toBe(previousMinuta.id)
    expect(providerInputs[1]).toHaveLength(2)
    expect(providerInputs[1].some((message) => message.role === 'assistant')).toBe(false)
    expect(tables.omnia_ata_minuta_versions.map((row) => row.origin)).toEqual(['generation', 'generation'])
  })

  it('preserves the ongoing-generation error for an instructed turn', async () => {
    tables.omnia_ata_minutas.push({ id: 'ongoing-1', ata_id: 'ata-1', content: '', is_current: true, status: 'generating', updated_at: new Date().toISOString() })

    await expect(turn('Orientação inicial.')).rejects.toThrow('Uma geração já está em andamento para esta minuta.')
    expect(tables.omnia_ata_minutas).toHaveLength(1)
    expect(providerInputs).toHaveLength(0)
  })

  it('preserves the prerequisite error when transcription is missing', async () => {
    tables.omnia_ata_transcriptions = []

    await expect(turn('Orientação inicial.')).rejects.toThrow('Esta ata ainda não tem uma transcrição para gerar a minuta.')
    expect(tables.omnia_ata_minutas).toHaveLength(0)
    expect(providerInputs).toHaveLength(0)
  })
})
