import { supabase } from '@/integrations/supabase/client'
import type {
  AtaMinuta,
  AtaMinutaDocument,
  AtaMinutaDocumentKind,
  AtaMinutaMessage,
  AtaMinutaStatus,
  AtaMinutaVersion,
  AtaMinutaVersionOrigin,
} from '@/data/types'
import type { AtaMinutaStreamEvent } from '@/lib/ataMinuta'

// A tabela ainda não entrou no gerador de tipos do Supabase — mesma situação da
// transcrição, resolvida do mesmo jeito em ataTranscriptionsRepo.supabase.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedSupabase = supabase as any

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return `Bearer ${data.session?.access_token ?? ''}`
}

async function describeResponseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({})) as { error?: string }
  return new Error(body.error ?? fallback)
}

type DbMinuta = {
  id: string
  ata_id: string
  transcription_id: string | null
  content: string
  status: AtaMinutaStatus
  error_message: string | null
  model: string | null
  created_at: string
  updated_at: string
}

type DbVersion = {
  id: string
  minuta_id: string
  sequence: number
  content: string
  origin: AtaMinutaVersionOrigin
  created_at: string
}

type DbMessage = {
  id: string
  minuta_id: string
  sequence: number
  role: 'user' | 'assistant'
  content: string
  version_id: string | null
  created_at: string
}

type DbDocument = {
  id: string
  ata_id: string
  kind: AtaMinutaDocumentKind
  original_filename: string
  size_bytes: number
  created_at: string
}

function mapMinuta(row: DbMinuta): AtaMinuta {
  return {
    id: row.id,
    ataId: row.ata_id,
    transcriptionId: row.transcription_id ?? undefined,
    content: row.content,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    model: row.model ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapVersion(row: DbVersion): AtaMinutaVersion {
  return { id: row.id, minutaId: row.minuta_id, sequence: row.sequence, content: row.content, origin: row.origin, createdAt: row.created_at }
}

function mapMessage(row: DbMessage): AtaMinutaMessage {
  return {
    id: row.id,
    minutaId: row.minuta_id,
    sequence: row.sequence,
    role: row.role,
    content: row.content,
    versionId: row.version_id ?? undefined,
    createdAt: row.created_at,
  }
}

function mapDocument(row: DbDocument): AtaMinutaDocument {
  return { id: row.id, ataId: row.ata_id, kind: row.kind, originalFilename: row.original_filename, sizeBytes: row.size_bytes, createdAt: row.created_at }
}

export const ataMinutasRepoSupabase = {
  async load(ataId: string): Promise<{
    minuta: AtaMinuta | null
    versions: AtaMinutaVersion[]
    messages: AtaMinutaMessage[]
    documents: AtaMinutaDocument[]
  }> {
    const { data: minuta, error: minutaError } = await untypedSupabase
      .from('omnia_ata_minutas')
      .select('*')
      .eq('ata_id', ataId)
      .eq('is_current', true)
      .maybeSingle()
    if (minutaError) throw minutaError

    const [{ data: versions, error: versionsError }, { data: messages, error: messagesError }, { data: documents, error: documentsError }] = await Promise.all([
      minuta
        ? untypedSupabase.from('omnia_ata_minuta_versions').select('*').eq('minuta_id', minuta.id).order('sequence', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      minuta
        ? untypedSupabase.from('omnia_ata_minuta_messages').select('*').eq('minuta_id', minuta.id).order('sequence', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      untypedSupabase.from('omnia_ata_minuta_documents').select('id, ata_id, kind, original_filename, size_bytes, created_at').eq('ata_id', ataId).order('created_at', { ascending: false }),
    ])
    if (versionsError) throw versionsError
    if (messagesError) throw messagesError
    if (documentsError) throw documentsError

    return {
      minuta: minuta ? mapMinuta(minuta as DbMinuta) : null,
      versions: ((versions ?? []) as DbVersion[]).map(mapVersion),
      messages: ((messages ?? []) as DbMessage[]).map(mapMessage),
      documents: ((documents ?? []) as DbDocument[]).map(mapDocument),
    }
  },

  // Gera (sem instrução) ou refina (com instrução) a minuta, repassando cada trecho de
  // texto conforme o servidor escreve. onEvent recebe os deltas e o evento final.
  async streamTurn(ataId: string, instruction: string | undefined, onEvent: (event: AtaMinutaStreamEvent) => void): Promise<void> {
    const response = await fetch(`/api/atas/${ataId}/minuta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
      body: JSON.stringify({ instruction }),
    })
    if (!response.ok || !response.body) throw await describeResponseError(response, 'Não foi possível gerar a minuta.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const handle = (line: string) => {
      if (!line.trim()) return
      const event = JSON.parse(line) as AtaMinutaStreamEvent
      onEvent(event)
      if (event.type === 'error') throw new Error(event.message)
    }
    let buffer = ''
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) handle(line)
      }
      handle(buffer)
    } finally {
      reader.releaseLock()
    }
  },

  async saveManualEdit(ataId: string, content: string): Promise<void> {
    const response = await fetch(`/api/atas/${ataId}/minuta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
      body: JSON.stringify({ content }),
    })
    if (!response.ok) throw await describeResponseError(response, 'Não foi possível salvar a minuta.')
  },

  async uploadDocument(ataId: string, file: File, kind: AtaMinutaDocumentKind): Promise<AtaMinutaDocument> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', kind)
    const response = await fetch(`/api/atas/${ataId}/minuta/documents`, {
      method: 'POST',
      headers: { Authorization: await authHeader() },
      body: formData,
    })
    if (!response.ok) throw await describeResponseError(response, 'Não foi possível enviar o documento.')
    return mapDocument(await response.json())
  },

  async deleteDocument(ataId: string, documentId: string): Promise<void> {
    const response = await fetch(`/api/atas/${ataId}/minuta/documents?documentId=${documentId}`, {
      method: 'DELETE',
      headers: { Authorization: await authHeader() },
    })
    if (!response.ok) throw await describeResponseError(response, 'Não foi possível remover o documento.')
  },
}
