import nodemailer from 'nodemailer'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  MALOTE_MAX_FILES_PER_BATCH,
  MALOTE_MAX_FILE_SIZE_BYTES,
  maloteFileExtension,
  type MaloteSendEvent,
  type MaloteSendResult,
  renderMaloteTemplate,
  resolveMaloteContentType,
  validateMaloteFile,
  validateMaloteTemplate,
} from '@/lib/malotes'
import { sendMaloteEmail } from '@/server/maloteEmail'

const DELIVERY_RESOLUTION_DELAY_MS = 30 * 60 * 1000
// Acima da duração máxima de uma execução de envio (300s), para nunca condenar um lote em andamento.
const ABANDONED_UPLOAD_DELAY_MS = 15 * 60 * 1000

type AuthenticatedUser = { authUserId: string; omniaUserId: string; roles: string[] }
type FileInput = { name: string; size: number; type: string }

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

function assertTemplate(template: string, field: string) {
  if (!template.trim()) throw new Error(`${field} é obrigatório.`)
  const validation = validateMaloteTemplate(template)
  if (!validation.valid) throw new Error(validation.error)
}

function normalizeFileName(name: string) {
  return name.replace(/[\r\n]/g, '_').trim()
}

function storageSuffix(fileName: string) {
  const extension = maloteFileExtension(fileName)
  return extension ? `.${extension}` : ''
}

function assertFiles(files: FileInput[]) {
  if (files.length === 0) throw new Error('Selecione ao menos um arquivo.')
  if (files.length > MALOTE_MAX_FILES_PER_BATCH) throw new Error(`Envie no máximo ${MALOTE_MAX_FILES_PER_BATCH} arquivos por malote.`)
  for (const file of files) {
    const validation = validateMaloteFile(file)
    if (!validation.valid) throw new Error(validation.error)
  }
}

export async function getMaloteSettings(authHeader: string | null) {
  await currentUser(authHeader)
  const { data, error } = await admin().from('omnia_malote_settings').select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Configuração de malotes não encontrada.')
  return data
}

export async function updateMaloteSettings(authHeader: string | null, input: { recipientEmail: string; subjectTemplate: string; bodyTemplate: string }) {
  const user = await currentUser(authHeader)
  assertAdmin(user)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail.trim())) throw new Error('Informe um e-mail de destino válido.')
  assertTemplate(input.subjectTemplate, 'Assunto padrão')
  assertTemplate(input.bodyTemplate, 'Texto padrão')
  const { data, error } = await admin().from('omnia_malote_settings').update({
    recipient_email: input.recipientEmail.trim(),
    default_subject_template: input.subjectTemplate,
    default_body_template: input.bodyTemplate,
    updated_by: user.omniaUserId,
  }).eq('singleton', true).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível salvar a configuração.')
  return data
}

export async function prepareMalote(authHeader: string | null, input: { condominiumId: string; subjectTemplate: string; bodyTemplate: string; files: FileInput[] }) {
  const user = await currentUser(authHeader)
  assertTemplate(input.subjectTemplate, 'Assunto')
  assertTemplate(input.bodyTemplate, 'Mensagem')
  assertFiles(input.files)
  const client = admin()
  const [{ data: settings, error: settingsError }, { data: condominium, error: condominiumError }] = await Promise.all([
    client.from('omnia_malote_settings').select('recipient_email').single(),
    client.from('omnia_condominiums').select('id, name').eq('id', input.condominiumId).single(),
  ])
  if (settingsError || !settings?.recipient_email) throw new Error('Configure o e-mail de destino dos malotes antes de enviar.')
  if (condominiumError || !condominium) throw new Error('Condomínio de destino não encontrado.')
  const { data: batch, error: batchError } = await client.from('omnia_malote_batches').insert({
    condominium_id: condominium.id,
    recipient_email: settings.recipient_email,
    subject_template: input.subjectTemplate,
    body_template: input.bodyTemplate,
    created_by: user.omniaUserId,
  }).select('id').single()
  if (batchError || !batch) throw new Error(batchError?.message ?? 'Não foi possível criar o malote.')

  const items = input.files.map((file) => ({
    batch_id: batch.id,
    file_name: normalizeFileName(file.name),
    file_size_bytes: file.size,
    content_type: resolveMaloteContentType(file.type),
    storage_path: `${user.authUserId}/${batch.id}/${crypto.randomUUID()}${storageSuffix(file.name)}`,
  }))
  const { data: createdItems, error: itemError } = await client.from('omnia_malote_items').insert(items).select('id, storage_path')
  if (itemError || !createdItems) throw new Error(itemError?.message ?? 'Não foi possível preparar os anexos.')
  const signedUploads = await Promise.all(createdItems.map(async (item: any) => {
    const { data, error } = await client.storage.from('malote-attachments').createSignedUploadUrl(item.storage_path)
    if (error || !data) throw new Error(error?.message ?? 'Não foi possível preparar o upload do anexo.')
    return [item.storage_path, { itemId: item.id, path: item.storage_path, token: data.token }] as const
  }))
  const uploadsByPath = new Map(signedUploads)
  const uploads = items.map((item) => uploadsByPath.get(item.storage_path)!)
  return { batchId: batch.id, uploads, condominiumName: condominium.name }
}

export async function confirmMaloteUpload(authHeader: string | null, itemId: string) {
  await currentUser(authHeader)
  const client = admin()
  const { data: item, error } = await client.from('omnia_malote_items').select('id, storage_path, status').eq('id', itemId).single()
  if (error || !item) throw new Error('Anexo de malote não encontrado.')
  if (item.status !== 'pending') throw new Error('Este anexo não está aguardando confirmação de upload.')
  const { data: file, error: fileError } = await client.storage.from('malote-attachments').download(item.storage_path)
  if (fileError || !file || !file.size || file.size > MALOTE_MAX_FILE_SIZE_BYTES) throw new Error('O arquivo enviado não atende ao limite de malote.')
  const { error: updateError } = await client.from('omnia_malote_items').update({ status: 'uploaded' }).eq('id', item.id).eq('status', 'pending')
  if (updateError) throw new Error(updateError.message)
}

export function getMaloteTransportOptions(values: Record<string, string | undefined> = process.env) {
  const host = values.MALOTE_SMTP_HOST ?? 'smtp.gmail.com'
  const configuredPort = values.MALOTE_SMTP_PORT
  const port = configuredPort ? Number(configuredPort) : 465
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MALOTE_SMTP_PORT deve ser uma porta válida.')
  const secure = values.MALOTE_SMTP_SECURE ? values.MALOTE_SMTP_SECURE === 'true' : port === 465
  const user = values.MALOTE_SMTP_USER ?? values.GMAIL_SMTP_USER
  const pass = values.MALOTE_SMTP_PASSWORD ?? values.GMAIL_SMTP_APP_PASSWORD
  const sender = values.MALOTE_SMTP_FROM ?? user ?? 'malotes@localhost'
  if ((user && !pass) || (!user && pass)) throw new Error('Configure usuário e senha SMTP juntos.')
  if (host === 'smtp.gmail.com' && (!user || !pass)) throw new Error('Missing required environment variable: GMAIL_SMTP_USER')
  return user && pass ? { host, port, secure, auth: { user, pass }, sender } : { host, port, secure, sender }
}

function createGmailTransport() {
  const { sender, ...options } = getMaloteTransportOptions()
  return { transport: nodemailer.createTransport(options), sender }
}

/**
 * Emite um evento por anexo enquanto envia, para o cliente acompanhar o progresso
 * sem abrir uma requisição por e-mail (o transporte SMTP é reaproveitado no lote).
 */
export async function* streamMaloteSend(authHeader: string | null, batchId: string, itemIds?: string[]): AsyncGenerator<MaloteSendEvent> {
  const user = await currentUser(authHeader)
  const client = admin()
  const { data: batch, error: batchError } = await client.from('omnia_malote_batches')
    .select('id, recipient_email, subject_template, body_template, condominium:omnia_condominiums(name)')
    .eq('id', batchId).single()
  if (batchError || !batch) throw new Error('Malote não encontrado.')
  let itemsQuery = client.from('omnia_malote_items').select('*').eq('batch_id', batchId).in('status', ['uploaded', 'failed'])
  if (itemIds?.length) itemsQuery = itemsQuery.in('id', itemIds)
  const { data: items, error: itemsError } = await itemsQuery
  if (itemsError || !items?.length) throw new Error('Não há anexos disponíveis para envio.')
  const mailer = createGmailTransport()
  const results: MaloteSendResult[] = []
  yield { type: 'start', total: items.length }
  for (const item of items) {
    const { data: claimedItem, error: claimError } = await client.from('omnia_malote_items')
      .update({ status: 'sending' }).eq('id', item.id).in('status', ['uploaded', 'failed']).select('*').maybeSingle()
    if (claimError || !claimedItem) {
      results.push({ itemId: item.id, status: 'skipped' })
      yield { type: 'item', itemId: item.id, fileName: item.file_name, status: 'skipped' }
      continue
    }
    try {
      const { data: file, error: fileError } = await client.storage.from('malote-attachments').download(claimedItem.storage_path)
      if (fileError || !file) throw new Error(fileError?.message ?? 'Anexo não encontrado no armazenamento.')
      const fileContents = Buffer.from(await file.arrayBuffer())
      if (!fileContents.byteLength || fileContents.byteLength > MALOTE_MAX_FILE_SIZE_BYTES) throw new Error('Anexo armazenado não atende ao limite de malote.')
      const sentAt = new Date()
      const templateContext = { condominium: (batch.condominium as any)?.name ?? 'Condomínio', fileName: claimedItem.file_name, sentAt }
      const renderedSubject = renderMaloteTemplate(batch.subject_template, templateContext)
      const renderedBody = renderMaloteTemplate(batch.body_template, templateContext)
      const { data: attempt, error: startAttemptError } = await client.from('omnia_malote_attempts').insert({ item_id: item.id, attempted_by: user.omniaUserId, recipient_email: batch.recipient_email, rendered_subject: renderedSubject, rendered_body: renderedBody, status: 'sending' }).select('id').single()
      if (startAttemptError || !attempt) throw new Error(startAttemptError?.message ?? 'Não foi possível registrar a tentativa de envio.')
      const sent = await sendMaloteEmail({ transport: mailer.transport, sender: mailer.sender, recipient: batch.recipient_email, subjectTemplate: batch.subject_template, bodyTemplate: batch.body_template, condominiumName: templateContext.condominium, fileName: claimedItem.file_name, fileContents, contentType: claimedItem.content_type, sentAt })
      const { data: sentAttempt, error: sentAttemptError } = await client.from('omnia_malote_attempts').update({ status: 'sent', smtp_message_id: sent.messageId }).eq('id', attempt.id).eq('status', 'sending').select('id').maybeSingle()
      if (sentAttemptError || !sentAttempt) {
        results.push({ itemId: item.id, status: 'delivery_unknown' })
        yield { type: 'item', itemId: item.id, fileName: claimedItem.file_name, status: 'delivery_unknown' }
        continue
      }
      const { data: sentItem, error: sentUpdateError } = await client.from('omnia_malote_items').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', claimedItem.id).eq('status', 'sending').select('id').maybeSingle()
      const settledStatus = sentUpdateError || !sentItem ? 'delivery_recorded' : 'sent'
      results.push({ itemId: item.id, status: settledStatus })
      yield { type: 'item', itemId: item.id, fileName: claimedItem.file_name, status: settledStatus }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida ao enviar e-mail.'
      const { data: sendingAttempt } = await client.from('omnia_malote_attempts').select('id').eq('item_id', item.id).eq('status', 'sending').order('created_at', { ascending: false }).limit(1).maybeSingle()
      const attemptUpdate = sendingAttempt
        ? await client.from('omnia_malote_attempts').update({ status: 'failed', error_message: message }).eq('id', sendingAttempt.id).eq('status', 'sending')
        : { error: null }
      const itemUpdate = await client.from('omnia_malote_items').update({ status: 'failed' }).eq('id', item.id).eq('status', 'sending')
      const failedStatus = attemptUpdate.error || itemUpdate.error ? 'delivery_unknown' : 'failed'
      results.push({ itemId: item.id, status: failedStatus, error: message })
      yield { type: 'item', itemId: item.id, fileName: item.file_name, status: failedStatus, error: message }
    }
  }
  const { count: activeCount, error: activeCountError } = await client.from('omnia_malote_items').select('id', { count: 'exact', head: true }).eq('batch_id', batchId).in('status', ['pending', 'uploaded', 'sending'])
  if (activeCountError) throw new Error(activeCountError.message)
  if (activeCount === 0) await client.from('omnia_malote_batches').update({ completed_at: new Date().toISOString() }).eq('id', batchId)
  yield { type: 'done', batchId, results }
}

export async function resolveMaloteDelivery(authHeader: string | null, itemId: string) {
  const user = await currentUser(authHeader)
  assertAdmin(user)
  const client = admin()
  const { data: item, error: itemError } = await client.from('omnia_malote_items').select('id, batch_id, status').eq('id', itemId).single()
  if (itemError || !item || item.status !== 'sending') throw new Error('Este item não possui uma entrega pendente de resolução.')
  const { data: attempt, error: attemptError } = await client.from('omnia_malote_attempts').select('id, created_at, status').eq('item_id', item.id).order('created_at', { ascending: false }).limit(1).single()
  if (attemptError || !attempt) throw new Error('Tentativa pendente não encontrada.')
  let terminalStatus = attempt.status
  if (attempt.status === 'sending') {
    if (Date.now() - new Date(attempt.created_at).getTime() < DELIVERY_RESOLUTION_DELAY_MS) throw new Error('Aguarde 30 minutos antes de resolver manualmente uma entrega pendente.')
    const { data: failedAttempt, error: attemptUpdateError } = await client.from('omnia_malote_attempts').update({ status: 'failed', error_message: 'Marcado manualmente como falho após conferência do Gmail.' }).eq('id', attempt.id).eq('status', 'sending').select('id').maybeSingle()
    if (attemptUpdateError || !failedAttempt) throw new Error(attemptUpdateError?.message ?? 'A tentativa já foi atualizada por outro processo.')
    terminalStatus = 'failed'
  }
  if (terminalStatus !== 'sent' && terminalStatus !== 'failed') throw new Error('A última tentativa ainda não pode ser reconciliada.')
  const itemUpdate = terminalStatus === 'sent'
    ? await client.from('omnia_malote_items').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', item.id).eq('status', 'sending').select('id').maybeSingle()
    : await client.from('omnia_malote_items').update({ status: 'failed' }).eq('id', item.id).eq('status', 'sending').select('id').maybeSingle()
  if (itemUpdate.error || !itemUpdate.data) throw new Error(itemUpdate.error?.message ?? 'O item já foi atualizado por outro processo.')
  const { count: activeCount, error: activeCountError } = await client.from('omnia_malote_items').select('id', { count: 'exact', head: true }).eq('batch_id', item.batch_id).in('status', ['pending', 'uploaded', 'sending'])
  if (activeCountError) throw new Error(activeCountError.message)
  if (activeCount === 0) {
    const { error: completedError } = await client.from('omnia_malote_batches').update({ completed_at: new Date().toISOString() }).eq('id', item.batch_id)
    if (completedError) throw new Error(completedError.message)
  }
}

/**
 * Um envio interrompido (F5, queda de rede, função encerrada) deixa anexos parados
 * em pending/uploaded sem nenhuma tentativa de e-mail. Depois da janela de abandono
 * eles viram falha, para o lote aparecer no histórico como falho e poder ser excluído.
 * Itens em 'sending' ficam de fora: ali um e-mail pode ter saído, e essa incerteza
 * continua sendo resolvida por resolveMaloteDelivery.
 */
async function failAbandonedItems(client: SupabaseClient) {
  const cutoff = new Date(Date.now() - ABANDONED_UPLOAD_DELAY_MS).toISOString()
  const { data: abandoned, error } = await client.from('omnia_malote_items')
    .update({ status: 'failed' })
    .in('status', ['pending', 'uploaded'])
    .lt('created_at', cutoff)
    .select('batch_id')
  if (error) throw new Error(error.message)
  const batchIds = [...new Set((abandoned ?? []).map((item: { batch_id: string }) => item.batch_id))]
  for (const batchId of batchIds) {
    const { count, error: countError } = await client.from('omnia_malote_items')
      .select('id', { count: 'exact', head: true }).eq('batch_id', batchId).in('status', ['pending', 'uploaded', 'sending'])
    if (countError) throw new Error(countError.message)
    if (count === 0) {
      const { error: completeError } = await client.from('omnia_malote_batches')
        .update({ completed_at: new Date().toISOString() }).eq('id', batchId).is('completed_at', null)
      if (completeError) throw new Error(completeError.message)
    }
  }
}

export async function deleteMalote(authHeader: string | null, batchId: string) {
  const user = await currentUser(authHeader)
  const client = admin()
  const { data: batch, error: batchError } = await client.from('omnia_malote_batches')
    .select('id, created_by').eq('id', batchId).single()
  if (batchError || !batch) throw new Error('Malote não encontrado.')
  if (batch.created_by !== user.omniaUserId && !user.roles.includes('ADMIN')) {
    throw new Error('Somente quem criou o malote ou um administrador pode excluí-lo.')
  }
  const { data: items, error: itemsError } = await client.from('omnia_malote_items')
    .select('storage_path, status').eq('batch_id', batchId)
  if (itemsError) throw new Error(itemsError.message)
  if ((items ?? []).some((item: { status: string }) => item.status === 'sending' || item.status === 'purging')) {
    throw new Error('Este malote ainda tem uma entrega em andamento. Aguarde a conclusão para excluí-lo.')
  }
  const paths = (items ?? []).map((item: { storage_path: string }) => item.storage_path)
  if (paths.length) {
    const { error: removeError } = await client.storage.from('malote-attachments').remove(paths)
    if (removeError) throw new Error(removeError.message)
  }
  // omnia_malote_items e omnia_malote_attempts saem por ON DELETE CASCADE.
  const { error: deleteError } = await client.from('omnia_malote_batches').delete().eq('id', batchId)
  if (deleteError) throw new Error(deleteError.message)
}

export async function listMalotes(authHeader: string | null) {
  await currentUser(authHeader)
  await failAbandonedItems(admin())
  const { data, error } = await admin().from('omnia_malote_batches')
    .select('id, recipient_email, created_at, completed_at, condominium:omnia_condominiums(id, name), creator:omnia_users(name), items:omnia_malote_items(id, file_name, status, sent_at, created_at, attempts:omnia_malote_attempts(status, error_message, smtp_message_id, created_at))')
    .order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function cleanMalotes(authHeader: string | null, input: { before: string; preview?: boolean }) {
  const user = await currentUser(authHeader)
  assertAdmin(user)
  const cutoff = new Date(input.before)
  if (Number.isNaN(cutoff.getTime())) throw new Error('Informe uma data válida para limpeza.')
  const client = admin()
  const { data: items, error } = await client.from('omnia_malote_items').select('id, storage_path, file_size_bytes, status').in('status', ['pending', 'uploaded', 'sent', 'failed']).lt('created_at', cutoff.toISOString())
  if (error) throw new Error(error.message)
  const totalBytes = (items ?? []).reduce((total: number, item: any) => total + Number(item.file_size_bytes), 0)
  if (input.preview) return { count: items?.length ?? 0, totalBytes }
  for (const item of items ?? []) {
    const { data: claimedItem, error: claimError } = await client.from('omnia_malote_items').update({ status: 'purging' }).eq('id', item.id).eq('status', item.status).select('id').maybeSingle()
    if (claimError) throw new Error(claimError.message)
    if (!claimedItem) continue
    const { error: removeError } = await client.storage.from('malote-attachments').remove([item.storage_path])
    if (removeError) {
      await client.from('omnia_malote_items').update({ status: item.status }).eq('id', item.id).eq('status', 'purging')
      throw new Error(removeError.message)
    }
    const { error: purgeError } = await client.from('omnia_malote_items').update({ status: 'purged', purged_at: new Date().toISOString() }).eq('id', item.id).eq('status', 'purging')
    if (purgeError) throw new Error(purgeError.message)
  }
  return { count: items?.length ?? 0, totalBytes }
}
