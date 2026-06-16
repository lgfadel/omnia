import { supabase } from '@/integrations/supabase/client'
import type { ProtocolImportBatchResult, ProtocolImportItemResult } from '@/server/balanceteProtocolImportService'

const IMPORT_BUCKET = 'balancete-import-pages'

async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Sessão autenticada não encontrada')
  return data.session
}

async function callImportApi(body: object, authHeader: string): Promise<ProtocolImportBatchResult> {
  const response = await fetch('/api/balancetes/protocol-imports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorMessage = 'Falha ao importar lote de protocolos'
    try {
      const payload = await response.json()
      errorMessage = payload?.error || errorMessage
    } catch {
      // non-JSON error response
    }
    throw new Error(errorMessage)
  }

  return response.json() as Promise<ProtocolImportBatchResult>
}

export const balanceteProtocolImportsRepo = {
  async importBatch(file: File): Promise<ProtocolImportBatchResult> {
    const session = await getSession()
    const authHeader = `Bearer ${session.access_token}`
    const uploadPath = `${session.user.id}/raw/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from(IMPORT_BUCKET)
      .upload(uploadPath, file, { contentType: 'application/pdf', upsert: false })

    if (uploadError) throw new Error(`Falha ao enviar arquivo: ${uploadError.message}`)

    try {
      return await callImportApi({ uploadPath, fileName: file.name }, authHeader)
    } catch (error) {
      await supabase.storage.from(IMPORT_BUCKET).remove([uploadPath])
      throw error
    }
  },

  async resolveItem(batchId: string, itemId: string, balanceteId: string): Promise<ProtocolImportItemResult> {
    const session = await getSession()
    const authHeader = `Bearer ${session.access_token}`
    const response = await fetch(`/api/balancetes/protocol-imports/${batchId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ itemId, balanceteId }),
    })

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || 'Falha ao resolver página importada')
    }

    return payload as ProtocolImportItemResult
  },
}
