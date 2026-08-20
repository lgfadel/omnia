import nodemailer from 'nodemailer'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { MALOTE_MAX_FILE_SIZE_BYTES, renderMaloteTemplate, validateMaloteTemplate } from '@/lib/malotes'
import { sendMaloteEmail } from '@/server/maloteEmail'

const MAX_FILES_PER_BATCH = 20
const DELIVERY_RESOLUTION_DELAY_MS = 30 * 60 * 1000

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

function assertFiles(files: FileInput[]) {
  if (files.length === 0) throw new Error('Selecione ao menos um PDF.')
  if (files.length > MAX_FILES_PER_BATCH) throw new Error('Envie no máximo 20 PDFs por malote.')
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
      throw new Error(`O arquivo ${file.name} deve ser um PDF.`)
    }
    if (!file.size || file.size > MALOTE_MAX_FILE_SIZE_BYTES) {
      throw new Error(`O arquivo ${file.name} excede o limite de 18 MB.`)
    }
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
    content_type: 'application/pdf',
    storage_path: `${user.authUserId}/${batch.id}/${crypto.randomUUID()}.pdf`,
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
  if (fileError || !file || file.size > MALOTE_MAX_FILE_SIZE_BYTES) throw new Error('O arquivo enviado não atende ao limite de malote.')
  const header = new TextDecoder().decode((await file.arrayBuffer()).slice(0, 5))
  if (header !== '%PDF-') throw new Error('O arquivo enviado não possui uma assinatura PDF válida.')
  const { error: updateError } = await client.from('omnia_malote_items').update({ status: 'uploaded' }).eq('id', item.id).eq('status', 'pending')
  if (updateError) throw new Error(updateError.message)
}

function createGmailTransport() {
  return nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: env('GMAIL_SMTP_USER'), pass: env('GMAIL_SMTP_APP_PASSWORD') } })
}

export async function sendMalote(authHeader: string | null, batchId: string, itemIds?: string[]) {
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
  const transport = createGmailTransport()
  const results = []
  for (const item of items) {
    const { data: claimedItem, error: claimError } = await client.from('omnia_malote_items')
      .update({ status: 'sending' }).eq('id', item.id).in('status', ['uploaded', 'failed']).select('*').maybeSingle()
    if (claimError || !claimedItem) { results.push({ itemId: item.id, status: 'skipped' }); continue }
    try {
      const { data: file, error: fileError } = await client.storage.from('malote-attachments').download(claimedItem.storage_path)
      if (fileError || !file) throw new Error(fileError?.message ?? 'Anexo não encontrado no armazenamento.')
      const fileContents = Buffer.from(await file.arrayBuffer())
      if (fileContents.byteLength > MALOTE_MAX_FILE_SIZE_BYTES || fileContents.subarray(0, 5).toString() !== '%PDF-') throw new Error('Anexo armazenado não possui um PDF válido.')
      const sentAt = new Date()
      const templateContext = { condominium: (batch.condominium as any)?.name ?? 'Condomínio', fileName: claimedItem.file_name, sentAt }
      const renderedSubject = renderMaloteTemplate(batch.subject_template, templateContext)
      const renderedBody = renderMaloteTemplate(batch.body_template, templateContext)
      const { data: attempt, error: startAttemptError } = await client.from('omnia_malote_attempts').insert({ item_id: item.id, attempted_by: user.omniaUserId, recipient_email: batch.recipient_email, rendered_subject: renderedSubject, rendered_body: renderedBody, status: 'sending' }).select('id').single()
      if (startAttemptError || !attempt) throw new Error(startAttemptError?.message ?? 'Não foi possível registrar a tentativa de envio.')
      const sent = await sendMaloteEmail({ transport, recipient: batch.recipient_email, subjectTemplate: batch.subject_template, bodyTemplate: batch.body_template, condominiumName: templateContext.condominium, fileName: claimedItem.file_name, fileContents, sentAt })
      const { data: sentAttempt, error: sentAttemptError } = await client.from('omnia_malote_attempts').update({ status: 'sent', smtp_message_id: sent.messageId }).eq('id', attempt.id).eq('status', 'sending').select('id').maybeSingle()
      if (sentAttemptError || !sentAttempt) { results.push({ itemId: item.id, status: 'delivery_unknown' }); continue }
      const { data: sentItem, error: sentUpdateError } = await client.from('omnia_malote_items').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', claimedItem.id).eq('status', 'sending').select('id').maybeSingle()
      results.push({ itemId: item.id, status: sentUpdateError || !sentItem ? 'delivery_recorded' : 'sent' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida ao enviar e-mail.'
      const { data: sendingAttempt } = await client.from('omnia_malote_attempts').select('id').eq('item_id', item.id).eq('status', 'sending').order('created_at', { ascending: false }).limit(1).maybeSingle()
      const attemptUpdate = sendingAttempt
        ? await client.from('omnia_malote_attempts').update({ status: 'failed', error_message: message }).eq('id', sendingAttempt.id).eq('status', 'sending')
        : { error: null }
      const itemUpdate = await client.from('omnia_malote_items').update({ status: 'failed' }).eq('id', item.id).eq('status', 'sending')
      results.push({ itemId: item.id, status: attemptUpdate.error || itemUpdate.error ? 'delivery_unknown' : 'failed', error: message })
    }
  }
  const { count: activeCount, error: activeCountError } = await client.from('omnia_malote_items').select('id', { count: 'exact', head: true }).eq('batch_id', batchId).in('status', ['pending', 'uploaded', 'sending'])
  if (activeCountError) throw new Error(activeCountError.message)
  if (activeCount === 0) await client.from('omnia_malote_batches').update({ completed_at: new Date().toISOString() }).eq('id', batchId)
  return { batchId, results }
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

export async function listMalotes(authHeader: string | null) {
  await currentUser(authHeader)
  const { data, error } = await admin().from('omnia_malote_batches')
    .select('id, recipient_email, created_at, completed_at, condominium:omnia_condominiums(name), creator:omnia_users(name), items:omnia_malote_items(id, file_name, status, sent_at, created_at, attempts:omnia_malote_attempts(status, error_message, smtp_message_id, created_at))')
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
