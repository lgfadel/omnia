import { supabase } from '@/integrations/supabase/client'
import { logger } from '@/lib/logging'

export type BalanceteAttachmentOcrStatus =
  | 'matched'
  | 'not_found'
  | 'protocol_not_found'
  | 'multiple_matches'
  | 'already_attached'
  | 'error'
  | 'manual'

export interface BalanceteAttachment {
  id: string
  balanceteId: string
  protocoloId: string | null
  sourcePageNumber: number | null
  detectedProtocolNumber: number | null
  ocrStatus: BalanceteAttachmentOcrStatus
  name: string
  url: string
  sizeKb?: number
  mimeType?: string
  uploadedBy?: string
  createdAt: Date
}

function transformAttachmentFromDB(dbAttachment: any): BalanceteAttachment {
  return {
    id: dbAttachment.id,
    balanceteId: dbAttachment.balancete_id,
    protocoloId: dbAttachment.protocolo_id ?? null,
    sourcePageNumber: dbAttachment.source_page_number ?? null,
    detectedProtocolNumber: dbAttachment.detected_protocol_number ?? null,
    ocrStatus: dbAttachment.ocr_status,
    name: dbAttachment.name,
    url: dbAttachment.url,
    sizeKb: dbAttachment.size_kb || undefined,
    mimeType: dbAttachment.mime_type || undefined,
    uploadedBy: dbAttachment.uploaded_by || undefined,
    createdAt: dbAttachment.created_at ? new Date(dbAttachment.created_at) : new Date(),
  }
}

const balanceteAttachmentsTable = () => supabase.from('omnia_balancete_attachments' as any)

export const balanceteAttachmentsRepoSupabase = {
  async listByBalancete(balanceteId: string): Promise<BalanceteAttachment[]> {
    logger.debug(`Loading balancete attachments for: ${balanceteId}`)

    const { data, error } = await balanceteAttachmentsTable()
      .select('*')
      .eq('balancete_id', balanceteId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Erro ao buscar anexos de balancete:', error)
      throw error
    }

    return (data ?? []).map(transformAttachmentFromDB)
  },

  async listByBalancetes(balanceteIds: string[]): Promise<BalanceteAttachment[]> {
    if (balanceteIds.length === 0) return []

    logger.debug('Loading balancete attachments for ids:', balanceteIds)

    const { data, error } = await balanceteAttachmentsTable()
      .select('*')
      .in('balancete_id', balanceteIds)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Erro ao buscar anexos de balancetes:', error)
      throw error
    }

    return (data ?? []).map(transformAttachmentFromDB)
  },

  async create(attachment: Omit<BalanceteAttachment, 'id' | 'createdAt'>): Promise<BalanceteAttachment> {
    logger.debug(`Creating attachment for balancete: ${attachment.balanceteId}`)

    const { data, error } = await balanceteAttachmentsTable()
      .insert({
        balancete_id: attachment.balanceteId,
        protocolo_id: attachment.protocoloId,
        source_page_number: attachment.sourcePageNumber,
        detected_protocol_number: attachment.detectedProtocolNumber,
        ocr_status: attachment.ocrStatus,
        name: attachment.name,
        url: attachment.url,
        size_kb: attachment.sizeKb || null,
        mime_type: attachment.mimeType || null,
        uploaded_by: attachment.uploadedBy || null,
      })
      .select()
      .single()

    if (error || !data) {
      logger.error('Erro ao criar anexo de balancete:', error)
      throw new Error(`Falha ao criar anexo: ${error?.message || 'Erro desconhecido'}`)
    }

    return transformAttachmentFromDB(data)
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing balancete attachment: ${id}`)

    const { data: attachment } = await balanceteAttachmentsTable()
      .select('url')
      .eq('id', id)
      .single() as { data: { url: string } | null }

    if (attachment?.url) {
      try {
        const url = new URL(attachment.url)
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/balancete-attachments\/(.+)/)
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[1])
          await supabase.storage.from('balancete-attachments').remove([filePath])
        }
      } catch (storageError) {
        logger.warn('Erro ao deletar arquivo do storage:', storageError)
      }
    }

    const { error } = await balanceteAttachmentsTable()
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Erro ao deletar anexo de balancete:', error)
      throw error
    }

    return true
  },

  async uploadFile(balanceteId: string, protocoloId: string | null, file: File): Promise<BalanceteAttachment> {
    logger.debug(`Uploading file for balancete: ${balanceteId}`, { fileName: file.name, fileSize: file.size })

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) {
      logger.error('Erro ao obter usuário autenticado:', authError)
      throw new Error('Usuário não autenticado')
    }

    const authUserId = authData.user?.id
    if (!authUserId) {
      throw new Error('ID do usuário autenticado não encontrado')
    }

    const { data: omniaUser, error: userError } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single()

    if (userError || !omniaUser) {
      logger.error('Erro ao buscar usuário Omnia:', userError)
      throw new Error('Usuário não encontrado na tabela omnia_users')
    }

    const fileName = `${authUserId}/${balanceteId}/${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('balancete-attachments')
      .upload(fileName, file)

    if (uploadError || !uploadData) {
      logger.error('Erro ao fazer upload do arquivo:', uploadError)
      throw new Error(`Falha no upload: ${uploadError?.message || 'Erro desconhecido'}`)
    }

    const { data: publicUrlData } = supabase.storage
      .from('balancete-attachments')
      .getPublicUrl(uploadData.path)

    return this.create({
      balanceteId,
      protocoloId,
      sourcePageNumber: null,
      detectedProtocolNumber: null,
      ocrStatus: 'manual',
      name: file.name,
      url: publicUrlData.publicUrl,
      sizeKb: Math.round(file.size / 1024),
      mimeType: file.type,
      uploadedBy: omniaUser.id,
    })
  },
}
