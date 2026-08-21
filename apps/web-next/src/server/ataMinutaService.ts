import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  buildMinutaResponsesInput,
  canAccessMinuta,
  getMinutaDocumentValidationError,
  type AtaMinutaStreamEvent,
  type MinutaGenerationContext,
} from '@/lib/ataMinuta'
import type { AtaMinutaReasoningEffort } from '@/data/types'
import { parseSseBlock, splitSseBlocks } from '@/lib/openaiResponsesStream'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const MINUTA_DOCUMENTS_BUCKET = 'ata-minuta-documents'
const FLUSH_INTERVAL_MS = 2000
// Acima disso, uma minuta parada em "generating" é tratada como interrompida (função
// derrubada, conexão perdida), não como uma geração em andamento — ver risco assumido
// no spec. É maior que o intervalo de flush para não confundir uma pausa entre blocos
// SSE com uma interrupção real.
const GENERATION_STALE_MS = 90_000

type AuthenticatedUser = { authUserId: string; omniaUserId: string; roles: string[] }
export type MinutaDocumentKind = 'convocacao' | 'apuracao' | 'outro'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function admin(): SupabaseClient {
  return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function currentUser(authHeader: string | null): Promise<AuthenticatedUser> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Usuário não autenticado.')
  const token = authHeader.slice(7)
  const anon = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) throw new Error('Sessão inválida.')
  const { data: omniaUser, error: omniaError } = await admin()
    .from('omnia_users')
    .select('id, roles')
    .eq('auth_user_id', data.user.id)
    .single()
  if (omniaError || !omniaUser) throw new Error('Perfil Omnia não encontrado.')
  return { authUserId: data.user.id, omniaUserId: omniaUser.id, roles: omniaUser.roles ?? [] }
}

function assertAdmin(user: AuthenticatedUser) {
  if (!user.roles.includes('ADMIN')) throw new Error('Ação permitida somente para administradores.')
}

async function loadAtaForAccess(client: SupabaseClient, ataId: string) {
  const { data, error } = await client
    .from('omnia_atas')
    .select('id, title, meeting_date, responsible_id, condominium_id')
    .eq('id', ataId)
    .maybeSingle()
  if (error || !data) throw new Error('Ata não encontrada.')
  return data as { id: string; title: string; meeting_date: string | null; responsible_id: string | null; condominium_id: string | null }
}

function assertMinutaAccess(user: AuthenticatedUser, ata: { responsible_id: string | null }) {
  if (!canAccessMinuta(user, { responsibleId: ata.responsible_id })) {
    throw new Error('Você não tem permissão para acessar a minuta desta ata.')
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160)
}

async function nextSequence(client: SupabaseClient, table: string, minutaId: string): Promise<number> {
  const { data } = await client.from(table).select('sequence').eq('minuta_id', minutaId).order('sequence', { ascending: false }).limit(1).maybeSingle()
  return ((data as { sequence: number } | null)?.sequence ?? -1) + 1
}

async function insertMinutaVersion(
  client: SupabaseClient,
  minutaId: string,
  content: string,
  origin: 'generation' | 'chat' | 'manual',
  createdBy: string,
  model?: string,
  usage?: Record<string, unknown>,
): Promise<string> {
  const sequence = await nextSequence(client, 'omnia_ata_minuta_versions', minutaId)
  const { data, error } = await client
    .from('omnia_ata_minuta_versions')
    .insert({ minuta_id: minutaId, sequence, content, origin, created_by: createdBy, model: model ?? null, usage: usage ?? {} })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível salvar a versão da minuta.')
  return (data as { id: string }).id
}

async function insertMinutaMessage(
  client: SupabaseClient,
  minutaId: string,
  role: 'user' | 'assistant',
  content: string,
  createdBy: string,
  versionId?: string,
): Promise<void> {
  const sequence = await nextSequence(client, 'omnia_ata_minuta_messages', minutaId)
  const { error } = await client
    .from('omnia_ata_minuta_messages')
    .insert({ minuta_id: minutaId, sequence, role, content, created_by: createdBy, version_id: versionId ?? null })
  if (error) throw new Error(error.message)
}

// ---- Configurações (Configurações → Atas) ----

export async function getMinutaSettings(authHeader: string | null) {
  await currentUser(authHeader)
  const { data, error } = await admin().from('omnia_ata_minuta_settings').select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Configuração de minuta não encontrada.')
  return data
}

export async function updateMinutaSettings(
  authHeader: string | null,
  input: { model: string; reasoningEffort: AtaMinutaReasoningEffort; systemPrompt: string },
) {
  const user = await currentUser(authHeader)
  assertAdmin(user)
  if (!input.model.trim()) throw new Error('Informe o id do modelo.')
  if (!input.systemPrompt.trim()) throw new Error('Informe o prompt do secretário.')
  const { data, error } = await admin()
    .from('omnia_ata_minuta_settings')
    .update({
      model: input.model.trim(),
      reasoning_effort: input.reasoningEffort,
      system_prompt: input.systemPrompt,
      updated_by: user.omniaUserId,
    })
    .eq('singleton', true)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível salvar a configuração.')
  return data
}

// Um id de modelo errado hoje só aparece no meio de uma geração de vários minutos.
// Este botão devolve o mesmo erro na hora, antes de qualquer assembleia depender dele.
export async function verifyMinutaModel(authHeader: string | null, modelId: string): Promise<{ ok: boolean; message: string }> {
  const user = await currentUser(authHeader)
  assertAdmin(user)
  if (!modelId.trim()) return { ok: false, message: 'Informe o id do modelo.' }
  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(modelId.trim())}`, {
    headers: { Authorization: `Bearer ${env('OPENAI_ATA_MINUTA_API_KEY')}` },
  })
  if (response.ok) return { ok: true, message: 'Modelo encontrado na OpenAI.' }
  if (response.status === 404) return { ok: false, message: 'A OpenAI não reconhece este id de modelo.' }
  const body = await response.text()
  return { ok: false, message: `Falha ao verificar o modelo (HTTP ${response.status}): ${body}` }
}

// ---- Documentos de apoio (convocação, apuração de votação) ----

export async function uploadMinutaDocument(
  authHeader: string | null,
  ataId: string,
  input: { fileName: string; kind: MinutaDocumentKind; bytes: Uint8Array },
) {
  const user = await currentUser(authHeader)
  const client = admin()
  const ata = await loadAtaForAccess(client, ataId)
  assertMinutaAccess(user, ata)

  const validationError = getMinutaDocumentValidationError({ name: input.fileName, type: 'application/pdf', size: input.bytes.byteLength })
  if (validationError) throw new Error(validationError)

  const storagePath = `${ataId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`
  const { error: uploadError } = await client.storage
    .from(MINUTA_DOCUMENTS_BUCKET)
    .upload(storagePath, input.bytes, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await client
    .from('omnia_ata_minuta_documents')
    .insert({
      ata_id: ataId,
      kind: input.kind,
      storage_path: storagePath,
      original_filename: input.fileName,
      size_bytes: input.bytes.byteLength,
      created_by: user.omniaUserId,
    })
    .select('id, kind, original_filename, size_bytes, created_at')
    .single()

  if (error || !data) {
    await client.storage.from(MINUTA_DOCUMENTS_BUCKET).remove([storagePath])
    throw new Error(error?.message ?? 'Não foi possível salvar o documento.')
  }
  return data
}

export async function deleteMinutaDocument(authHeader: string | null, ataId: string, documentId: string): Promise<void> {
  const user = await currentUser(authHeader)
  const client = admin()
  const ata = await loadAtaForAccess(client, ataId)
  assertMinutaAccess(user, ata)

  const { data: document, error } = await client
    .from('omnia_ata_minuta_documents')
    .select('id, storage_path')
    .eq('id', documentId)
    .eq('ata_id', ataId)
    .maybeSingle()
  if (error || !document) throw new Error('Documento não encontrado.')

  const row = document as { id: string; storage_path: string }
  await client.storage.from(MINUTA_DOCUMENTS_BUCKET).remove([row.storage_path])
  const { error: deleteError } = await client.from('omnia_ata_minuta_documents').delete().eq('id', documentId)
  if (deleteError) throw new Error(deleteError.message)
}

// ---- Edição manual ----

export async function saveMinutaManualEdit(authHeader: string | null, ataId: string, content: string): Promise<void> {
  const user = await currentUser(authHeader)
  const client = admin()
  const ata = await loadAtaForAccess(client, ataId)
  assertMinutaAccess(user, ata)

  const { data: minuta, error } = await client
    .from('omnia_ata_minutas')
    .select('id')
    .eq('ata_id', ataId)
    .eq('is_current', true)
    .maybeSingle()
  if (error || !minuta) throw new Error('Nenhuma minuta para editar.')

  const minutaId = (minuta as { id: string }).id
  await insertMinutaVersion(client, minutaId, content, 'manual', user.omniaUserId)
  const { error: updateError } = await client.from('omnia_ata_minutas').update({ content }).eq('id', minutaId)
  if (updateError) throw new Error(updateError.message)
}

// ---- Geração e refinamento por chat ----

async function downloadDocumentsAsBase64(client: SupabaseClient, ataId: string) {
  const { data: rows, error } = await client
    .from('omnia_ata_minuta_documents')
    .select('storage_path, original_filename')
    .eq('ata_id', ataId)
  if (error) throw new Error(error.message)

  return Promise.all(
    ((rows ?? []) as Array<{ storage_path: string; original_filename: string }>).map(async (row) => {
      const { data: file, error: downloadError } = await client.storage.from(MINUTA_DOCUMENTS_BUCKET).download(row.storage_path)
      if (downloadError || !file) throw new Error(`Não foi possível carregar o documento ${row.original_filename}.`)
      const buffer = Buffer.from(await file.arrayBuffer())
      return { originalFilename: row.original_filename, base64: buffer.toString('base64') }
    }),
  )
}

// Um turno por vez: sem instrução é geração (do zero, supera a minuta atual); com
// instrução é refinamento (parte da minuta atual salva no banco, não da última
// resposta do modelo — assim uma edição manual feita entre dois turnos é respeitada).
export async function* streamMinutaTurn(
  authHeader: string | null,
  ataId: string,
  instruction: string | undefined,
): AsyncGenerator<AtaMinutaStreamEvent> {
  const user = await currentUser(authHeader)
  const client = admin()
  const ata = await loadAtaForAccess(client, ataId)
  assertMinutaAccess(user, ata)

  const { data: settings, error: settingsError } = await client.from('omnia_ata_minuta_settings').select('*').single()
  if (settingsError || !settings) throw new Error('Configuração de minuta não encontrada.')
  const settingsRow = settings as { model: string; reasoning_effort: string; system_prompt: string }
  if (!settingsRow.model.trim()) throw new Error('Configure o modelo de geração de minuta em Configurações → Atas.')

  const condominium = ata.condominium_id
    ? (await client.from('omnia_condominiums').select('name').eq('id', ata.condominium_id).maybeSingle()).data as { name: string } | null
    : null

  const { data: transcriptionJob } = await client
    .from('omnia_ata_transcription_jobs')
    .select('id, context_text')
    .eq('ata_id', ataId)
    .eq('is_current', true)
    .maybeSingle()
  const job = transcriptionJob as { id: string; context_text: string | null } | null

  const transcription = job
    ? (await client.from('omnia_ata_transcriptions').select('id, raw_text, revised_text').eq('job_id', job.id).maybeSingle())
      .data as { id: string; raw_text: string; revised_text: string | null } | null
    : null
  const transcriptionText = transcription?.revised_text ?? transcription?.raw_text
  if (!transcriptionText) throw new Error('Esta ata ainda não tem uma transcrição para gerar a minuta.')

  const documents = await downloadDocumentsAsBase64(client, ataId)

  const { data: currentMinutaRow } = await client
    .from('omnia_ata_minutas')
    .select('id, content, status, updated_at')
    .eq('ata_id', ataId)
    .eq('is_current', true)
    .maybeSingle()
  const currentMinuta = currentMinutaRow as { id: string; content: string; status: string; updated_at: string } | null

  const baseContext: MinutaGenerationContext = {
    ataTitle: ata.title,
    condominiumName: condominium?.name,
    meetingDate: ata.meeting_date ?? undefined,
    transcriptionText,
    convocacaoContextText: job?.context_text ?? undefined,
    documents,
  }

  let minutaId: string
  let input: ReturnType<typeof buildMinutaResponsesInput>

  if (instruction) {
    if (!currentMinuta) throw new Error('Gere a minuta antes de pedir correções.')
    if (currentMinuta.status === 'generating' && Date.now() - new Date(currentMinuta.updated_at).getTime() < GENERATION_STALE_MS) {
      throw new Error('Uma geração já está em andamento para esta minuta.')
    }
    minutaId = currentMinuta.id
    const { data: messageRows } = await client
      .from('omnia_ata_minuta_messages')
      .select('content')
      .eq('minuta_id', minutaId)
      .eq('role', 'user')
      .order('sequence', { ascending: true })
    const priorInstructions = ((messageRows ?? []) as Array<{ content: string }>).map((row) => row.content)

    input = buildMinutaResponsesInput(settingsRow.system_prompt, {
      ...baseContext,
      currentContent: currentMinuta.content,
      priorInstructions,
      instruction,
    })

    await client.from('omnia_ata_minutas').update({ status: 'generating', error_message: null }).eq('id', minutaId)
    await insertMinutaMessage(client, minutaId, 'user', instruction, user.omniaUserId)
  } else {
    if (currentMinuta) await client.from('omnia_ata_minutas').update({ is_current: false }).eq('id', currentMinuta.id)
    const { data: created, error: createError } = await client
      .from('omnia_ata_minutas')
      .insert({
        ata_id: ataId,
        transcription_id: transcription?.id ?? null,
        created_by: user.omniaUserId,
        status: 'generating',
        model: settingsRow.model,
      })
      .select('id')
      .single()
    if (createError || !created) throw new Error(createError?.message ?? 'Não foi possível iniciar a minuta.')
    minutaId = (created as { id: string }).id
    input = buildMinutaResponsesInput(settingsRow.system_prompt, baseContext)
  }

  // Se quem chamou parar de consumir o stream no meio (aba fechada, wifi caiu), o
  // route handler chama events.return() — isso interrompe a função exatamente no yield
  // suspenso, e o finally abaixo roda do mesmo jeito que rodaria num catch: libera o
  // reader e tira a minuta de "generating", em vez de deixar o gerador pendurado para
  // sempre segurando uma conexão aberta com a OpenAI.
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let settled = false

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('OPENAI_ATA_MINUTA_API_KEY')}` },
      body: JSON.stringify({
        model: settingsRow.model,
        input,
        stream: true,
        reasoning: { effort: settingsRow.reasoning_effort },
      }),
    })

    if (!response.ok || !response.body) {
      const body = await response.text()
      throw new Error(`A OpenAI recusou a geração (HTTP ${response.status}): ${body}`)
    }

    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''
    let lastFlush = Date.now()
    let usage: Record<string, unknown> | undefined

    const flush = async (force: boolean) => {
      if (!force && Date.now() - lastFlush < FLUSH_INTERVAL_MS) return
      lastFlush = Date.now()
      await client.from('omnia_ata_minutas').update({ content: accumulated }).eq('id', minutaId)
    }

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { blocks, remainder } = splitSseBlocks(buffer)
      buffer = remainder
      for (const block of blocks) {
        const event = parseSseBlock(block)
        if (event.type === 'delta') {
          accumulated += event.text
          yield { type: 'delta', text: event.text }
          await flush(false)
        } else if (event.type === 'completed') {
          usage = event.usage
        } else if (event.type === 'failed') {
          throw new Error(event.message)
        }
      }
    }
    await flush(true)

    if (!accumulated.trim()) throw new Error('A OpenAI não devolveu texto para a minuta.')

    const versionId = await insertMinutaVersion(client, minutaId, accumulated, instruction ? 'chat' : 'generation', user.omniaUserId, settingsRow.model, usage)
    if (instruction) {
      await insertMinutaMessage(client, minutaId, 'assistant', accumulated, user.omniaUserId, versionId)
    }
    await client.from('omnia_ata_minutas').update({ status: 'ready', content: accumulated, usage: usage ?? {} }).eq('id', minutaId)
    settled = true

    yield { type: 'done', content: accumulated }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível gerar a minuta.'
    await client.from('omnia_ata_minutas').update({ status: 'failed', error_message: message }).eq('id', minutaId)
    settled = true
    yield { type: 'error', message }
  } finally {
    reader?.releaseLock()
    if (!settled) {
      await client
        .from('omnia_ata_minutas')
        .update({ status: 'failed', error_message: 'A conexão foi perdida durante a geração.' })
        .eq('id', minutaId)
        .eq('status', 'generating')
    }
  }
}
