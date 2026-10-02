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
import { getMinutaDocumentsValidationError, MINUTA_DOCUMENT_PROXY_MAX_SIZE_BYTES } from '@/lib/ataMinutaDocuments'

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

function assertMinutaDocumentStoragePath(ataId: string, userId: string, fileName: string, storagePath: string): void {
  const segments = storagePath.split('/')
  if (
    segments.length !== 3
    || segments[0] !== ataId
    || segments[1] !== userId
    || !/^[a-zA-Z0-9._-]+$/.test(segments[2])
    || !segments[2].endsWith(`-${sanitizeFileName(fileName)}`)
  ) {
    throw new Error('O caminho do documento enviado é inválido.')
  }
}

async function isMissingMinutaDocument(error: unknown): Promise<boolean> {
  if (!error || typeof error !== 'object') return false
  const storageError = error as { status?: number; statusCode?: string; originalError?: unknown }
  if (storageError.status === 404 || storageError.statusCode === '404' || storageError.statusCode === 'NoSuchKey') return true
  // download() usa noResolveJson: algumas versões encapsulam até erros HTTP num
  // StorageUnknownError. O serviço pode devolver HTTP 400 com NoSuchKey/404 no JSON.
  const original = storageError.originalError as { status?: number; json?: () => Promise<unknown> } | undefined
  if (!original || ![400, 404].includes(original.status ?? 0) || typeof original.json !== 'function') return false
  try {
    const payload = await original.json() as { code?: unknown; statusCode?: unknown }
    return payload.code === 'NoSuchKey' && payload.statusCode === '404'
  } catch {
    return false
  }
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

async function assertMinutaDocumentBudget(client: SupabaseClient, ataId: string, additionalSizeBytes: number): Promise<void> {
  const { data, error } = await client.from('omnia_ata_minuta_documents').select('size_bytes').eq('ata_id', ataId)
  if (error) throw new Error(error.message)
  const documents = ((data ?? []) as Array<{ size_bytes: number }>).map((row) => ({ sizeBytes: row.size_bytes }))
  const validationError = getMinutaDocumentsValidationError(documents, additionalSizeBytes)
  if (validationError) throw new Error(validationError)
}

export async function createMinutaDocumentUpload(
  authHeader: string | null,
  ataId: string,
  input: { fileName: string; sizeBytes: number },
) {
  const user = await currentUser(authHeader)
  const client = admin()
  const ata = await loadAtaForAccess(client, ataId)
  assertMinutaAccess(user, ata)

  const validationError = getMinutaDocumentValidationError({ name: input.fileName, type: 'application/pdf', size: input.sizeBytes })
  if (validationError) throw new Error(validationError)

  await assertMinutaDocumentBudget(client, ataId, input.sizeBytes)

  const storagePath = `${ataId}/${user.omniaUserId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`
  const { data, error } = await client.storage
    .from(MINUTA_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(storagePath)
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível preparar o envio do documento.')
  return { path: storagePath, token: data.token }
}

export async function confirmMinutaDocumentUpload(
  authHeader: string | null,
  ataId: string,
  input: { fileName: string; kind: MinutaDocumentKind; sizeBytes: number; storagePath: string },
) {
  const user = await currentUser(authHeader)
  const client = admin()
  const ata = await loadAtaForAccess(client, ataId)
  assertMinutaAccess(user, ata)

  const validationError = getMinutaDocumentValidationError({ name: input.fileName, type: 'application/pdf', size: input.sizeBytes })
  if (validationError) throw new Error(validationError)

  assertMinutaDocumentStoragePath(ataId, user.omniaUserId, input.fileName, input.storagePath)

  const findExisting = async () => {
    const { data: existing, error: existingError } = await client
      .from('omnia_ata_minuta_documents')
      .select('id, ata_id, kind, original_filename, size_bytes, created_at, created_by')
      .eq('storage_path', input.storagePath)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    return existing
  }
  const existingResponse = (existing: Record<string, unknown>) => {
    const row = existing as {
      id: string
      ata_id: string
      kind: MinutaDocumentKind
      original_filename: string
      size_bytes: number
      created_at: string
      created_by: string
    }
    if (row.ata_id !== ataId || row.created_by !== user.omniaUserId) throw new Error('Documento não encontrado.')
    return {
      id: row.id,
      ata_id: row.ata_id,
      kind: row.kind,
      original_filename: row.original_filename,
      size_bytes: row.size_bytes,
      created_at: row.created_at,
    }
  }
  const existing = await findExisting()
  if (existing) return existingResponse(existing)

  await assertMinutaDocumentBudget(client, ataId, input.sizeBytes)

  const { data: file, error: fileError } = await client.storage.from(MINUTA_DOCUMENTS_BUCKET).download(input.storagePath)
  if (fileError || !file) throw new Error('O upload do documento não foi concluído. Tente enviar o PDF novamente.')
  if (file.size !== input.sizeBytes) {
    await client.storage.from(MINUTA_DOCUMENTS_BUCKET).remove([input.storagePath])
    throw new Error('O arquivo enviado não corresponde ao tamanho informado.')
  }

  const { data, error } = await client
    .from('omnia_ata_minuta_documents')
    .insert({
      ata_id: ataId,
      kind: input.kind,
      storage_path: input.storagePath,
      original_filename: input.fileName,
      size_bytes: input.sizeBytes,
      created_by: user.omniaUserId,
    })
    .select('id, ata_id, kind, original_filename, size_bytes, created_at')
    .single()

  if (error?.code === '23505') {
    const concurrent = await findExisting()
    if (concurrent) return existingResponse(concurrent)
  }
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível salvar o documento.')
  return data
}

// Recupera apenas PDFs pequenos cuja conexão direta do navegador falhou. Reusa o
// caminho assinado para não duplicar um arquivo que tenha chegado sem resposta.
export async function uploadMinutaDocument(
  authHeader: string | null,
  ataId: string,
  input: { fileName: string; kind: MinutaDocumentKind; bytes: Uint8Array; storagePath: string },
) {
  const user = await currentUser(authHeader)
  const client = admin()
  const ata = await loadAtaForAccess(client, ataId)
  assertMinutaAccess(user, ata)

  if (!input.fileName.toLowerCase().endsWith('.pdf')) throw new Error('Formato não suportado. Envie um PDF.')
  if (!['convocacao', 'apuracao', 'outro'].includes(input.kind)) throw new Error('Tipo de documento inválido.')
  const sizeBytes = input.bytes.byteLength
  const validationError = getMinutaDocumentValidationError({ name: input.fileName, type: 'application/pdf', size: sizeBytes })
  if (validationError) throw new Error(validationError)
  if (sizeBytes > MINUTA_DOCUMENT_PROXY_MAX_SIZE_BYTES) throw new Error('A recuperação do envio aceita PDFs de até 4 MB.')
  assertMinutaDocumentStoragePath(ataId, user.omniaUserId, input.fileName, input.storagePath)

  const { data: existing, error: existingError } = await client
    .from('omnia_ata_minuta_documents')
    .select('id, ata_id, created_by, original_filename, size_bytes')
    .eq('storage_path', input.storagePath)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing) {
    if (existing.ata_id !== ataId || existing.created_by !== user.omniaUserId) throw new Error('Documento não encontrado.')
    if (existing.original_filename !== input.fileName || existing.size_bytes !== sizeBytes) throw new Error('O arquivo enviado não corresponde ao documento existente.')
  } else {
    await assertMinutaDocumentBudget(client, ataId, sizeBytes)
  }

  const storage = client.storage.from(MINUTA_DOCUMENTS_BUCKET)
  const verifyBytes = async (file: Blob) => {
    if (file.size !== sizeBytes) throw new Error('O arquivo enviado não corresponde ao documento existente.')
    const storedBytes = new Uint8Array(await file.arrayBuffer())
    if (!storedBytes.every((byte, index) => byte === input.bytes[index])) throw new Error('O arquivo enviado não corresponde ao documento existente.')
  }
  const { data: stored, error: storedError } = await storage.download(input.storagePath)
  if (stored) {
    await verifyBytes(stored)
  } else {
    if (!(await isMissingMinutaDocument(storedError))) {
      throw new Error(storedError?.message ?? 'Não foi possível verificar o envio do documento.')
    }
    const { error: uploadError } = await storage.upload(input.storagePath, input.bytes, { contentType: 'application/pdf', upsert: false })
    if (uploadError) {
      // O upload direto pode ter concluído entre a consulta acima e esta escrita.
      const { data: raced } = await storage.download(input.storagePath)
      if (!raced) throw new Error(uploadError.message)
      await verifyBytes(raced)
    }
  }

  // Um outro pedido pode estar confirmando o mesmo caminho neste momento. Mantém
  // o PDF verificado se a confirmação falhar, pois consultar e depois remover não
  // é atômico e poderia apagar um arquivo vinculado por essa outra requisição.
  return confirmMinutaDocumentUpload(authHeader, ataId, { fileName: input.fileName, kind: input.kind, sizeBytes, storagePath: input.storagePath })
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
    .select('storage_path, original_filename, size_bytes')
    .eq('ata_id', ataId)
  if (error) throw new Error(error.message)

  const documents = (rows ?? []) as Array<{ storage_path: string; original_filename: string; size_bytes: number }>
  const validationError = getMinutaDocumentsValidationError(documents.map((row) => ({ sizeBytes: row.size_bytes })))
  if (validationError) throw new Error(validationError)

  const inputs = [] as Array<{ originalFilename: string; base64: string }>
  // Processar um PDF de cada vez evita manter todos os blobs e buffers em memória
  // ao mesmo tempo. O teto agregado também é conferido antes do primeiro download.
  for (const row of documents) {
    const { data: file, error: downloadError } = await client.storage.from(MINUTA_DOCUMENTS_BUCKET).download(row.storage_path)
    if (downloadError || !file) throw new Error(`Não foi possível carregar o documento ${row.original_filename}.`)
    const fileValidationError = getMinutaDocumentValidationError({ name: row.original_filename, type: 'application/pdf', size: file.size })
    if (fileValidationError) throw new Error(fileValidationError)
    if (file.size !== row.size_bytes) {
      throw new Error(`O documento ${row.original_filename} não corresponde ao tamanho informado.`)
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    inputs.push({ originalFilename: row.original_filename, base64: buffer.toString('base64') })
  }
  return inputs
}

// Um turno por vez: sem instrução é geração (do zero, supera a minuta atual).
// Instruções sem minuta escrita orientam a geração inicial; com texto existente,
// refinam a minuta atual salva no banco, respeitando também as edições manuais.
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

  let turnInstruction = instruction?.trim() || undefined
  const hasCurrentContent = Boolean(currentMinuta?.content.trim())
  const isRefinement = Boolean(turnInstruction && hasCurrentContent)
  if (currentMinuta?.status === 'generating' && Date.now() - new Date(currentMinuta.updated_at).getTime() < GENERATION_STALE_MS) {
    throw new Error('Uma geração já está em andamento para esta minuta.')
  }
  // Refazer uma geração interrompida mantém as orientações já fornecidas. Uma
  // string vazia explícita permite apagar essas orientações antes de tentar de novo.
  if (instruction === undefined && currentMinuta && (currentMinuta.status === 'failed' || currentMinuta.status === 'generating')) {
    const { data: messageRows, error: messagesError } = await client
      .from('omnia_ata_minuta_messages')
      .select('content')
      .eq('minuta_id', currentMinuta.id)
      .eq('role', 'user')
      .order('sequence', { ascending: true })
    if (messagesError) throw new Error(messagesError.message)
    turnInstruction = (messageRows as Array<{ content: string }> | null)?.map(row => row.content.trim()).filter(Boolean).join('\n') || undefined
  }

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

  if (isRefinement && currentMinuta && turnInstruction) {
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
      instruction: turnInstruction,
    })

    await client.from('omnia_ata_minutas').update({ status: 'generating', error_message: null }).eq('id', minutaId)
    await insertMinutaMessage(client, minutaId, 'user', turnInstruction, user.omniaUserId)
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
    input = buildMinutaResponsesInput(settingsRow.system_prompt, { ...baseContext, instruction: turnInstruction })
    if (turnInstruction) await insertMinutaMessage(client, minutaId, 'user', turnInstruction, user.omniaUserId)
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

    const versionId = await insertMinutaVersion(client, minutaId, accumulated, isRefinement ? 'chat' : 'generation', user.omniaUserId, settingsRow.model, usage)
    if (turnInstruction) {
      await insertMinutaMessage(client, minutaId, 'assistant', accumulated, user.omniaUserId, versionId)
    }
    const { data: readyMinuta, error: readyError } = await client
      .from('omnia_ata_minutas')
      .update({ status: 'ready', content: accumulated, usage: usage ?? {} })
      .eq('id', minutaId)
      .select('id')
      .maybeSingle()
    if (readyError || !readyMinuta) {
      throw new Error(readyError?.message ?? 'Não foi possível finalizar a minuta.')
    }
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
