import { supabase } from '@/integrations/supabase/client'
import type { ProtocolImportBatchResult, ProtocolImportItemResult } from '@/server/balanceteProtocolImportService'

async function getAuthorizationHeader(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new Error('Sessão autenticada não encontrada')
  }

  return `Bearer ${data.session.access_token}`
}

export const balanceteProtocolImportsRepo = {
  async importBatch(file: File): Promise<ProtocolImportBatchResult> {
    const authHeader = await getAuthorizationHeader()
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/balancetes/protocol-imports', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    })

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || 'Falha ao importar lote de protocolos')
    }

    return payload as ProtocolImportBatchResult
  },

  async resolveItem(batchId: string, itemId: string, balanceteId: string): Promise<ProtocolImportItemResult> {
    const authHeader = await getAuthorizationHeader()
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
