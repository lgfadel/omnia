import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { mergeDiarizedChunks, type DiarizedSegment } from './transcript.js'

const AUDIO_BUCKET = 'ata-transcription-audio'
const CHUNK_SECONDS = 20 * 60
const MAX_DURATION_SECONDS = 6 * 60 * 60
const POLL_INTERVAL_MS = 5_000
const STALE_LEASE_MINUTES = 45

interface TranscriptionJob {
  id: string
  ata_id: string
  storage_path: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  attempt_count: number
}

interface OpenAITranscription {
  text?: string
  segments?: DiarizedSegment[]
  usage?: Record<string, unknown>
}

type AdminClient = SupabaseClient<any, 'public', any, any, any>

const requiredEnvironment = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_ATA_TRANSCRIPTION_API_KEY'] as const

function getEnvironment() {
  for (const key of requiredEnvironment) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)
  }

  return {
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    openAiApiKey: process.env.OPENAI_ATA_TRANSCRIPTION_API_KEY!,
  }
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: 'pipe' })
    let stderr = ''
    process.stderr.on('data', (value) => { stderr += value.toString() })
    process.on('error', reject)
    process.on('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`${command} failed with code ${code}: ${stderr.slice(-500)}`))
    })
  })
}

function readAudioDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath,
    ], { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    process.stdout.on('data', (value) => { stdout += value.toString() })
    process.stderr.on('data', (value) => { stderr += value.toString() })
    process.on('error', reject)
    process.on('close', (code) => {
      const duration = Number.parseFloat(stdout.trim())
      if (code === 0 && Number.isFinite(duration) && duration > 0) return resolve(duration)
      reject(new Error(`ffprobe could not determine audio duration: ${stderr.slice(-500)}`))
    })
  })
}

async function splitAudio(inputPath: string, workspace: string): Promise<string[]> {
  const outputPattern = join(workspace, 'chunk-%03d.mp3')
  await run('ffmpeg', [
    '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k',
    '-f', 'segment', '-segment_time', String(CHUNK_SECONDS), '-reset_timestamps', '1', outputPattern,
  ])
  return (await readdir(workspace))
    .filter((file) => file.startsWith('chunk-') && file.endsWith('.mp3'))
    .sort()
    .map((file) => join(workspace, file))
}

async function claimNextJob(supabase: AdminClient): Promise<TranscriptionJob | null> {
  const staleBefore = new Date(Date.now() - STALE_LEASE_MINUTES * 60_000).toISOString()
  const { error: reclaimError } = await supabase
    .from('omnia_ata_transcription_jobs')
    .update({ status: 'queued', started_at: null, heartbeat_at: null })
    .eq('status', 'processing')
    .lt('heartbeat_at', staleBefore)
  if (reclaimError) throw reclaimError

  const { data: candidate, error: candidateError } = await supabase
    .from('omnia_ata_transcription_jobs')
    .select('id, ata_id, storage_path, status, attempt_count')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (candidateError) throw candidateError
  if (!candidate) return null

  const { data: claimed, error: claimError } = await supabase
    .from('omnia_ata_transcription_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() })
    .eq('id', candidate.id)
    .eq('status', 'queued')
    .select('id, ata_id, storage_path, status, attempt_count')
    .maybeSingle()
  if (claimError) throw claimError
  return claimed as TranscriptionJob | null
}

async function processJob(
  job: TranscriptionJob,
  supabase: AdminClient,
  openai: OpenAI,
): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'omnia-ata-transcription-'))
  try {
    const { data: audio, error: downloadError } = await supabase.storage.from(AUDIO_BUCKET).download(job.storage_path)
    if (downloadError || !audio) throw downloadError ?? new Error('Temporary audio was not found.')

    const inputPath = join(workspace, basename(job.storage_path))
    await pipeline(audio.stream(), createWriteStream(inputPath))
    const durationSeconds = await readAudioDuration(inputPath)
    if (durationSeconds > MAX_DURATION_SECONDS) throw new Error('Audio exceeds the maximum duration.')
    const chunks = await splitAudio(inputPath, workspace)
    if (chunks.length === 0) throw new Error('The audio could not be split into processable chunks.')

    const chunkResults = [] as Array<{ chunkIndex: number; startOffsetSeconds: number; segments: DiarizedSegment[] }>
    const usages: Record<string, unknown>[] = []
    for (const [index, chunkPath] of chunks.entries()) {
      const { error: heartbeatError } = await supabase
        .from('omnia_ata_transcription_jobs')
        .update({ heartbeat_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'processing')
      if (heartbeatError) throw heartbeatError

      const result = await openai.audio.transcriptions.create({
        file: createReadStream(chunkPath),
        model: 'gpt-4o-transcribe-diarize',
        language: 'pt',
        response_format: 'diarized_json',
        chunking_strategy: 'auto',
      }) as unknown as OpenAITranscription
      chunkResults.push({
        chunkIndex: index + 1,
        startOffsetSeconds: index * CHUNK_SECONDS,
        segments: result.segments ?? [{ start: 0, end: CHUNK_SECONDS, speaker: 'A', text: result.text ?? '' }],
      })
      if (result.usage) usages.push(result.usage)
    }

    const merged = mergeDiarizedChunks(chunkResults)
    const { data: transcription, error: transcriptError } = await supabase
      .from('omnia_ata_transcriptions')
      .upsert({ ata_id: job.ata_id, job_id: job.id, raw_text: merged.rawText, language: 'pt-BR' }, { onConflict: 'job_id' })
      .select('id')
      .single()
    if (transcriptError || !transcription) throw transcriptError ?? new Error('Could not persist transcription.')

    const { error: deleteSegmentsError } = await supabase
      .from('omnia_ata_transcription_segments')
      .delete()
      .eq('transcription_id', transcription.id)
    if (deleteSegmentsError) throw deleteSegmentsError

    if (merged.segments.length > 0) {
      const { error: insertSegmentsError } = await supabase.from('omnia_ata_transcription_segments').insert(
        merged.segments.map((segment) => ({
          transcription_id: transcription.id,
          sequence: segment.sequence,
          start_ms: segment.startMs,
          end_ms: segment.endMs,
          speaker_label: segment.speakerLabel,
          text: segment.text,
        })),
      )
      if (insertSegmentsError) throw insertSegmentsError
    }

    const { error: removeError } = await supabase.storage.from(AUDIO_BUCKET).remove([job.storage_path])
    if (removeError) throw removeError

    const { error: completeError } = await supabase
      .from('omnia_ata_transcription_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString(), heartbeat_at: null, usage: { chunks: usages } })
      .eq('id', job.id)
    if (completeError) throw completeError
  } catch (error) {
    // Keep provider and infrastructure details in Railway logs only. The application
    // exposes a safe, actionable error to ATA users.
    console.error(`Transcription job ${job.id} failed`, error)
    const { error: failError } = await supabase
      .from('omnia_ata_transcription_jobs')
      .update({
        status: 'failed',
        error_message: 'Não foi possível processar esta gravação. Verifique o arquivo e tente novamente.',
        heartbeat_at: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    if (failError) console.error('Unable to mark transcription job as failed', failError)
    throw error
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

async function runWorker() {
  const environment = getEnvironment()
  const supabase = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const openai = new OpenAI({ apiKey: environment.openAiApiKey })
  let isProcessing = false

  const poll = async () => {
    if (isProcessing) return
    isProcessing = true
    try {
      const job = await claimNextJob(supabase)
      if (job) await processJob(job, supabase, openai)
    } catch (error) {
      console.error('Transcription worker poll failed', error)
    } finally {
      isProcessing = false
    }
  }

  await poll()
  setInterval(poll, POLL_INTERVAL_MS)
}

runWorker().catch((error) => {
  console.error('Unable to start transcription worker', error)
  process.exitCode = 1
})
