import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { Agent, setGlobalDispatcher } from 'undici'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { loadAtaContext } from './ataContext.js'
import { buildCarryOver, mergeTranscribedChunks } from './transcript.js'

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

// Gravações de assembleia são de campo distante, com clipping e vozes em volumes
// muito diferentes. Sem tratamento o modelo perde as falas mais baixas: normalizar
// e comprimir a dinâmica rendeu ~19% mais conteúdo transcrito na medição.
const AUDIO_FILTERS = 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=7,acompressor=threshold=-18dB:ratio=4:attack=20:release=250'

const AUDIO_BUCKET = 'ata-transcription-audio'
const CHUNK_SECONDS = 30 * 60
const MAX_DURATION_SECONDS = 6 * 60 * 60
const STALE_LEASE_MINUTES = 45

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
  status: 'queued' | 'processing' | 'completed' | 'failed'
  attempt_count: number
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
    port: Number(process.env.PORT ?? 8080),
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
    '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-af', AUDIO_FILTERS, '-b:a', '64k',
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
    // A interface fica minutos sem novidade durante um bloco longo; publicar a
    // etapa e a contagem de blocos é o que diferencia "trabalhando" de "travado".
    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'downloading', processed_chunks: 0, total_chunks: null })
      .eq('id', job.id)
    const { data: audio, error: downloadError } = await supabase.storage.from(AUDIO_BUCKET).download(job.storage_path)
    if (downloadError || !audio) throw downloadError ?? new Error('Temporary audio was not found.')

    const inputPath = join(workspace, basename(job.storage_path))
    await pipeline(audio.stream(), createWriteStream(inputPath))
    const durationSeconds = await readAudioDuration(inputPath)
    if (durationSeconds > MAX_DURATION_SECONDS) throw new Error('Audio exceeds the maximum duration.')
    await supabase.from('omnia_ata_transcription_jobs').update({ stage: 'splitting' }).eq('id', job.id)
    const chunks = await splitAudio(inputPath, workspace)
    if (chunks.length === 0) throw new Error('The audio could not be split into processable chunks.')
    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'transcribing', total_chunks: chunks.length })
      .eq('id', job.id)

    const context = await loadAtaContext(supabase, job.ata_id)
    const chunkResults = [] as Array<{ chunkIndex: number; text: string }>
    const usages: Record<string, unknown>[] = []
    let carryOver = ''
    for (const [index, chunkPath] of chunks.entries()) {
      const { error: heartbeatError } = await supabase
        .from('omnia_ata_transcription_jobs')
        .update({ heartbeat_at: new Date().toISOString(), processed_chunks: index })
        .eq('id', job.id)
        .eq('status', 'processing')
      if (heartbeatError) throw heartbeatError

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
      chunkResults.push({ chunkIndex: index + 1, text })
      carryOver = buildCarryOver(text)
      if (result.usage) usages.push(result.usage)
    }

    await supabase.from('omnia_ata_transcription_jobs')
      .update({ stage: 'saving', processed_chunks: chunks.length })
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
    // modelo ou outro contexto, sem pedir o arquivo de novo a quem revisa. A
    // limpeza acontece quando a transcrição deixa de ser a atual da ata —
    // substituída ou descartada —, o que mantém no bucket um arquivo por ata.

    const { error: completeError } = await supabase
      .from('omnia_ata_transcription_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString(), heartbeat_at: null, stage: null, usage: { chunks: usages } })
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
        stage: null,
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
        await processJob(job, supabase, openai)
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
