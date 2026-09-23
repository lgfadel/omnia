import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { Agent, setGlobalDispatcher } from 'undici'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { loadAtaContext } from './ataContext.js'
import { buildCarryOver, mergeTranscribedChunks } from './transcript.js'
import { extractChunk, readAudioDuration } from './audio.js'
import { planChunks } from './chunkPlan.js'
import { createCompactedUpload } from './compactedUpload.js'
import { HEARTBEAT_SECONDS, STALE_LEASE_MINUTES, reclaimDecision } from './jobLease.js'
import { createR2Client, deleteR2Object, presignR2Get } from './r2.js'
import { commitCompactedAudio } from './storedAudio.js'

// Medido em 19/08/2026: um bloco de 20 minutos leva ~635 s para retornar. Isso
// estoura dois limites padrão de uma vez — o headersTimeout de 300 s do undici,
// que é o cliente HTTP por trás do fetch do Node, e o timeout de 600 s do SDK da
// OpenAI. Os dois precisam subir; corrigir só um faz a falha reaparecer adiante.
const REQUEST_TIMEOUT_MS = 30 * 60 * 1000

setGlobalDispatcher(new Agent({
  headersTimeout: REQUEST_TIMEOUT_MS,
  bodyTimeout: REQUEST_TIMEOUT_MS,
}))

// O whisper-1 é o large-v2 e ficou para trás em acurácia. O gpt-transcribe erra
// menos e aceita `keywords`, que é onde ancoramos os nomes próprios daquela
// assembleia — a classe de erro que mais dói numa ata. O preço é não devolver
// marcação de tempo alguma; a decisão foi trocar o player de conferência por
// acurácia, porque o texto é o produto e o player era conveniência.
// TRANSCRIPTION_MODEL existe como válvula: apontar de volta para whisper-1 no
// Railway reverte o modelo sem deploy, e o código monta a requisição certa para
// cada família.
const TRANSCRIPTION_MODEL = process.env.TRANSCRIPTION_MODEL?.trim() || 'gpt-transcribe'
const IS_WHISPER = TRANSCRIPTION_MODEL.startsWith('whisper')

 const AUDIO_BUCKET = 'ata-transcription-audio'

// A URL assinada precisa sobreviver ao job inteiro: uma gravação de 6 horas tem
// 12 blocos, e cada um espera a resposta do modelo.
const SOURCE_URL_TTL_SECONDS = 12 * 60 * 60
const CHUNK_SECONDS = 30 * 60
const MAX_DURATION_SECONDS = 6 * 60 * 60

// O Railway adormece um serviço após 10 minutos sem tráfego de SAÍDA, e serviço
// dormindo não gera cobrança de compute. O worker antigo consultava a fila a cada
// 5 segundos, o que o mantinha acordado para sempre — pagando o mês inteiro para
// trabalhar cerca de 1% do tempo. Aqui ele não pergunta nada: dorme até ser
// avisado, drena tudo o que houver e volta a ficar em silêncio.
const WAKE_PATH = '/wake'

interface TranscriptionJob {
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

type AdminClient = SupabaseClient<any, 'public', any, any, any>

const requiredEnvironment = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_ATA_TRANSCRIPTION_API_KEY', 'WORKER_WAKE_SECRET'] as const

function getEnvironment() {
  for (const key of requiredEnvironment) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)
  }

  return {
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    openAiApiKey: process.env.OPENAI_ATA_TRANSCRIPTION_API_KEY!,
    wakeSecret: process.env.WORKER_WAKE_SECRET!,
    r2: createR2Client(),
    port: Number(process.env.PORT ?? 8080),
  }
}


async function sourceUrlFor(job: TranscriptionJob, supabase: AdminClient, r2: ReturnType<typeof createR2Client>): Promise<string> {
  if (job.storage_provider === 'r2') return presignR2Get(r2.client, r2.bucket, job.storage_path, SOURCE_URL_TTL_SECONDS)
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(job.storage_path, SOURCE_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) throw error ?? new Error('Stored audio was not found.')
  return data.signedUrl
}


// Um job parado há STALE_LEASE_MINUTES perdeu o worker — o Railway encerra o
// container sem aviso. Ele volta para a fila, a menos que já tenha esgotado as
// tentativas: um job que derruba o worker toda vez não pode voltar para sempre.
async function reclaimStaleJobs(supabase: AdminClient): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_LEASE_MINUTES * 60_000).toISOString()
  const { data: stale, error } = await supabase
    .from('omnia_ata_transcription_jobs')
    .select('id, attempt_count')
    .eq('status', 'processing')
    .lt('heartbeat_at', staleBefore)
  if (error) throw error

  for (const job of (stale ?? []) as Array<{ id: string; attempt_count: number }>) {
    const update = reclaimDecision(job.attempt_count) === 'requeue'
      ? { status: 'queued', attempt_count: job.attempt_count + 1, started_at: null, heartbeat_at: null, stage: null }
      : {
        status: 'failed',
        error_message: 'O processamento desta gravação foi interrompido repetidas vezes. Tente novamente ou envie o arquivo outra vez.',
        heartbeat_at: null,
        stage: null,
        completed_at: new Date().toISOString(),
      }
    // O filtro no heartbeat evita desfazer um job que outro worker acabou de retomar.
    const { error: reclaimError } = await supabase
      .from('omnia_ata_transcription_jobs')
      .update(update)
      .eq('id', job.id)
      .eq('status', 'processing')
      .lt('heartbeat_at', staleBefore)
    if (reclaimError) throw reclaimError
    console.error(`Reclaimed stale transcription job ${job.id}: ${update.status}`)
  }
}

async function claimNextJob(supabase: AdminClient): Promise<TranscriptionJob | null> {
  await reclaimStaleJobs(supabase)

  const { data: candidate, error: candidateError } = await supabase
    .from('omnia_ata_transcription_jobs')
    .select('id')
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
    .select('id, ata_id, storage_path, storage_provider, size_bytes, mime_type, status, attempt_count, context_text')
    .maybeSingle()
  if (claimError) throw claimError
  return claimed as TranscriptionJob | null
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

async function processJob(
  job: TranscriptionJob,
  supabase: AdminClient,
  openai: OpenAI,
  r2: ReturnType<typeof createR2Client>,
): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'omnia-ata-transcription-'))
  const stopHeartbeat = startHeartbeat(supabase, job.id)
  const compacted = createCompactedUpload({ storagePath: job.storage_path, storageProvider: job.storage_provider }, r2)
  try {
    // A interface fica minutos sem novidade durante um bloco longo; publicar a
    // etapa e a contagem de blocos é o que diferencia "trabalhando" de "travado".
    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'splitting', processed_chunks: 0, total_chunks: null })
      .eq('id', job.id)
    const sourceUrl = await sourceUrlFor(job, supabase, r2)
    const durationSeconds = await readAudioDuration(sourceUrl)
    if (durationSeconds > MAX_DURATION_SECONDS) throw new Error('Audio exceeds the maximum duration.')
    const windows = planChunks(durationSeconds, CHUNK_SECONDS)
    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'transcribing', total_chunks: windows.length })
      .eq('id', job.id)

    const context = await loadAtaContext(supabase, job.ata_id, job.context_text)
    const chunkResults = [] as Array<{ chunkIndex: number; text: string }>
    const usages: Record<string, unknown>[] = []
    let carryOver = ''
    const chunkPath = join(workspace, 'chunk.mp3')
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

      const result = await openai.audio.transcriptions.create(
        request as unknown as SdkTranscriptionParams,
      ) as unknown as OpenAITranscription
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
        })
      }
      await rm(chunkPath, { force: true })

      const { error: progressError } = await supabase
        .from('omnia_ata_transcription_jobs')
        .update({ processed_chunks: window.index + 1, heartbeat_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'processing')
      if (progressError) throw progressError
    }

    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'saving' })
      .eq('id', job.id)
    const merged = mergeTranscribedChunks(chunkResults)
    const { data: transcription, error: transcriptError } = await supabase
      .from('omnia_ata_transcriptions')
      .upsert({ ata_id: job.ata_id, job_id: job.id, raw_text: merged.rawText, language: 'pt-BR' }, { onConflict: 'job_id' })
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
    if (compacted && compacted.sizeBytes > 0) {
      await commitCompactedAudio({
        key: job.storage_path,
        sizeBytes: compacted.sizeBytes,
        originalSizeBytes: Number(job.size_bytes),
        complete: () => compacted.complete(),
        abort: () => compacted.abort(),
        remove: (key) => deleteR2Object(r2.client, r2.bucket, key),
        persist: async (record) => {
          const { error } = await supabase
            .from('omnia_ata_transcription_jobs')
            .update({ storage_path: record.storagePath, size_bytes: record.sizeBytes, mime_type: record.mimeType })
            .eq('id', job.id)
          if (error) throw error
        },
      })
        .then((stored) => {
          if (stored.replaced) console.log(`Compacted stored audio for job ${job.id}: ${job.size_bytes} -> ${stored.sizeBytes} bytes`)
        })
        .catch(async (error) => {
          console.error(`Unable to compact stored audio for job ${job.id}`, error)
          await compacted.abort().catch(() => undefined)
        })
    }

    const { error: completeError } = await supabase
      .from('omnia_ata_transcription_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString(), heartbeat_at: null, stage: null, usage: { chunks: usages } })
      .eq('id', job.id)
    if (completeError) throw completeError
  } catch (error) {
    // Keep provider and infrastructure details in Railway logs only. The application
    // exposes a safe, actionable error to ATA users.
    console.error(`Transcription job ${job.id} failed`, error)
    await compacted?.abort().catch(() => undefined)
    const { error: failError } = await supabase
      .from('omnia_ata_transcription_jobs')
      .update({
        status: 'failed',
        error_message: 'Não foi possível processar esta gravação. Verifique o arquivo e tente novamente.',
        heartbeat_at: null,
        stage: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    if (failError) console.error('Unable to mark transcription job as failed', failError)
    throw error
  } finally {
    stopHeartbeat()
    await rm(workspace, { recursive: true, force: true })
  }
}

async function runWorker() {
  const environment = getEnvironment()
  const supabase = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const openai = new OpenAI({ apiKey: environment.openAiApiKey, timeout: REQUEST_TIMEOUT_MS })
  let draining: Promise<void> | null = null

  // Uma chamada de wake pode chegar enquanto outra drenagem ainda roda. Reaproveitar
  // a promessa em curso evita dois processamentos do mesmo trabalho e mantém o
  // claim otimista do banco como única fonte de verdade.
  const drainQueue = async () => {
    for (;;) {
      const job = await claimNextJob(supabase)
      if (!job) return
      try {
        await processJob(job, supabase, openai, environment.r2)
      } catch (error) {
        console.error('Transcription job failed, continuing with the queue', error)
      }
    }
  }

  const drain = () => {
    if (!draining) {
      draining = drainQueue()
        .catch((error) => console.error('Transcription drain failed', error))
        .finally(() => { draining = null })
    }
    return draining
  }

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (request.method !== 'POST' || url.pathname !== WAKE_PATH) {
      response.writeHead(404).end()
      return
    }
    if (request.headers.authorization !== `Bearer ${environment.wakeSecret}`) {
      response.writeHead(401).end()
      return
    }
    // Responder antes de drenar: a transcrição leva minutos e quem chamou não pode
    // ficar preso esperando. O trabalho continua depois da resposta.
    response.writeHead(202, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: 'draining' }))
    void drain()
  })

  server.listen(environment.port, () => {
    console.log(`Transcription worker listening on ${environment.port}`)
  })

  // Um deploy ou um reinício pode acontecer com trabalho parado na fila, e nesse
  // caso ninguém vai chamar o wake de novo.
  void drain()
}

runWorker().catch((error) => {
  console.error('Unable to start transcription worker', error)
  process.exitCode = 1
})
