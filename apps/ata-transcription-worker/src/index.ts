import { processJob, type TranscriptionJob } from './processJob.js'
import { createServer } from 'node:http'
import { Agent, setGlobalDispatcher } from 'undici'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { claimCurrentQueuedJob, STALE_LEASE_MINUTES, reclaimDecision, type TranscriptionWorkerClient } from './jobLease.js'
import { createR2Client } from './r2.js'

type AdminClient = TranscriptionWorkerClient

// Medido em 19/08/2026: um bloco de 20 minutos leva ~635 s para retornar. Isso
// estoura dois limites padrão de uma vez — o headersTimeout de 300 s do undici,
// que é o cliente HTTP por trás do fetch do Node, e o timeout de 600 s do SDK da
// OpenAI. Os dois precisam subir; corrigir só um faz a falha reaparecer adiante.
const REQUEST_TIMEOUT_MS = 30 * 60 * 1000

setGlobalDispatcher(new Agent({
  headersTimeout: REQUEST_TIMEOUT_MS,
  bodyTimeout: REQUEST_TIMEOUT_MS,
}))

// O Railway adormece um serviço após 10 minutos sem tráfego de SAÍDA, e serviço
// dormindo não gera cobrança de compute. O worker antigo consultava a fila a cada
// 5 segundos, o que o mantinha acordado para sempre — pagando o mês inteiro para
// trabalhar cerca de 1% do tempo. Aqui ele não pergunta nada: dorme até ser
// avisado, drena tudo o que houver e volta a ficar em silêncio.
const WAKE_PATH = '/wake'

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
  return claimCurrentQueuedJob<TranscriptionJob>(supabase)
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
