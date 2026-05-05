import { PDFDocument } from 'pdf-lib'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  parseProtocolImportModelOutput,
  resolveImportedProtocolPage,
  type ImportedProtocolPageResolution,
  type ProtocolImportModelOutput,
} from '@/lib/balanceteProtocolImport'

type AuthenticatedOmniaUser = {
  accessToken: string
  authUserId: string
  omniaUserId: string
}

export type ProtocolImportItemResult = {
  id: string
  pageNumber: number
  status: 'matched' | 'not_found' | 'protocol_not_found' | 'multiple_matches' | 'already_attached' | 'error' | 'resolved'
  detectedProtocolNumber: number | null
  confidence: 'high' | 'medium' | 'low' | null
  protocoloId: string | null
  balanceteId: string | null
  candidateBalanceteIds: string[]
  pageFileUrl: string | null
  errorMessage: string | null
}

export type ProtocolImportBatchResult = {
  batch: {
    id: string
    originalFilename: string
    totalPages: number
    matchedCount: number
    pendingCount: number
    failedCount: number
  }
  items: ProtocolImportItemResult[]
}

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_PROTOCOL_IMPORT_MODEL || 'gpt-5-mini'
const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const OCR_PROMPT = [
  'Analise este PDF de uma pagina.',
  'Encontre o numero do protocolo Omnia visivel no documento.',
  'Responda apenas com JSON valido, sem markdown, usando exatamente estas chaves:',
  '{"found": boolean, "protocol_number": number | null, "confidence": "high" | "medium" | "low"}',
  'Se nao houver certeza do numero, use found=false e protocol_number=null.',
].join(' ')

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function createAdminClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    serviceRoleKey && serviceRoleKey.trim().length > 0
      ? serviceRoleKey
      : getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

function createAnonClient(): SupabaseClient {
  return createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createUserClient(accessToken: string): SupabaseClient {
  return createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

export async function authenticateOmniaUser(authHeader: string | null): Promise<AuthenticatedOmniaUser> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token')
  }

  const token = authHeader.replace('Bearer ', '')
  const anon = createAnonClient()
  const admin = createAdminClient()

  const { data: authData, error: authError } = await anon.auth.getUser(token)
  if (authError || !authData.user) {
    throw new Error('Invalid user token')
  }

  const userClient = createUserClient(token)

  const { data: omniaUser, error: omniaUserError } = await admin
    .from('omnia_users')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  if (omniaUser?.id) {
    return {
      accessToken: token,
      authUserId: authData.user.id,
      omniaUserId: omniaUser.id,
    }
  }

  const fallbackName =
    authData.user.user_metadata?.name ||
    authData.user.user_metadata?.full_name ||
    authData.user.email?.split('@')[0] ||
    'Usuário'

  if (authData.user.email) {
    const { data: existingByEmail, error: existingByEmailError } = await admin
      .from('omnia_users')
      .select('id, auth_user_id')
      .eq('email', authData.user.email)
      .maybeSingle()

    if (!existingByEmailError && existingByEmail?.id) {
      if (existingByEmail.auth_user_id && existingByEmail.auth_user_id !== authData.user.id) {
        throw new Error('Existing Omnia user email is linked to a different auth user')
      }

      const { data: linkedUser, error: linkError } = await admin
        .from('omnia_users')
        .update({
          auth_user_id: authData.user.id,
          name: fallbackName,
        })
        .eq('id', existingByEmail.id)
        .select('id')
        .single()

      if (linkError || !linkedUser?.id) {
        throw new Error(
          `Omnia user found by email but could not be linked: ${linkError?.message ?? 'unknown error'}`
        )
      }

      return {
        accessToken: token,
        authUserId: authData.user.id,
        omniaUserId: linkedUser.id,
      }
    }
  }

  const { data: createdUser, error: createError } = await admin
    .from('omnia_users')
    .insert({
      auth_user_id: authData.user.id,
      name: fallbackName,
      email: authData.user.email ?? '',
      roles: ['USUARIO'],
    })
    .select('id')
    .single()

  if (createError || !createdUser?.id) {
    throw new Error(
      `Omnia user not found and could not be created: ${createError?.message ?? 'unknown error'}`
    )
  }

  return {
    accessToken: token,
    authUserId: authData.user.id,
    omniaUserId: createdUser.id,
  }
}

async function splitPdfIntoPages(pdfBytes: Uint8Array): Promise<Uint8Array[]> {
  const sourcePdf = await PDFDocument.load(pdfBytes)
  const totalPages = sourcePdf.getPageCount()
  const pages: Uint8Array[] = []

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const pagePdf = await PDFDocument.create()
    const [copiedPage] = await pagePdf.copyPages(sourcePdf, [pageIndex])
    pagePdf.addPage(copiedPage)
    pages.push(await pagePdf.save())
  }

  return pages
}

function extractOpenAiOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  const contentTexts: string[] = []
  for (const outputItem of payload?.output ?? []) {
    for (const contentItem of outputItem?.content ?? []) {
      if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
        contentTexts.push(contentItem.text.trim())
      }
    }
  }

  if (contentTexts.length > 0) {
    return contentTexts.join('\n')
  }

  throw new Error('OpenAI response did not include text output')
}

async function detectProtocolNumber(pagePdfBytes: Uint8Array, fileName: string): Promise<ProtocolImportModelOutput> {
  const apiKey = getEnv('OPENAI_API_KEY')
  const base64Pdf = Buffer.from(pagePdfBytes).toString('base64')

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: OCR_PROMPT,
            },
            {
              type: 'input_file',
              filename: fileName,
              file_data: `data:application/pdf;base64,${base64Pdf}`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI OCR request failed: ${response.status} ${body}`)
  }

  const payload = await response.json()
  return parseProtocolImportModelOutput(extractOpenAiOutputText(payload))
}

async function uploadPdfToBucket(params: {
  supabaseAdmin: SupabaseClient
  bucket: string
  path: string
  content: Uint8Array
}): Promise<{ path: string; url: string }> {
  const { bucket, content, path, supabaseAdmin } = params

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, content, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

async function createBalanceteAttachment(params: {
  supabaseAdmin: SupabaseClient
  balanceteId: string
  protocoloId: string | null
  sourcePageNumber: number
  detectedProtocolNumber: number | null
  ocrStatus: string
  fileName: string
  fileUrl: string
  fileSizeBytes: number
  uploadedBy: string
}) {
  const { error } = await params.supabaseAdmin
    .from('omnia_balancete_attachments')
    .insert({
      balancete_id: params.balanceteId,
      protocolo_id: params.protocoloId,
      source_page_number: params.sourcePageNumber,
      detected_protocol_number: params.detectedProtocolNumber,
      ocr_status: params.ocrStatus,
      name: params.fileName,
      url: params.fileUrl,
      size_kb: Math.max(1, Math.round(params.fileSizeBytes / 1024)),
      mime_type: 'application/pdf',
      uploaded_by: params.uploadedBy,
    })

  if (error) {
    throw new Error(`Failed to create balancete attachment: ${error.message}`)
  }
}

async function insertImportItem(params: {
  supabaseAdmin: SupabaseClient
  batchId: string
  pageNumber: number
  detectedProtocolNumber: number | null
  confidence: 'high' | 'medium' | 'low' | null
  status: ProtocolImportItemResult['status']
  protocoloId: string | null
  balanceteId: string | null
  candidateBalanceteIds: string[]
  pageFileName: string
  pageFilePath: string
  pageFileUrl: string
  errorMessage: string | null
}) {
  const { data, error } = await params.supabaseAdmin
    .from('omnia_balancete_protocol_import_items')
    .insert({
      batch_id: params.batchId,
      page_number: params.pageNumber,
      detected_protocol_number: params.detectedProtocolNumber,
      confidence: params.confidence,
      status: params.status,
      protocolo_id: params.protocoloId,
      balancete_id: params.balanceteId,
      candidate_balancete_ids: params.candidateBalanceteIds,
      page_file_name: params.pageFileName,
      page_file_path: params.pageFilePath,
      page_file_url: params.pageFileUrl,
      error_message: params.errorMessage,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Failed to create import item: ${error?.message ?? 'unknown error'}`)
  }

  return data.id as string
}

function mapResolutionToPendingStatus(
  resolution: ImportedProtocolPageResolution
): Extract<ProtocolImportItemResult['status'], 'not_found' | 'protocol_not_found' | 'multiple_matches' | 'already_attached'> {
  switch (resolution.status) {
    case 'not_found':
    case 'protocol_not_found':
    case 'multiple_matches':
    case 'already_attached':
      return resolution.status
    default:
      throw new Error(`Invalid pending status: ${resolution.status}`)
  }
}

function buildImportItemResult(params: Omit<ProtocolImportItemResult, 'id'> & { id: string }): ProtocolImportItemResult {
  return params
}

export async function importProtocolPdfBatch(params: {
  file: File
  authHeader: string | null
}): Promise<ProtocolImportBatchResult> {
  const { authHeader, file } = params

  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are supported')
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error('PDF exceeds the 10MB limit')
  }

  const authenticatedUser = await authenticateOmniaUser(authHeader)
  const supabaseAdmin = createUserClient(authenticatedUser.accessToken)
  const fileBytes = new Uint8Array(await file.arrayBuffer())
  const pages = await splitPdfIntoPages(fileBytes)

  const { data: batchRow, error: batchInsertError } = await supabaseAdmin
    .from('omnia_balancete_protocol_import_batches')
    .insert({
      original_filename: file.name,
      total_pages: pages.length,
      created_by: authenticatedUser.omniaUserId,
    })
    .select('id, original_filename, total_pages')
    .single()

  if (batchInsertError || !batchRow?.id) {
    throw new Error(`Failed to create import batch: ${batchInsertError?.message ?? 'unknown error'}`)
  }

  const detections = await Promise.all(
    pages.map(async (pageBytes, index) => {
      const pageNumber = index + 1
      try {
        const detection = await detectProtocolNumber(pageBytes, `page-${pageNumber}.pdf`)
        return { pageNumber, pageBytes, detection, errorMessage: null as string | null }
      } catch (error) {
        return {
          pageNumber,
          pageBytes,
          detection: {
            found: false,
            confidence: 'low' as const,
            protocolNumber: null,
          },
          errorMessage: error instanceof Error ? error.message : 'Unexpected OCR error',
        }
      }
    })
  )

  const uniqueProtocolNumbers = Array.from(
    new Set(
      detections
        .map((item) => item.detection.protocolNumber)
        .filter((value): value is number => typeof value === 'number')
    )
  )

  const protocolosByNumber = new Map<number, { id: string; numero: number }>()
  if (uniqueProtocolNumbers.length > 0) {
    const { data: protocolos, error } = await supabaseAdmin
      .from('omnia_protocolos')
      .select('id, numero')
      .in('numero', uniqueProtocolNumbers)

    if (error) {
      throw new Error(`Failed to load protocolos: ${error.message}`)
    }

    for (const protocolo of protocolos ?? []) {
      protocolosByNumber.set(protocolo.numero, { id: protocolo.id, numero: protocolo.numero })
    }
  }

  const protocoloIds = Array.from(protocolosByNumber.values()).map((protocolo) => protocolo.id)
  const balancetesByProtocoloId = new Map<string, Array<{ id: string; protocolo_id?: string | null }>>()
  const attachedBalanceteIds = new Set<string>()

  if (protocoloIds.length > 0) {
    const { data: balancetes, error: balancetesError } = await supabaseAdmin
      .from('omnia_balancetes')
      .select('id, protocolo_id')
      .in('protocolo_id', protocoloIds)

    if (balancetesError) {
      throw new Error(`Failed to load balancetes: ${balancetesError.message}`)
    }

    for (const balancete of balancetes ?? []) {
      const protocoloId = balancete.protocolo_id
      if (!protocoloId) continue
      const current = balancetesByProtocoloId.get(protocoloId) ?? []
      current.push({ id: balancete.id, protocolo_id: protocoloId })
      balancetesByProtocoloId.set(protocoloId, current)
    }

    const balanceteIds = (balancetes ?? []).map((balancete) => balancete.id)
    if (balanceteIds.length > 0) {
      const { data: attachments, error: attachmentsError } = await supabaseAdmin
        .from('omnia_balancete_attachments')
        .select('balancete_id')
        .in('balancete_id', balanceteIds)

      if (attachmentsError) {
        throw new Error(`Failed to load existing balancete attachments: ${attachmentsError.message}`)
      }

      for (const attachment of attachments ?? []) {
        if (attachment.balancete_id) {
          attachedBalanceteIds.add(attachment.balancete_id)
        }
      }
    }
  }

  const results: ProtocolImportItemResult[] = []
  let matchedCount = 0
  let pendingCount = 0
  let failedCount = 0

  for (const item of detections) {
    const resolution = resolveImportedProtocolPage({
      pageNumber: item.pageNumber,
      detection: item.detection,
      protocolosByNumber,
      balancetesByProtocoloId,
      attachedBalanceteIds,
    })

    const pageFileName = `page-${String(item.pageNumber).padStart(3, '0')}.pdf`

    if (item.errorMessage) {
      const importPath = `${authenticatedUser.authUserId}/${batchRow.id}/${pageFileName}`
      const uploaded = await uploadPdfToBucket({
        supabaseAdmin,
        bucket: 'balancete-import-pages',
        path: importPath,
        content: item.pageBytes,
      })

      const importItemId = await insertImportItem({
        supabaseAdmin,
        batchId: batchRow.id,
        pageNumber: item.pageNumber,
        detectedProtocolNumber: null,
        confidence: 'low',
        status: 'error',
        protocoloId: null,
        balanceteId: null,
        candidateBalanceteIds: [],
        pageFileName,
        pageFilePath: uploaded.path,
        pageFileUrl: uploaded.url,
        errorMessage: item.errorMessage,
      })

      results.push(
        buildImportItemResult({
          id: importItemId,
          pageNumber: item.pageNumber,
          status: 'error',
          detectedProtocolNumber: null,
          confidence: 'low',
          protocoloId: null,
          balanceteId: null,
          candidateBalanceteIds: [],
          pageFileUrl: uploaded.url,
          errorMessage: item.errorMessage,
        })
      )

      failedCount += 1
      continue
    }

    if (resolution.status === 'matched') {
      const attachmentPath = `${authenticatedUser.authUserId}/${resolution.balanceteId}/${Date.now()}-${pageFileName}`
      const uploaded = await uploadPdfToBucket({
        supabaseAdmin,
        bucket: 'balancete-attachments',
        path: attachmentPath,
        content: item.pageBytes,
      })

      await createBalanceteAttachment({
        supabaseAdmin,
        balanceteId: resolution.balanceteId,
        protocoloId: resolution.protocoloId,
        sourcePageNumber: resolution.pageNumber,
        detectedProtocolNumber: resolution.protocolNumber,
        ocrStatus: 'matched',
        fileName: pageFileName,
        fileUrl: uploaded.url,
        fileSizeBytes: item.pageBytes.byteLength,
        uploadedBy: authenticatedUser.omniaUserId,
      })

      attachedBalanceteIds.add(resolution.balanceteId)

      const importItemId = await insertImportItem({
        supabaseAdmin,
        batchId: batchRow.id,
        pageNumber: resolution.pageNumber,
        detectedProtocolNumber: resolution.protocolNumber,
        confidence: resolution.confidence,
        status: 'matched',
        protocoloId: resolution.protocoloId,
        balanceteId: resolution.balanceteId,
        candidateBalanceteIds: [resolution.balanceteId],
        pageFileName,
        pageFilePath: attachmentPath,
        pageFileUrl: uploaded.url,
        errorMessage: null,
      })

      results.push(
        buildImportItemResult({
          id: importItemId,
          pageNumber: resolution.pageNumber,
          status: 'matched',
          detectedProtocolNumber: resolution.protocolNumber,
          confidence: resolution.confidence,
          protocoloId: resolution.protocoloId,
          balanceteId: resolution.balanceteId,
          candidateBalanceteIds: [resolution.balanceteId],
          pageFileUrl: uploaded.url,
          errorMessage: null,
        })
      )

      matchedCount += 1
      continue
    }

    const importPath = `${authenticatedUser.authUserId}/${batchRow.id}/${pageFileName}`
    const uploaded = await uploadPdfToBucket({
      supabaseAdmin,
      bucket: 'balancete-import-pages',
      path: importPath,
      content: item.pageBytes,
    })

    const importItemId = await insertImportItem({
      supabaseAdmin,
      batchId: batchRow.id,
      pageNumber: resolution.pageNumber,
      detectedProtocolNumber: 'protocolNumber' in resolution ? resolution.protocolNumber : null,
      confidence: resolution.confidence,
      status: mapResolutionToPendingStatus(resolution),
      protocoloId: 'protocoloId' in resolution ? resolution.protocoloId : null,
      balanceteId: 'balanceteId' in resolution ? resolution.balanceteId : null,
      candidateBalanceteIds: 'candidateBalanceteIds' in resolution ? resolution.candidateBalanceteIds : [],
      pageFileName,
      pageFilePath: uploaded.path,
      pageFileUrl: uploaded.url,
      errorMessage: null,
    })

    results.push(
      buildImportItemResult({
        id: importItemId,
        pageNumber: resolution.pageNumber,
        status: mapResolutionToPendingStatus(resolution),
        detectedProtocolNumber: 'protocolNumber' in resolution ? resolution.protocolNumber : null,
        confidence: resolution.confidence,
        protocoloId: 'protocoloId' in resolution ? resolution.protocoloId : null,
        balanceteId: 'balanceteId' in resolution ? resolution.balanceteId : null,
        candidateBalanceteIds: 'candidateBalanceteIds' in resolution ? resolution.candidateBalanceteIds : [],
        pageFileUrl: uploaded.url,
        errorMessage: null,
      })
    )

    pendingCount += 1
  }

  const { error: batchUpdateError } = await supabaseAdmin
    .from('omnia_balancete_protocol_import_batches')
    .update({
      matched_count: matchedCount,
      pending_count: pendingCount,
      failed_count: failedCount,
    })
    .eq('id', batchRow.id)

  if (batchUpdateError) {
    throw new Error(`Failed to update import batch counters: ${batchUpdateError.message}`)
  }

  return {
    batch: {
      id: batchRow.id,
      originalFilename: batchRow.original_filename,
      totalPages: batchRow.total_pages,
      matchedCount,
      pendingCount,
      failedCount,
    },
    items: results,
  }
}

export async function resolveProtocolImportItem(params: {
  batchId: string
  itemId: string
  balanceteId: string
  authHeader: string | null
}): Promise<ProtocolImportItemResult> {
  const { authHeader, balanceteId, batchId, itemId } = params
  const authenticatedUser = await authenticateOmniaUser(authHeader)
  const supabaseAdmin = createUserClient(authenticatedUser.accessToken)

  const { data: item, error: itemError } = await supabaseAdmin
    .from('omnia_balancete_protocol_import_items')
    .select('*')
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .single()

  if (itemError || !item) {
    throw new Error('Import item not found')
  }

  const { data: balancete, error: balanceteError } = await supabaseAdmin
    .from('omnia_balancetes')
    .select('id, protocolo_id')
    .eq('id', balanceteId)
    .single()

  if (balanceteError || !balancete) {
    throw new Error('Balancete not found')
  }

  const { data: existingAttachment } = await supabaseAdmin
    .from('omnia_balancete_attachments')
    .select('id')
    .eq('balancete_id', balanceteId)
    .maybeSingle()

  if (existingAttachment?.id) {
    throw new Error('Balancete already has an individual attachment')
  }

  const { data: downloadedPage, error: downloadError } = await supabaseAdmin.storage
    .from('balancete-import-pages')
    .download(item.page_file_path)

  if (downloadError || !downloadedPage) {
    throw new Error(`Failed to load imported page: ${downloadError?.message ?? 'unknown error'}`)
  }

  const pageBytes = new Uint8Array(await downloadedPage.arrayBuffer())
  const attachmentPath = `${authenticatedUser.authUserId}/${balanceteId}/${Date.now()}-${item.page_file_name}`
  const uploaded = await uploadPdfToBucket({
    supabaseAdmin,
    bucket: 'balancete-attachments',
    path: attachmentPath,
    content: pageBytes,
  })

  await createBalanceteAttachment({
    supabaseAdmin,
    balanceteId,
    protocoloId: balancete.protocolo_id,
    sourcePageNumber: item.page_number,
    detectedProtocolNumber: item.detected_protocol_number,
    ocrStatus: 'manual',
    fileName: item.page_file_name,
    fileUrl: uploaded.url,
    fileSizeBytes: pageBytes.byteLength,
    uploadedBy: authenticatedUser.omniaUserId,
  })

  await supabaseAdmin.storage.from('balancete-import-pages').remove([item.page_file_path])

  const { error: updateError } = await supabaseAdmin
    .from('omnia_balancete_protocol_import_items')
    .update({
      status: 'resolved',
      balancete_id: balanceteId,
      protocolo_id: balancete.protocolo_id,
      candidate_balancete_ids: [balanceteId],
      page_file_path: attachmentPath,
      page_file_url: uploaded.url,
      resolved_by: authenticatedUser.omniaUserId,
      resolved_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', itemId)

  if (updateError) {
    throw new Error(`Failed to update import item: ${updateError.message}`)
  }

  const { data: refreshedBatch } = await supabaseAdmin
    .from('omnia_balancete_protocol_import_items')
    .select('status')
    .eq('batch_id', batchId)

  if (refreshedBatch) {
    const matchedCount = refreshedBatch.filter((batchItem) => batchItem.status === 'matched' || batchItem.status === 'resolved').length
    const pendingCount = refreshedBatch.filter((batchItem) =>
      ['not_found', 'protocol_not_found', 'multiple_matches', 'already_attached'].includes(batchItem.status)
    ).length
    const failedCount = refreshedBatch.filter((batchItem) => batchItem.status === 'error').length

    await supabaseAdmin
      .from('omnia_balancete_protocol_import_batches')
      .update({
        matched_count: matchedCount,
        pending_count: pendingCount,
        failed_count: failedCount,
      })
      .eq('id', batchId)
  }

  return {
    id: itemId,
    pageNumber: item.page_number,
    status: 'resolved',
    detectedProtocolNumber: item.detected_protocol_number,
    confidence: item.confidence,
    protocoloId: balancete.protocolo_id,
    balanceteId,
    candidateBalanceteIds: [balanceteId],
    pageFileUrl: uploaded.url,
    errorMessage: null,
  }
}
