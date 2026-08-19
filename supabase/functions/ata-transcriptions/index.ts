import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// O projeto ainda assina JWT com o segredo legado (HS256, sem "kid"), então
// bibliotecas que verificam token via JWKS rejeitam toda credencial. A validação
// aqui é feita contra o servidor de auth, que é o padrão das demais funções.
// Uma origem única fixa quebra o desenvolvimento local silenciosamente: o browser
// bloqueia no preflight e o erro chega como falha de rede, sem status. A lista vem
// de ALLOWED_ORIGINS (separada por vírgula) e a origem recebida é refletida apenas
// quando consta nela — nunca "*", que dispensaria a checagem.
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('ALLOWED_ORIGIN') ?? 'https://omnia.vercel.app')
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

const AUDIO_BUCKET = 'ata-transcription-audio'
const MAX_DURATION_SECONDS = 6 * 60 * 60
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024
const ACCEPTED_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac',
  'audio/wav', 'audio/x-wav', 'video/mp4', 'audio/webm', 'video/webm',
  'audio/ogg', 'audio/opus',
])

type Action = 'create' | 'complete' | 'retry' | 'cancel'
type TeamProfile = { id: string; roles: string[] | null }
type AtaAccess = { responsible_id: string | null }

function isAction(value: unknown): value is Action {
  return value === 'create' || value === 'complete' || value === 'retry' || value === 'cancel'
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
      return json({ job, transcription })
    }

    if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405)

    const payload = await req.json() as {
      action?: Action
      ataId?: string
      fileName?: string
      mimeType?: string
      sizeBytes?: number
      durationSeconds?: number
      jobId?: string
    }
    if (!isAction(payload.action)) return json({ error: 'Ação inválida.' }, 400)

    if (payload.action === 'create') {
      if (!payload.ataId || !payload.fileName || typeof payload.sizeBytes !== 'number' || typeof payload.durationSeconds !== 'number' || !Number.isFinite(payload.sizeBytes) || !Number.isFinite(payload.durationSeconds)) {
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
      if (payload.durationSeconds <= 0 || payload.durationSeconds > MAX_DURATION_SECONDS) {
        return json({ error: 'A gravação deve ter até 6 horas.' }, 400)
      }

      const authorization = await getAuthorizedAta(payload.ataId)
      if (!authorization) return json({ error: 'Acesso negado.' }, 403)

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
        duration_seconds: Math.ceil(payload.durationSeconds),
        is_current: false,
      })
      if (insertError) {
        console.error('Unable to create transcription job', insertError)
        return json({ error: 'Não foi possível criar o trabalho de transcrição.' }, 500)
      }

      const { data: upload, error: uploadError } = await admin.storage.from(AUDIO_BUCKET).createSignedUploadUrl(storagePath)
      if (uploadError || !upload) {
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        console.error('Unable to sign transcription upload', uploadError)
        return json({ error: 'Não foi possível preparar o envio do áudio.' }, 500)
      }

      const { data: previousJob, error: previousJobError } = await admin
        .from('omnia_ata_transcription_jobs')
        .select('id')
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

      return json({ jobId, path: upload.path, token: upload.token }, 201)
    }

    if (!payload.jobId) return json({ error: 'jobId é obrigatório.' }, 400)
    const { data: job, error: jobError } = await admin
      .from('omnia_ata_transcription_jobs')
      .select('id, ata_id, storage_path, status, attempt_count')
      .eq('id', payload.jobId)
      .maybeSingle()
    if (jobError || !job) return json({ error: 'Trabalho não encontrado.' }, 404)
    if (!await getAuthorizedAta(job.ata_id)) return json({ error: 'Acesso negado.' }, 403)

    if (payload.action === 'complete') {
      if (job.status !== 'uploading') return json({ error: 'O áudio já foi enviado.' }, 409)
      const { error } = await admin.from('omnia_ata_transcription_jobs').update({ status: 'queued', error_message: null }).eq('id', job.id)
      if (error) return json({ error: 'Não foi possível enfileirar a transcrição.' }, 500)
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

      const { error: removeError } = await admin.storage.from(AUDIO_BUCKET).remove([job.storage_path])
      if (removeError) console.error('Unable to remove cancelled audio', removeError)

      const { error: deleteError } = await admin.from('omnia_ata_transcription_jobs').delete().eq('id', job.id)
      if (deleteError) return json({ error: 'Não foi possível cancelar o envio.' }, 500)
      if (previousJob) await admin.from('omnia_ata_transcription_jobs').update({ is_current: true }).eq('id', previousJob.id)
      return json({ status: 'cancelled' })
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
    return json({ status: 'queued' })
  } catch (error) {
    console.error('Unhandled ata-transcriptions failure', error)
    return json({ error: 'Falha inesperada ao processar a solicitação.' }, 500)
  }
})
