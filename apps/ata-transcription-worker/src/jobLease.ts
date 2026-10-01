import type { SupabaseClient } from '@supabase/supabase-js'

// Um job em processamento publica sinal de vida a cada HEARTBEAT_SECONDS. Sem
// sinal por STALE_LEASE_MINUTES, o worker que o assumiu morreu — o Railway
// encerra o container sem aviso — e o job pode ser retomado.
export const HEARTBEAT_SECONDS = 60
export const STALE_LEASE_MINUTES = 5

// Tentativas totais, contando as que o usuário pede na tela. Um job que
// derruba o worker toda vez voltaria para a fila para sempre, e cada volta
// derrubaria junto os jobs que vêm depois dele.
export const MAX_JOB_ATTEMPTS = 3

export function reclaimDecision(attemptCount: number): 'requeue' | 'fail' {
  return attemptCount + 1 >= MAX_JOB_ATTEMPTS ? 'fail' : 'requeue'
}

export type TranscriptionWorkerClient = SupabaseClient<any, 'public', any, any, any>

// Ao reenviar uma gravação, o job anterior pode continuar na fila; só a
// versão atual deve ser assumida para não gastar créditos com áudio substituído.
export async function claimCurrentQueuedJob<T extends { id: string }>(
  supabase: TranscriptionWorkerClient,
  now = new Date().toISOString(),
): Promise<T | null> {
  const { data: candidate, error: candidateError } = await supabase
    .from('omnia_ata_transcription_jobs')
    .select('id')
    .eq('status', 'queued')
    .eq('is_current', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (candidateError) throw candidateError
  if (!candidate) return null

  const { data: claimed, error: claimError } = await supabase
    .from('omnia_ata_transcription_jobs')
    .update({ status: 'processing', started_at: now, heartbeat_at: now })
    .eq('id', candidate.id)
    .eq('status', 'queued')
    .eq('is_current', true)
    .select('id, ata_id, storage_path, storage_provider, size_bytes, mime_type, status, attempt_count, context_text')
    .maybeSingle()
  if (claimError) throw claimError
  return claimed as T | null
}

export async function isCurrentProcessingJob(supabase: TranscriptionWorkerClient, jobId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('omnia_ata_transcription_jobs')
    .select('id')
    .eq('id', jobId)
    .eq('status', 'processing')
    .eq('is_current', true)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}
