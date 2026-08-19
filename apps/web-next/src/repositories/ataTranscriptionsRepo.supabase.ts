import { supabase } from '@/integrations/supabase/client'
import type {
  AtaTranscription,
  AtaTranscriptionJob,
  AtaTranscriptionSegment,
  AtaTranscriptionStatus,
} from '@/data/types'

const AUDIO_BUCKET = 'ata-transcription-audio'

type DbJob = {
  id: string
  ata_id: string
  status: AtaTranscriptionStatus
  original_filename: string
  error_message: string | null
  attempt_count: number
  created_at: string
}

type DbSegment = {
  id: string
  sequence: number
  start_ms: number
  end_ms: number
  speaker_label: string
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

function mapJob(job: DbJob): AtaTranscriptionJob {
  return {
    id: job.id,
    ataId: job.ata_id,
    status: job.status,
    originalFilename: job.original_filename,
    errorMessage: job.error_message ?? undefined,
    attemptCount: job.attempt_count,
    createdAt: job.created_at,
  }
}

function mapSegment(segment: DbSegment): AtaTranscriptionSegment {
  return {
    id: segment.id,
    sequence: segment.sequence,
    startMs: segment.start_ms,
    endMs: segment.end_ms,
    speakerLabel: segment.speaker_label,
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
      .select('id, ata_id, status, original_filename, error_message, attempt_count, created_at')
      .eq('ata_id', ataId)
      .eq('is_current', true)
      .maybeSingle()

    if (jobError) throw jobError

    const { data: transcription, error: transcriptionError } = job
      ? await untypedSupabase
        .from('omnia_ata_transcriptions')
        .select('*, omnia_ata_transcription_segments(*)')
        .eq('job_id', job.id)
        .maybeSingle()
      : { data: null, error: null }

    if (transcriptionError) throw transcriptionError
    return {
      job: job ? mapJob(job as DbJob) : null,
      transcription: transcription ? mapTranscription(transcription as DbTranscription) : null,
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
    if (error || !data) throw error ?? new Error('Não foi possível iniciar o envio do áudio.')

    try {
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .uploadToSignedUrl(data.path, data.token, file)
      if (uploadError) throw uploadError

      const { error: completeError } = await supabase.functions.invoke('ata-transcriptions', {
        body: { action: 'complete', jobId: data.jobId },
      })
      if (completeError) throw completeError
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
    if (error) throw error
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

  async renameSpeaker(segmentId: string, speakerName: string): Promise<void> {
    const { error } = await untypedSupabase
      .from('omnia_ata_transcription_segments')
      .update({ speaker_name: speakerName.trim() || null })
      .eq('id', segmentId)
    if (error) throw error
  },
}
