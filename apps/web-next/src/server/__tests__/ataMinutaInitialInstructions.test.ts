import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResponsesInputMessage } from '@/lib/ataMinuta'
import { saveMinutaManualEdit, streamMinutaTurn } from '../ataMinutaService'
import { POST } from '@/app/api/atas/[ataId]/minuta/route'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: Promise<unknown> | (() => unknown)) => { void Promise.resolve(typeof task === 'function' ? task() : task) },
}))

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
// Quando definido, o provedor entrega o primeiro trecho e só conclui depois dele.
let providerGate: Promise<void> | null
// Roteiro de cada stream aberto no provedor, na ordem; vazio = 'complete'.
type ProviderScript = 'complete' | 'hang' | 'cut' | 'network-error' | 'missing'
let providerScripts: ProviderScript[]
let providerStarts: Array<Record<string, unknown>>
let providerResumes: string[]
let providerStatusChecks: string[]
let providerRemoteStatus: string

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function externalHttp(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.hostname === 'api.openai.com') {
    const isStatusCheck = (init?.method ?? 'GET') === 'GET' && !url.searchParams.has('stream')
    if (isStatusCheck) {
      providerStatusChecks.push(url.pathname)
      return providerRemoteStatus === 'not_found' ? json({ error: { message: 'not found' } }, 404) : json({ status: providerRemoteStatus, error: null })
    }
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      providerStarts.push(body)
      providerInputs.push(body.input)
      if (providerFailure) return new Response('Serviço indisponível', { status: 503 })
    } else {
      providerResumes.push(url.pathname)
    }
    const script = providerScripts.shift() ?? 'complete'
    if (script === 'missing') return new Response('not found', { status: 404 })
    const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`
    const created = frame({ type: 'response.created', response: { id: 'resp_1', status: 'queued' } })
    const delta = frame({ type: 'response.output_text.delta', delta: providerText })
    const completed = frame({ type: 'response.completed', response: { usage: { input_tokens: 10, output_tokens: 5 } } })
    if (script === 'complete' && !providerGate) return new Response(created + delta + completed, { headers: { 'Content-Type': 'text/event-stream' } })
    const gate = providerGate
    const encoder = new TextEncoder()
    const signal = init?.signal
    const body = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(created + delta))
        if (script === 'cut') return controller.close()
        if (script === 'network-error') {
          // Um stream que erra com chunks ainda na fila descarta a fila: só erra depois de lida.
          await new Promise((resolve) => setTimeout(resolve, 5))
          return controller.error(new TypeError('terminated'))
        }
        if (script === 'hang') {
          signal?.addEventListener('abort', () => controller.error(new DOMException('This operation was aborted', 'AbortError')))
          return
        }
        await gate
        controller.enqueue(encoder.encode(completed))
        controller.close()
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
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
    const body = JSON.parse(init?.body as string)
    if (table === 'omnia_ata_minutas' && body.is_current !== false && records.some((row) => row.ata_id === body.ata_id && row.is_current)) {
      return json({ code: '23505', message: 'duplicate key value violates unique constraint "omnia_ata_minutas_one_current_per_ata"' }, 409)
    }
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
    providerGate = null
    providerScripts = []
    providerStarts = []
    providerResumes = []
    providerStatusChecks = []
    providerRemoteStatus = 'in_progress'
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
  const ready = (overrides: Row = {}): Row => ({
    id: 'ready-1', ata_id: 'ata-1', content: '## Contas\nTexto pronto.', is_current: true, status: 'ready',
    updated_at: new Date(Date.now() - 60_000).toISOString(), ...overrides,
  })

  it('lets only one of two simultaneous chat refinements of the same draft run', async () => {
    tables.omnia_ata_minutas.push(ready())

    const results = await Promise.allSettled([turn('Deixe mais formal.'), turn('Resuma os votos.')])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    expect(rejected?.reason).toMatchObject({ message: 'Uma geração já está em andamento para esta minuta.' })
    expect(providerInputs).toHaveLength(1)
    expect(tables.omnia_ata_minuta_versions).toHaveLength(1)
    expect(currentMinuta()).toMatchObject({ id: 'ready-1', status: 'ready' })
  })

  it('lets only one of two simultaneous regenerations of a completed draft run, keeping it current', async () => {
    tables.omnia_ata_minutas.push(ready())

    const results = await Promise.allSettled([turn(), turn()])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { message: 'Uma geração já está em andamento para esta minuta.' } })
    expect(tables.omnia_ata_minutas.filter((row) => row.is_current)).toHaveLength(1)
    expect(providerInputs).toHaveLength(1)
  })

  it('lets only one of two simultaneous first generations run, with a clear message for the other', async () => {
    const results = await Promise.allSettled([turn(), turn()])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { message: 'Uma geração já está em andamento para esta minuta.' } })
    expect(tables.omnia_ata_minutas).toHaveLength(1)
    expect(currentMinuta()).toMatchObject({ status: 'ready' })
  })

  it('keeps generating when the user closes the tab mid-stream, instead of failing the draft', async () => {
    let finishProvider!: () => void
    providerGate = new Promise<void>((resolve) => { finishProvider = resolve })
    const response = await POST(new Request('http://localhost/api/atas/ata-1/minuta', {
      method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    }), { params: Promise.resolve({ ataId: 'ata-1' }) })
    const reader = response.body!.getReader()
    await reader.read()

    await reader.cancel()
    expect(currentMinuta()).toMatchObject({ status: 'generating' })
    finishProvider()

    await vi.waitFor(() => expect(currentMinuta()).toMatchObject({ status: 'ready', content: '## Contas\nAprovadas por unanimidade.' }))
    expect(tables.omnia_ata_minuta_versions).toHaveLength(1)
  })
  it('refuses a manual edit while a generation is writing to the same draft', async () => {
    tables.omnia_ata_minutas.push(ready({ status: 'generating', updated_at: new Date().toISOString() }))

    await expect(saveMinutaManualEdit('Bearer test-token', 'ata-1', 'Edição em outra aba.')).rejects.toThrow('A minuta está sendo gerada. Aguarde terminar para editar.')
    expect(currentMinuta()!.content).toBe('## Contas\nTexto pronto.')
    expect(tables.omnia_ata_minuta_versions).toHaveLength(0)
  })

  it('still accepts a manual edit once the generation has finished', async () => {
    tables.omnia_ata_minutas.push(ready())

    await saveMinutaManualEdit('Bearer test-token', 'ata-1', 'Texto revisado à mão.')

    expect(currentMinuta()!.content).toBe('Texto revisado à mão.')
    expect(tables.omnia_ata_minuta_versions).toEqual([expect.objectContaining({ origin: 'manual' })])
  })

  async function resumeTurn() {
    const events = []
    for await (const event of streamMinutaTurn('Bearer test-token', 'ata-1', undefined, { resume: true })) events.push(event)
    return events
  }

  describe('generation in the OpenAI background', () => {
    // A janela da função acaba no meio do raciocínio: o relógio é falso para não
    // esperar 4 minutos de verdade, e o stream do provedor termina com o abort.
    async function runPastTheWindow(instruction?: string) {
      providerScripts = ['hang']
      const events: Awaited<ReturnType<typeof turn>> = []
      const consumption = (async () => { for await (const event of streamMinutaTurn('Bearer test-token', 'ata-1', instruction)) events.push(event) })()
      await vi.advanceTimersByTimeAsync(241_000)
      await consumption
      return events
    }

    it('starts the response in background mode and records it while generating', async () => {
      let finishProvider!: () => void
      providerGate = new Promise<void>((resolve) => { finishProvider = resolve })
      const consumption = turn('Registre os votos exatos.')
      await vi.waitFor(() => expect(currentMinuta()?.generation_run).toMatchObject({ response_id: 'resp_1', origin: 'generation', with_instruction: true, model: 'test-model' }))
      expect(providerStarts[0]).toMatchObject({ background: true, stream: true })

      finishProvider()
      await consumption
      expect(currentMinuta()).toMatchObject({ status: 'ready', generation_run: null })
    })

    it('hands over at the end of the window without failing, keeping the partial text', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
      try {
        const events = await runPastTheWindow('Registre os votos exatos.')

        expect(events.at(-1)).toEqual({ type: 'continue' })
        expect(currentMinuta()).toMatchObject({ status: 'generating', content: '## Contas\nAprovadas por unanimidade.', generation_run: { response_id: 'resp_1' } })
        expect(tables.omnia_ata_minuta_versions).toHaveLength(0)
      } finally {
        vi.useRealTimers()
      }
    })

    it('resumes the response by id and closes the turn exactly as the first request would have', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
      try {
        await runPastTheWindow('Registre os votos exatos.')
      } finally {
        vi.useRealTimers()
      }

      const events = await resumeTurn()

      expect(providerResumes).toEqual(['/v1/responses/resp_1'])
      expect(providerStarts).toHaveLength(1)
      expect(events.at(-1)).toEqual({ type: 'done', content: '## Contas\nAprovadas por unanimidade.' })
      expect(currentMinuta()).toMatchObject({ status: 'ready', generation_run: null, usage: { input_tokens: 10, output_tokens: 5 } })
      expect(tables.omnia_ata_minuta_versions).toEqual([expect.objectContaining({ origin: 'generation', model: 'test-model' })])
      expect(tables.omnia_ata_minuta_messages.map((row) => row.role)).toEqual(['user', 'assistant'])
    })

    it('keeps the chat origin when a refinement is resumed', async () => {
      tables.omnia_ata_minutas.push({ id: 'ready-1', ata_id: 'ata-1', content: '## Contas\nTexto pronto.', is_current: true, status: 'ready', updated_at: new Date(Date.now() - 60_000).toISOString() })
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
      try {
        await runPastTheWindow('Deixe mais formal.')
      } finally {
        vi.useRealTimers()
      }

      await resumeTurn()

      expect(tables.omnia_ata_minuta_versions).toEqual([expect.objectContaining({ origin: 'chat' })])
      expect(tables.omnia_ata_minuta_messages.map((row) => row.role)).toEqual(['user', 'assistant'])
    })

    it('does not duplicate the version when two tabs follow the same response', async () => {
      tables.omnia_ata_minutas.push({ id: 'run-1', ata_id: 'ata-1', content: '', is_current: true, status: 'generating', updated_at: new Date(Date.now() - 120_000).toISOString(),
        generation_run: { response_id: 'resp_1', origin: 'generation', with_instruction: false, model: 'test-model' } })

      const [first, second] = await Promise.all([resumeTurn(), resumeTurn()])

      expect(first.at(-1)).toMatchObject({ type: 'done' })
      expect(second.at(-1)).toMatchObject({ type: 'done' })
      expect(tables.omnia_ata_minuta_versions).toHaveLength(1)
      expect(currentMinuta()).toMatchObject({ status: 'ready' })
    })

    it('answers a resume for a draft another tab already finished with that draft', async () => {
      tables.omnia_ata_minutas.push({ id: 'ready-1', ata_id: 'ata-1', content: '## Contas\nTexto pronto.', is_current: true, status: 'ready', updated_at: new Date().toISOString() })

      await expect(resumeTurn()).resolves.toEqual([{ type: 'done', content: '## Contas\nTexto pronto.' }])
      expect(providerResumes).toHaveLength(0)
    })

    it('refuses to resume a draft with no response to follow', async () => {
      tables.omnia_ata_minutas.push({ id: 'old-1', ata_id: 'ata-1', content: '', is_current: true, status: 'generating', updated_at: new Date().toISOString() })

      await expect(resumeTurn()).rejects.toThrow('Esta geração não pode ser retomada')
    })

    it('fails the draft when the response no longer exists at OpenAI', async () => {
      tables.omnia_ata_minutas.push({ id: 'run-1', ata_id: 'ata-1', content: '', is_current: true, status: 'generating', updated_at: new Date().toISOString(),
        generation_run: { response_id: 'resp_gone', origin: 'generation', with_instruction: false, model: 'test-model' } })
      providerScripts = ['missing']

      const events = await resumeTurn()

      expect(events.at(-1)).toMatchObject({ type: 'error', message: expect.stringContaining('não encontrou mais') })
      expect(currentMinuta()).toMatchObject({ status: 'failed', generation_run: null })
    })

    it('treats a cut stream as a hand-over while the response is still running', async () => {
      providerScripts = ['cut']
      providerRemoteStatus = 'in_progress'

      const events = await turn()

      expect(events.at(-1)).toEqual({ type: 'continue' })
      expect(providerStatusChecks).toEqual(['/v1/responses/resp_1'])
      expect(currentMinuta()).toMatchObject({ status: 'generating', generation_run: { response_id: 'resp_1' } })
    })

    it('fails the draft when a cut stream belongs to a response OpenAI already ended badly', async () => {
      providerScripts = ['cut']
      providerRemoteStatus = 'cancelled'

      const events = await turn()

      expect(events.at(-1)).toMatchObject({ type: 'error', message: expect.stringContaining('cancelled') })
      expect(currentMinuta()).toMatchObject({ status: 'failed', generation_run: null })
    })

    it('does not fail the draft on a network drop once the response is registered', async () => {
      providerScripts = ['network-error']

      const events = await turn()

      expect(events.at(-1)).toEqual({ type: 'continue' })
      expect(currentMinuta()).toMatchObject({ status: 'generating', generation_run: { response_id: 'resp_1' } })
    })

    it('keeps a draft with a registered response "in progress" even after a long silence', async () => {
      tables.omnia_ata_minutas.push({ id: 'run-1', ata_id: 'ata-1', content: '', is_current: true, status: 'generating', updated_at: new Date(Date.now() - 600_000).toISOString(),
        generation_run: { response_id: 'resp_1', origin: 'generation', with_instruction: false, model: 'test-model' } })

      await expect(turn()).rejects.toThrow('Uma geração já está em andamento para esta minuta.')
      await expect(saveMinutaManualEdit('Bearer test-token', 'ata-1', 'Edição em outra aba.')).rejects.toThrow('A minuta está sendo gerada.')
      expect(providerStarts).toHaveLength(0)
    })
  })
})
