import { supabase } from '@/integrations/supabase/client'
import type {
  AtaTranscription,
  AtaTranscriptionStage,
  AtaTranscriptionJob,
  AtaTranscriptionSegment,
  AtaTranscriptionStatus,
} from '@/data/types'

const AUDIO_BUCKET = 'ata-transcription-audio'

// supabase.functions.invoke devolve um FunctionsHttpError cuja mensagem é sempre
// "Edge Function returned a non-2xx status code". A razão real está no corpo da
// resposta, mas a chave varia: o nosso código usa "error", enquanto o gateway do
// Supabase responde com "message"/"msg". Sem cobrir os dois, uma falha de
// plataforma vira uma mensagem sem sentido para quem está enviando o áudio.
async function describeFunctionError(error: unknown, fallback: string): Promise<Error> {
  const response = (error as { context?: unknown })?.context
  if (!(response instanceof Response)) {
    return new Error(error instanceof Error && error.message ? error.message : fallback)
  }

  const status = response.status
  let detail = ''
  try {
    const raw = await response.clone().text()
    if (raw) {
      try {
        const body = JSON.parse(raw) as Record<string, unknown>
        const key = ['error', 'message', 'msg', 'error_description'].find(
          (candidate) => typeof body[candidate] === 'string' && body[candidate],
        )
        detail = key ? String(body[key]) : raw
      } catch {
        detail = raw
      }
    }
  } catch {
    detail = ''
  }

  return new Error(detail ? `${detail} (HTTP ${status})` : `${fallback} (HTTP ${status})`)
}

type DbJob = {
  id: string
  ata_id: string
  status: AtaTranscriptionStatus
  original_filename: string
  error_message: string | null
  attempt_count: number
  created_at: string
  total_chunks: number | null
  processed_chunks: number | null
  stage: AtaTranscriptionStage | null
}

type DbSegment = {
  id: string
  sequence: number
  start_ms: number
  end_ms: number
  speaker_label: string | null
  speaker_name: string | null
  text: string
}

type DbTranscription = {
  id: string
  job_id: string
  raw_text: string
  revised_text: string | null
  language: string
  is_reviewed: boolean
  omnia_ata_transcription_segments: DbSegment[] | null
}

type StartUploadResponse = { jobId: string; path: string; token: string }

// The generated database type is refreshed after this migration is applied. Until then,
// this scoped client preserves the existing repository pattern for newly introduced tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedSupabase = supabase as any

// O PostgREST deste projeto está limitado a 1000 linhas por resposta e ignora
// tanto `limit` quanto o cabeçalho Range acima disso. Uma assembleia de uma hora
// gera ~2000 segmentos, então o embed simples devolvia menos da metade da ata sem
// qualquer aviso — a transcrição simplesmente parecia terminar no meio.
const SEGMENT_PAGE_SIZE = 1000

async function loadAllSegments(transcriptionId: string): Promise<DbSegment[]> {
  const segments: DbSegment[] = []
  for (let from = 0; ; from += SEGMENT_PAGE_SIZE) {
    const { data, error } = await untypedSupabase
      .from('omnia_ata_transcription_segments')
      .select('*')
      .eq('transcription_id', transcriptionId)
      .order('sequence', { ascending: true })
      .range(from, from + SEGMENT_PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as DbSegment[]
    segments.push(...page)
    if (page.length < SEGMENT_PAGE_SIZE) return segments
  }
}

function mapJob(job: DbJob): AtaTranscriptionJob {
  return {
    id: job.id,
    ataId: job.ata_id,
    status: job.status,
    originalFilename: job.original_filename,
    errorMessage: job.error_message ?? undefined,
    attemptCount: job.attempt_count,
    createdAt: job.created_at,
    totalChunks: job.total_chunks ?? undefined,
    processedChunks: job.processed_chunks ?? 0,
    stage: job.stage ?? undefined,
  }
}

function mapSegment(segment: DbSegment): AtaTranscriptionSegment {
  return {
    id: segment.id,
    sequence: segment.sequence,
    startMs: segment.start_ms,
    endMs: segment.end_ms,
    speakerLabel: segment.speaker_label ?? undefined,
    speakerName: segment.speaker_name ?? undefined,
    text: segment.text,
  }
}

function mapTranscription(transcription: DbTranscription): AtaTranscription {
  return {
    id: transcription.id,
    jobId: transcription.job_id,
    rawText: transcription.raw_text,
    revisedText: transcription.revised_text ?? undefined,
    language: transcription.language,
    isReviewed: transcription.is_reviewed,
    segments: (transcription.omnia_ata_transcription_segments ?? [])
      .map(mapSegment)
      .sort((a, b) => a.sequence - b.sequence),
  }
}

export const ataTranscriptionsRepoSupabase = {
  async load(ataId: string): Promise<{ job: AtaTranscriptionJob | null; transcription: AtaTranscription | null }> {
    const { data: job, error: jobError } = await untypedSupabase
      .from('omnia_ata_transcription_jobs')
      .select('id, ata_id, status, original_filename, error_message, attempt_count, created_at, total_chunks, processed_chunks, stage')
      .eq('ata_id', ataId)
      .eq('is_current', true)
      .maybeSingle()

    if (jobError) throw jobError

    const { data: transcription, error: transcriptionError } = job
      ? await untypedSupabase
        .from('omnia_ata_transcriptions')
        .select('*')
        .eq('job_id', job.id)
        .maybeSingle()
      : { data: null, error: null }

    if (transcriptionError) throw transcriptionError
    if (!transcription) {
      return { job: job ? mapJob(job as DbJob) : null, transcription: null }
    }

    const segments = await loadAllSegments((transcription as { id: string }).id)
    return {
      job: job ? mapJob(job as DbJob) : null,
      transcription: mapTranscription({
        ...(transcription as DbTranscription),
        omnia_ata_transcription_segments: segments,
      }),
    }
  },

  async upload(ataId: string, file: File, durationSeconds: number): Promise<void> {
    const { data, error } = await supabase.functions.invoke<StartUploadResponse>('ata-transcriptions', {
      body: {
        action: 'create',
        ataId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        durationSeconds,
      },
    })
    if (error || !data) throw await describeFunctionError(error, 'Não foi possível iniciar o envio do áudio.')

    try {
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .uploadToSignedUrl(data.path, data.token, file)
      if (uploadError) throw uploadError

      const { error: completeError } = await supabase.functions.invoke('ata-transcriptions', {
        body: { action: 'complete', jobId: data.jobId },
      })
      if (completeError) throw await describeFunctionError(completeError, 'Não foi possível enfileirar a transcrição.')
    } catch (uploadError) {
      // Do not leave an orphaned upload job as the current transcription when the
      // browser loses the connection between signed upload and queueing.
      await supabase.functions.invoke('ata-transcriptions', {
        body: { action: 'cancel', jobId: data.jobId },
      })
      throw uploadError
    }
  },

  async retry(jobId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('ata-transcriptions', {
      body: { action: 'retry', jobId },
    })
    if (error) throw await describeFunctionError(error, 'Não foi possível reenfileirar a transcrição.')
  },

  async saveReview(transcriptionId: string, revisedText: string, isReviewed: boolean): Promise<void> {
    const { error } = await untypedSupabase
      .from('omnia_ata_transcriptions')
      .update({
        revised_text: revisedText,
        is_reviewed: isReviewed,
      })
      .eq('id', transcriptionId)
    if (error) throw error
  },

  // Devolve null quando a gravação não existe mais no bucket — transcrições
  // anteriores à retenção do áudio continuam revisáveis, apenas sem player.
  async audioUrl(jobId: string): Promise<string | null> {
    const { data, error } = await supabase.functions.invoke<{ url: string | null }>('ata-transcriptions', {
      body: { action: 'audio', jobId },
    })
    if (error) throw await describeFunctionError(error, 'Não foi possível carregar a gravação.')
    return data?.url ?? null
  },

  // A ata deixa de ter transcrição atual e o painel volta a pedir uma gravação.
  // O job, o áudio e o texto permanecem no histórico — descartar é uma decisão
  // editorial, não um expurgo de dados.
  async discard(jobId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('ata-transcriptions', {
      body: { action: 'discard', jobId },
    })
    if (error) throw await describeFunctionError(error, 'Não foi possível descartar a transcrição.')
  },
}
