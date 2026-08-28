import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { abortR2MultipartUpload, completeR2MultipartUpload, createR2DownloadUrl, deleteR2Object, r2ObjectSize, startR2MultipartUpload } from './r2.ts'

// O projeto ainda assina JWT com o segredo legado (HS256, sem "kid"), então
// bibliotecas que verificam token via JWKS rejeitam toda credencial. A validação
// aqui é feita contra o servidor de auth, que é o padrão das demais funções.
// Uma origem única fixa quebra o desenvolvimento local silenciosamente: o browser
// bloqueia no preflight e o erro chega como falha de rede, sem status. A lista vem
// de ALLOWED_ORIGINS (separada por vírgula) e a origem recebida é refletida apenas
// quando consta nela — nunca "*", que dispensaria a checagem.
// O padrão é o domínio próprio, não o *.vercel.app: a produção atende em
// omnia.loovus.com.br, e apontar o fallback para o domínio da plataforma já
// deixou toda chamada de produção bloqueada no preflight, com "Failed to send a
// request to the Edge Function" na tela e nenhum registro do lado do servidor.
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('ALLOWED_ORIGIN') ?? 'https://omnia.loovus.com.br')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : [...ALLOWED_ORIGINS][0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

// A convocação inteira não interessa: cabeçalho e pauta bastam, e um texto
// longo demais no prompt dilui justamente o que ele deveria ancorar.
const MAX_CONTEXT_CHARS = 4000

const AUDIO_BUCKET = 'ata-transcription-audio'
const MAX_DURATION_SECONDS = 6 * 60 * 60
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024
// Uma revisão de assembleia dura horas; um link curto obrigaria a recarregar a
// página no meio do trabalho.
const AUDIO_URL_TTL_SECONDS = 4 * 60 * 60

const ACCEPTED_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac',
  'audio/wav', 'audio/x-wav', 'video/mp4', 'audio/webm', 'video/webm',
  'audio/ogg', 'audio/opus',
])

type Action = 'create' | 'complete' | 'retry' | 'cancel' | 'discard' | 'audio'
type TeamProfile = { id: string; roles: string[] | null }
type AtaAccess = { responsible_id: string | null }

function isAction(value: unknown): value is Action {
  return value === 'create' || value === 'complete' || value === 'retry' || value === 'cancel' || value === 'discard' || value === 'audio'
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160)
}

function isTranscriptionTeamMember(profile: TeamProfile, ata: AtaAccess): boolean {
  return Boolean(profile.roles?.some((role) => role === 'ADMIN' || role === 'SECRETARIO') || ata.responsible_id === profile.id)
}

function jsonWithCors(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// O worker do Railway dorme após 10 minutos sem tráfego de saída e não é cobrado
// enquanto dorme. Por isso ele não consulta mais a fila: precisa ser avisado no
// exato momento em que há trabalho. A falha do aviso não pode derrubar a
// requisição do usuário — o áudio já está no Storage e o job já está enfileirado,
// então o pior caso é atraso, não perda.
async function wakeWorker(): Promise<void> {
  const url = Deno.env.get('TRANSCRIPTION_WORKER_URL')
  const secret = Deno.env.get('WORKER_WAKE_SECRET')
  if (!url || !secret) {
    console.error('Worker wake is not configured; the job will wait for the next wake')
    return
  }
  try {
    const response = await fetch(`${url}/wake`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (!response.ok) console.error('Worker wake returned', response.status)
  } catch (error) {
    console.error('Unable to wake the transcription worker', error)
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req)
  const json = (body: unknown, status = 200) => jsonWithCors(body, status, corsHeaders)

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // deno-lint-ignore no-explicit-any
  const admin: any = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Sessão não informada.' }, 401)

  const caller = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    },
  )

  const { data: { user }, error: userError } = await caller.auth.getUser()
  if (userError || !user) return json({ error: 'Sessão inválida ou expirada.' }, 401)

  async function getAuthorizedAta(ataId: string) {
    const [{ data: profile, error: profileError }, { data: ata, error: ataError }] = await Promise.all([
      admin.from('omnia_users').select('id, roles').eq('auth_user_id', user!.id).single(),
      admin.from('omnia_atas').select('id, responsible_id').eq('id', ataId).single(),
    ])
    if (profileError || ataError || !profile || !ata || !isTranscriptionTeamMember(profile, ata)) return null
    return { profile: profile as TeamProfile, ata: ata as AtaAccess & { id: string } }
  }

  try {
    if (req.method === 'GET') {
      const ataId = new URL(req.url).searchParams.get('ataId')
      if (!ataId) return json({ error: 'ataId é obrigatório.' }, 400)
      if (!await getAuthorizedAta(ataId)) return json({ error: 'Acesso negado.' }, 403)

      const [{ data: job, error: jobError }, { data: transcription, error: transcriptionError }] = await Promise.all([
        admin.from('omnia_ata_transcription_jobs').select('*').eq('ata_id', ataId).eq('is_current', true).maybeSingle(),
        admin.from('omnia_ata_transcriptions')
          .select('*, omnia_ata_transcription_segments(*)')
          .eq('ata_id', ataId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (jobError || transcriptionError) {
        console.error('Unable to load ata transcription', jobError ?? transcriptionError)
        return json({ error: 'Não foi possível carregar a transcrição.' }, 500)
      }
      // Rede de segurança: se o aviso anterior se perdeu, o job ficaria em `queued`
      // para sempre e a tela mostraria "Na fila" sem erro nenhum. O painel consulta
      // este endpoint a cada 7,5 s enquanto há trabalho ativo, então é aqui que a
      // tentativa perdida se recupera sozinha.
      if (job?.status === 'queued' && Date.parse(job.created_at) < Date.now() - 60_000) {
        await wakeWorker()
      }
      return json({ job, transcription })
    }

    if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405)

    const payload = await req.json() as {
      action?: Action
      ataId?: string
      fileName?: string
      mimeType?: string
      sizeBytes?: number
      durationSeconds?: number | null
      jobId?: string
      uploadId?: string
      parts?: Array<{ partNumber: number; etag: string }>
      contextText?: string
    }
    if (!isAction(payload.action)) return json({ error: 'Ação inválida.' }, 400)

    if (payload.action === 'create') {
      const durationSeconds = payload.durationSeconds
      if (!payload.ataId || !payload.fileName || typeof payload.sizeBytes !== 'number' || !Number.isFinite(payload.sizeBytes) || (durationSeconds != null && (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)))) {
        return json({ error: 'Dados do áudio incompletos.' }, 400)
      }
      if (!ACCEPTED_MIME_TYPES.has(payload.mimeType ?? '')) {
        // Nomear o tipo recebido evita um beco sem saída: o formato que o
        // navegador reporta nem sempre é o que a extensão do arquivo sugere.
        return json({
          error: `Formato de áudio não suportado: "${payload.mimeType || 'desconhecido'}". Envie MP3, M4A, AAC, WAV, MP4, WebM ou OGG.`,
        }, 400)
      }
      if (payload.sizeBytes <= 0 || payload.sizeBytes > MAX_FILE_SIZE_BYTES) {
        return json({ error: 'O arquivo excede o limite de 1 GB.' }, 400)
      }
      if (typeof durationSeconds === 'number' && (durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS)) {
        return json({ error: 'A gravação deve ter até 6 horas.' }, 400)
      }

      const authorization = await getAuthorizedAta(payload.ataId)
      if (!authorization) return json({ error: 'Acesso negado.' }, 403)

      // O texto vem do navegador, que extraiu o PDF da convocação. É contexto
      // para o modelo, nunca conteúdo executável — cortar o tamanho aqui evita
      // que um PDF de 300 páginas vire um prompt impagável.
      const contextText = typeof payload.contextText === 'string'
        ? payload.contextText.slice(0, MAX_CONTEXT_CHARS).trim() || null
        : null

      const jobId = crypto.randomUUID()
      const storagePath = `${payload.ataId}/${jobId}/${sanitizeFileName(payload.fileName)}`
      const { error: insertError } = await admin.from('omnia_ata_transcription_jobs').insert({
        id: jobId,
        ata_id: payload.ataId,
        created_by: authorization.profile.id,
        storage_path: storagePath,
        original_filename: payload.fileName,
        mime_type: payload.mimeType,
        size_bytes: payload.sizeBytes,
        duration_seconds: typeof durationSeconds === 'number' ? Math.ceil(durationSeconds) : null,
        context_text: contextText,
        storage_provider: 'r2',
        is_current: false,
      })
      if (insertError) {
        console.error('Unable to create transcription job', insertError)
        return json({ error: 'Não foi possível criar o trabalho de transcrição.' }, 500)
      }

      let upload: Awaited<ReturnType<typeof startR2MultipartUpload>>
      try {
        upload = await startR2MultipartUpload(storagePath, payload.mimeType ?? '', payload.sizeBytes)
      } catch (uploadError) {
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        console.error('Unable to sign transcription upload', uploadError)
        return json({ error: 'Não foi possível preparar o envio do áudio.' }, 500)
      }

      const { data: previousJob, error: previousJobError } = await admin
        .from('omnia_ata_transcription_jobs')
        .select('id, storage_path, storage_provider')
        .eq('ata_id', payload.ataId)
        .eq('is_current', true)
        .maybeSingle()
      if (previousJobError) {
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        return json({ error: 'Não foi possível preparar a substituição da transcrição.' }, 500)
      }

      const { error: replaceError } = await admin
        .from('omnia_ata_transcription_jobs')
        .update({ is_current: false })
        .eq('ata_id', payload.ataId)
        .eq('is_current', true)
      if (replaceError) {
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        return json({ error: 'Não foi possível substituir a transcrição anterior.' }, 500)
      }

      const { error: activateError } = await admin.from('omnia_ata_transcription_jobs').update({ is_current: true }).eq('id', jobId)
      if (activateError) {
        if (previousJob) await admin.from('omnia_ata_transcription_jobs').update({ is_current: true }).eq('id', previousJob.id)
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        return json({ error: 'Não foi possível ativar o trabalho de transcrição.' }, 500)
      }

      // A gravação anterior não é mais alcançável pela tela; só o texto dela
      // segue no histórico. Manter o arquivo custaria até 1 GB por substituição.
      if (previousJob?.storage_path) {
        if (previousJob.storage_provider === 'r2') {
          await deleteR2Object(previousJob.storage_path).catch((error) => console.error('Unable to purge replaced R2 audio', error))
        } else {
          const { error: purgeError } = await admin.storage.from(AUDIO_BUCKET).remove([previousJob.storage_path])
          if (purgeError) console.error('Unable to purge replaced audio', purgeError)
        }
      }

      return json({ jobId, ...upload, parts: upload.parts.map((url, index) => ({ partNumber: index + 1, url })) }, 201)
    }

    if (!payload.jobId) return json({ error: 'jobId é obrigatório.' }, 400)
    const { data: job, error: jobError } = await admin
      .from('omnia_ata_transcription_jobs')
      .select('id, ata_id, storage_path, storage_provider, size_bytes, status, attempt_count')
      .eq('id', payload.jobId)
      .maybeSingle()
    if (jobError || !job) return json({ error: 'Trabalho não encontrado.' }, 404)
    if (!await getAuthorizedAta(job.ata_id)) return json({ error: 'Acesso negado.' }, 403)

    if (payload.action === 'complete') {
      if (job.status !== 'uploading') return json({ error: 'O áudio já foi enviado.' }, 409)
      if (!payload.uploadId || !Array.isArray(payload.parts) || payload.parts.length === 0 || payload.parts.some((part) => !Number.isInteger(part.partNumber) || part.partNumber < 1 || !part.etag)) return json({ error: 'Partes do envio inválidas.' }, 400)
      try {
        await completeR2MultipartUpload(job.storage_path, payload.uploadId, payload.parts)
        if (await r2ObjectSize(job.storage_path) !== Number(job.size_bytes)) throw new Error('R2 object size does not match job.')
      } catch (error) {
        console.error('Unable to complete R2 transcription upload', error)
        return json({ error: 'Não foi possível concluir o envio do áudio.' }, 500)
      }
      const { error } = await admin.from('omnia_ata_transcription_jobs').update({ status: 'queued', error_message: null }).eq('id', job.id)
      if (error) return json({ error: 'Não foi possível enfileirar a transcrição.' }, 500)
      await wakeWorker()
      return json({ status: 'queued' })
    }

    if (payload.action === 'cancel') {
      if (job.status !== 'uploading') return json({ error: 'Apenas envios pendentes podem ser cancelados.' }, 409)
      const { data: previousJob, error: previousJobError } = await admin
        .from('omnia_ata_transcription_jobs')
        .select('id')
        .eq('ata_id', job.ata_id)
        .neq('id', job.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (previousJobError) return json({ error: 'Não foi possível cancelar o envio.' }, 500)

      if (job.storage_provider === 'r2' && payload.uploadId) await abortR2MultipartUpload(job.storage_path, payload.uploadId).catch((error) => console.error('Unable to abort R2 upload', error))
      if (job.storage_provider === 'r2') await deleteR2Object(job.storage_path).catch(() => undefined)
      else {
        const { error: removeError } = await admin.storage.from(AUDIO_BUCKET).remove([job.storage_path])
        if (removeError) console.error('Unable to remove cancelled audio', removeError)
      }

      const { error: deleteError } = await admin.from('omnia_ata_transcription_jobs').delete().eq('id', job.id)
      if (deleteError) return json({ error: 'Não foi possível cancelar o envio.' }, 500)
      if (previousJob) await admin.from('omnia_ata_transcription_jobs').update({ is_current: true }).eq('id', previousJob.id)
      return json({ status: 'cancelled' })
    }

    if (payload.action === 'audio') {
      if (job.status === 'uploading') return json({ url: null })
      if (job.storage_provider === 'r2') {
        try { return json({ url: await createR2DownloadUrl(job.storage_path, AUDIO_URL_TTL_SECONDS) }) }
        catch (error) { console.error('Unable to sign R2 transcription audio', error); return json({ url: null }) }
      }
      const { data, error } = await admin.storage.from(AUDIO_BUCKET).createSignedUrl(job.storage_path, AUDIO_URL_TTL_SECONDS)
      // Transcrições anteriores à retenção do áudio não têm mais arquivo no
      // bucket. Isso não impede a revisão — apenas não há o que tocar —, então
      // a falha vira ausência de player, registrada no log para diagnóstico.
      if (error || !data?.signedUrl) {
        console.error('Unable to sign transcription audio', error)
        return json({ url: null })
      }
      return json({ url: data.signedUrl })
    }

    if (payload.action === 'discard') {
      // Descartar é diferente de cancelar: o áudio e o texto já processados
      // continuam no histórico da ata, ela apenas deixa de ter transcrição
      // atual. Cancelar existe só para o envio que ainda nem terminou.
      if (job.status === 'uploading') return json({ error: 'Este envio ainda está em andamento.' }, 409)
      const { error } = await admin
        .from('omnia_ata_transcription_jobs')
        .update({ is_current: false })
        .eq('id', job.id)
      if (error) {
        console.error('Unable to discard transcription', error)
        return json({ error: 'Não foi possível descartar a transcrição.' }, 500)
      }
      if (job.storage_provider === 'r2') await deleteR2Object(job.storage_path).catch((error) => console.error('Unable to purge discarded R2 audio', error))
      else {
        const { error: purgeError } = await admin.storage.from(AUDIO_BUCKET).remove([job.storage_path])
        if (purgeError) console.error('Unable to purge discarded audio', purgeError)
      }
      return json({ status: 'discarded' })
    }

    if (job.status !== 'failed') return json({ error: 'Apenas transcrições com falha podem ser reenviadas.' }, 409)
    const { error } = await admin.from('omnia_ata_transcription_jobs').update({
      status: 'queued',
      attempt_count: job.attempt_count + 1,
      error_message: null,
      started_at: null,
      heartbeat_at: null,
      completed_at: null,
      stage: null,
      total_chunks: null,
      processed_chunks: 0,
    }).eq('id', job.id)
    if (error) return json({ error: 'Não foi possível reenfileirar a transcrição.' }, 500)
    await wakeWorker()
    return json({ status: 'queued' })
  } catch (error) {
    console.error('Unhandled ata-transcriptions failure', error)
    return json({ error: 'Falha inesperada ao processar a solicitação.' }, 500)
  }
})
