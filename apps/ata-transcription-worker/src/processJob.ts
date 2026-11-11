import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import OpenAI from 'openai'
import { loadAtaContext } from './ataContext.js'
import { buildCarryOver, mergeTranscribedChunks } from './transcript.js'
import { extractChunk, readAudioDuration } from './audio.js'
import { planChunks } from './chunkPlan.js'
import { type CompactedUpload, createCompactedUpload } from './compactedUpload.js'
import {
  HEARTBEAT_SECONDS,
  isCurrentProcessingJob,
  type TranscriptionWorkerClient,
} from './jobLease.js'
import { createR2Client, deleteR2Object, presignR2Get } from './r2.js'
import { commitCompactedAudio } from './storedAudio.js'

// Preserve the production model default and optional rollback override.
const TRANSCRIPTION_MODEL = process.env.TRANSCRIPTION_MODEL?.trim() || 'gpt-transcribe'
const IS_WHISPER = TRANSCRIPTION_MODEL.startsWith('whisper')
const AUDIO_BUCKET = 'ata-transcription-audio'
// Signed URLs must survive every source in a six-hour job.
const SOURCE_URL_TTL_SECONDS = 12 * 60 * 60
const CHUNK_SECONDS = 30 * 60
const MAX_DURATION_SECONDS = 6 * 60 * 60
export interface TranscriptionJob {
  id: string
  ata_id: string
  storage_path: string
  storage_provider: 'supabase' | 'r2'
  size_bytes: number
  mime_type: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  attempt_count: number
  context_text: string | null
}

interface OpenAITranscription {
  text?: string
  usage?: Record<string, unknown>
}

// `keywords` e `languages` são do gpt-transcribe e ainda não existem nos tipos
// do SDK, que os encaminha como campos extras do multipart (arrays viram
// `campo[]`, a convenção da própria API). Descrever a requisição aqui é o que
// permite usar o parâmetro que ancora os nomes próprios da assembleia.
type TranscriptionRequest = {
  file: ReturnType<typeof createReadStream>
  model: string
  prompt: string
  response_format: 'json'
  language?: string
  temperature?: number
  keywords?: string[]
  languages?: string[]
}

type SdkTranscriptionParams = Parameters<OpenAI['audio']['transcriptions']['create']>[0]

type AdminClient = TranscriptionWorkerClient

type AudioSource = Pick<TranscriptionJob, 'storage_path' | 'storage_provider' | 'size_bytes' | 'mime_type'> & { id?: string; position: number }

async function sourceUrlFor(job: AudioSource, supabase: AdminClient, r2: ReturnType<typeof createR2Client>): Promise<string> {
  if (job.storage_provider === 'r2') return presignR2Get(r2.client, r2.bucket, job.storage_path, SOURCE_URL_TTL_SECONDS)
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(job.storage_path, SOURCE_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) throw error ?? new Error('Stored audio was not found.')
  return data.signedUrl
}


// O sinal de vida sai num intervalo próprio, e não entre etapas: uma resposta do
// modelo pode levar mais de dez minutos, e é o intervalo que separa "ainda
// trabalhando" de "o container morreu" em minutos, não em três quartos de hora.
function startHeartbeat(supabase: AdminClient, jobId: string): () => void {
  const beat = async () => {
    const { error } = await supabase
      .from('omnia_ata_transcription_jobs')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'processing')
    if (error) console.error(`Unable to publish heartbeat for job ${jobId}`, error)
  }
  const timer = setInterval(() => void beat(), HEARTBEAT_SECONDS * 1000)
  return () => clearInterval(timer)
}

export async function processJob(
  job: TranscriptionJob,
  supabase: AdminClient,
  openai: OpenAI,
  r2: ReturnType<typeof createR2Client>,
): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'omnia-ata-transcription-'))
  const stopHeartbeat = startHeartbeat(supabase, job.id)
  const uploads = new Set<CompactedUpload>()
  try {
    // A interface fica minutos sem novidade durante um bloco longo; publicar a
    // etapa e a contagem de blocos é o que diferencia "trabalhando" de "travado".
    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'splitting', processed_chunks: 0, total_chunks: null })
      .eq('id', job.id)
    const { data: fileRows, error: fileError } = await supabase
      .from('omnia_ata_transcription_files')
      .select('id,job_id,position,original_filename,mime_type,size_bytes,duration_seconds,storage_path,storage_provider,upload_id')
      .eq('job_id', job.id)
      .order('position', { ascending: true })
    if (fileError) throw fileError
    const sources: AudioSource[] = fileRows?.length
      ? [...fileRows].sort((a, b) => a.position - b.position)
      : [{ ...job, id: undefined, position: 1 }]
    if (sources.length > 3) throw new Error('Too many audio sources.')
    const prepared = []
    let totalDuration = 0
    for (const source of sources) {
      const compacted = createCompactedUpload({ storagePath: source.storage_path, storageProvider: source.storage_provider }, r2)
      if (compacted) uploads.add(compacted)
      const sourceUrl = await sourceUrlFor(source, supabase, r2)
      const duration = await readAudioDuration(sourceUrl)
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('Audio duration must be positive and finite.')
      totalDuration += duration
      prepared.push({ source, sourceUrl, windows: planChunks(duration, CHUNK_SECONDS), compacted })
    }
    if (totalDuration > MAX_DURATION_SECONDS) throw new Error('Audio exceeds the maximum duration.')
    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'transcribing', total_chunks: prepared.reduce((sum, item) => sum + item.windows.length, 0) })
      .eq('id', job.id)

    const context = await loadAtaContext(supabase, job.ata_id, job.context_text)
    const sourceTexts: string[] = []
    let processedChunks = 0
    const usages: Record<string, unknown>[] = []
    let carryOver = ''
    const chunkPath = join(workspace, 'chunk.mp3')
    for (const { sourceUrl, windows, compacted } of prepared) {
      const chunkResults: Array<{ chunkIndex: number; text: string }> = []
      for (const window of windows) {
        await extractChunk(sourceUrl, window, chunkPath)

        const prompt = carryOver ? `${context.prompt} Continuação de: ${carryOver}` : context.prompt
        const request: TranscriptionRequest = IS_WHISPER
          ? {
            file: createReadStream(chunkPath),
            model: TRANSCRIPTION_MODEL,
            language: 'pt',
            prompt,
            temperature: 0,
            response_format: 'json',
          }
          : {
            file: createReadStream(chunkPath),
            model: TRANSCRIPTION_MODEL,
            languages: ['pt'],
            keywords: context.keywords,
            prompt,
            response_format: 'json',
          }

        if (!await isCurrentProcessingJob(supabase, job.id)) {
          throw new Error(`Transcription job ${job.id} was superseded before chunk ${window.index + 1}.`)
        }

        const result = await openai.audio.transcriptions.create(
          request as unknown as SdkTranscriptionParams,
        ) as unknown as OpenAITranscription
        if (!await isCurrentProcessingJob(supabase, job.id)) {
          throw new Error(`Transcription job ${job.id} was superseded during chunk ${window.index + 1}.`)
        }
        const text = result.text ?? ''
        chunkResults.push({ chunkIndex: window.index + 1, text })
        carryOver = buildCarryOver(text)
        if (result.usage) usages.push(result.usage)

        // Guardar o áudio é conveniência; perder essa parte não pode custar a
        // transcrição. Na primeira falha o upload é abandonado e o original fica.
        if (compacted) {
          const partSize = (await stat(chunkPath)).size
          await compacted.addPart(chunkPath, partSize).catch(async (error) => {
            console.error(`Unable to store compacted audio for job ${job.id}; keeping the original`, error)
            await compacted.abort().catch(() => undefined)
            uploads.delete(compacted)
          })
        }
        await rm(chunkPath, { force: true })

        const { error: progressError } = await supabase
          .from('omnia_ata_transcription_jobs')
          .update({ processed_chunks: ++processedChunks, heartbeat_at: new Date().toISOString() })
          .eq('id', job.id)
          .eq('status', 'processing')
        if (progressError) throw progressError
      }

      sourceTexts.push(mergeTranscribedChunks(chunkResults).rawText)
    }

    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'saving' })
      .eq('id', job.id)
    const rawText = sourceTexts.join('\n\n')
    if (!await isCurrentProcessingJob(supabase, job.id)) {
      throw new Error(`Transcription job ${job.id} was superseded before transcript persistence.`)
    }
    const { data: transcription, error: transcriptError } = await supabase
      .from('omnia_ata_transcriptions')
      .upsert({ ata_id: job.ata_id, job_id: job.id, raw_text: rawText, language: 'pt-BR' }, { onConflict: 'job_id' })
      .select('id')
      .single()
    if (transcriptError || !transcription) throw transcriptError ?? new Error('Could not persist transcription.')

    // Uma reprocessada precisa começar limpa: sem isso, os trechos da transcrição
    // anterior deste mesmo job ficariam órfãos apontando para o texto novo.
    const { error: deleteSegmentsError } = await supabase
      .from('omnia_ata_transcription_segments')
      .delete()
      .eq('transcription_id', transcription.id)
    if (deleteSegmentsError) throw deleteSegmentsError

    // O áudio fica retido para permitir reprocessar a mesma gravação com outro
    // modelo ou outro contexto, sem pedir o arquivo de novo a quem revisa — na
    // versão compactada que o modelo acabou de ouvir. A limpeza definitiva
    // continua acontecendo quando a transcrição deixa de ser a atual da ata.
    // Uma falha aqui não invalida a transcrição, que é o produto.
    for (const { source, compacted } of prepared) {
      if (compacted && compacted.sizeBytes > 0) {
        await commitCompactedAudio({
          key: source.storage_path,
          sizeBytes: compacted.sizeBytes,
          originalSizeBytes: Number(source.size_bytes),
          complete: () => compacted.complete(),
          abort: () => compacted.abort(),
          remove: (key) => deleteR2Object(r2.client, r2.bucket, key),
          persist: async (record) => {
            if (source.id) {
              const { error } = await supabase.rpc('omnia_commit_ata_transcription_file', {
                p_file_id: source.id, p_storage_path: record.storagePath,
                p_size_bytes: record.sizeBytes, p_mime_type: record.mimeType,
              })
              if (error) throw error
            } else {
              const { data, error } = await supabase
                .from('omnia_ata_transcription_jobs')
                .update({ storage_path: record.storagePath, size_bytes: record.sizeBytes, mime_type: record.mimeType })
                .eq('id', job.id).eq('status', 'processing').eq('is_current', true)
                .select('id').maybeSingle()
              if (error || !data) throw error ?? new Error('Legacy compaction was superseded.')
            }
          },
        })
          .then((stored) => {
            uploads.delete(compacted)
            if (stored.replaced) console.log(`Compacted stored audio for job ${job.id}: ${source.size_bytes} -> ${stored.sizeBytes} bytes`)
          })
          .catch(async (error) => {
            console.error(`Unable to compact stored audio for job ${job.id}`, error)
            await compacted.abort().catch(() => undefined)
            uploads.delete(compacted)
          })
      }
    }

    const { data: completedJob, error: completeError } = await supabase
      .from('omnia_ata_transcription_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString(), heartbeat_at: null, stage: null, usage: { chunks: usages } })
      .eq('id', job.id)
      .eq('status', 'processing')
      .eq('is_current', true)
      .select('id')
      .maybeSingle()
    if (completeError || !completedJob) {
      throw completeError ?? new Error(`Transcription job ${job.id} was superseded before completion.`)
    }
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
        stage: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id).eq('status', 'processing').eq('is_current', true)
    if (failError) console.error('Unable to mark transcription job as failed', failError)
    throw error
  } finally {
    stopHeartbeat()
    await Promise.all([...uploads].map(upload => upload.abort().catch(() => undefined)))
    await rm(workspace, { recursive: true, force: true })
  }
}

