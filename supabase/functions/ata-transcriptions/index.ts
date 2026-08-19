import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

const AUDIO_BUCKET = 'ata-transcription-audio'
const MAX_DURATION_SECONDS = 6 * 60 * 60
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024
const ACCEPTED_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'video/mp4', 'audio/webm', 'video/webm',
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

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    // These tables are introduced by this migration, so the Edge runtime does not
    // yet have generated database typings for them.
    // deno-lint-ignore no-explicit-any
    const admin: any = ctx.supabaseAdmin

    async function getAuthorizedAta(ataId: string) {
      const authUserId = ctx.userClaims?.id
      if (!authUserId) return null
      const [{ data: profile, error: profileError }, { data: ata, error: ataError }] = await Promise.all([
        admin.from('omnia_users').select('id, roles').eq('auth_user_id', authUserId).single(),
        admin.from('omnia_atas').select('id, responsible_id').eq('id', ataId).single(),
      ])
      if (profileError || ataError || !profile || !ata || !isTranscriptionTeamMember(profile, ata)) return null
      return { profile: profile as TeamProfile, ata: ata as AtaAccess & { id: string } }
    }

    if (req.method === 'GET') {
      const ataId = new URL(req.url).searchParams.get('ataId')
      if (!ataId) return Response.json({ error: 'ataId é obrigatório.' }, { status: 400 })
      if (!await getAuthorizedAta(ataId)) return Response.json({ error: 'Acesso negado.' }, { status: 403 })

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
        return Response.json({ error: 'Não foi possível carregar a transcrição.' }, { status: 500 })
      }
      return Response.json({ job, transcription })
    }

    if (req.method !== 'POST') return Response.json({ error: 'Método não suportado.' }, { status: 405 })

    const payload = await req.json() as {
      action?: Action
      ataId?: string
      fileName?: string
      mimeType?: string
      sizeBytes?: number
      durationSeconds?: number
      jobId?: string
    }
    if (!isAction(payload.action)) return Response.json({ error: 'Ação inválida.' }, { status: 400 })

    if (payload.action === 'create') {
      if (!payload.ataId || !payload.fileName || !payload.mimeType || typeof payload.sizeBytes !== 'number' || typeof payload.durationSeconds !== 'number' || !Number.isFinite(payload.sizeBytes) || !Number.isFinite(payload.durationSeconds)) {
        return Response.json({ error: 'Dados do áudio incompletos.' }, { status: 400 })
      }
      if (!ACCEPTED_MIME_TYPES.has(payload.mimeType) || payload.sizeBytes! <= 0 || payload.sizeBytes! > MAX_FILE_SIZE_BYTES) {
        return Response.json({ error: 'Arquivo de áudio inválido.' }, { status: 400 })
      }
      if (payload.durationSeconds! <= 0 || payload.durationSeconds! > MAX_DURATION_SECONDS) {
        return Response.json({ error: 'A gravação deve ter até 6 horas.' }, { status: 400 })
      }

      const authorization = await getAuthorizedAta(payload.ataId)
      if (!authorization) return Response.json({ error: 'Acesso negado.' }, { status: 403 })

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
        return Response.json({ error: 'Não foi possível criar o trabalho de transcrição.' }, { status: 500 })
      }

      const { data: upload, error: uploadError } = await admin.storage.from(AUDIO_BUCKET).createSignedUploadUrl(storagePath)
      if (uploadError || !upload) {
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        console.error('Unable to sign transcription upload', uploadError)
        return Response.json({ error: 'Não foi possível preparar o envio do áudio.' }, { status: 500 })
      }

      const { data: previousJob, error: previousJobError } = await admin
        .from('omnia_ata_transcription_jobs')
        .select('id')
        .eq('ata_id', payload.ataId)
        .eq('is_current', true)
        .maybeSingle()
      if (previousJobError) {
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        return Response.json({ error: 'Não foi possível preparar a substituição da transcrição.' }, { status: 500 })
      }

      const { error: replaceError } = await admin
        .from('omnia_ata_transcription_jobs')
        .update({ is_current: false })
        .eq('ata_id', payload.ataId)
        .eq('is_current', true)
      if (replaceError) {
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        return Response.json({ error: 'Não foi possível substituir a transcrição anterior.' }, { status: 500 })
      }

      const { error: activateError } = await admin.from('omnia_ata_transcription_jobs').update({ is_current: true }).eq('id', jobId)
      if (activateError) {
        if (previousJob) await admin.from('omnia_ata_transcription_jobs').update({ is_current: true }).eq('id', previousJob.id)
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId)
        return Response.json({ error: 'Não foi possível ativar o trabalho de transcrição.' }, { status: 500 })
      }

      return Response.json({ jobId, path: upload.path, token: upload.token }, { status: 201 })
    }

    if (!payload.jobId) return Response.json({ error: 'jobId é obrigatório.' }, { status: 400 })
    const { data: job, error: jobError } = await admin
      .from('omnia_ata_transcription_jobs')
      .select('id, ata_id, storage_path, status, attempt_count')
      .eq('id', payload.jobId)
      .maybeSingle()
    if (jobError || !job) return Response.json({ error: 'Trabalho não encontrado.' }, { status: 404 })
    if (!await getAuthorizedAta(job.ata_id)) return Response.json({ error: 'Acesso negado.' }, { status: 403 })

    if (payload.action === 'complete') {
      if (job.status !== 'uploading') return Response.json({ error: 'O áudio já foi enviado.' }, { status: 409 })
      const { error } = await admin.from('omnia_ata_transcription_jobs').update({ status: 'queued', error_message: null }).eq('id', job.id)
      if (error) return Response.json({ error: 'Não foi possível enfileirar a transcrição.' }, { status: 500 })
      return Response.json({ status: 'queued' })
    }

    if (payload.action === 'cancel') {
      if (job.status !== 'uploading') return Response.json({ error: 'Apenas envios pendentes podem ser cancelados.' }, { status: 409 })
      const { data: previousJob, error: previousJobError } = await admin
        .from('omnia_ata_transcription_jobs')
        .select('id')
        .eq('ata_id', job.ata_id)
        .neq('id', job.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (previousJobError) return Response.json({ error: 'Não foi possível cancelar o envio.' }, { status: 500 })

      const { error: removeError } = await admin.storage.from(AUDIO_BUCKET).remove([job.storage_path])
      if (removeError) console.error('Unable to remove cancelled audio', removeError)

      const { error: deleteError } = await admin.from('omnia_ata_transcription_jobs').delete().eq('id', job.id)
      if (deleteError) return Response.json({ error: 'Não foi possível cancelar o envio.' }, { status: 500 })
      if (previousJob) await admin.from('omnia_ata_transcription_jobs').update({ is_current: true }).eq('id', previousJob.id)
      return Response.json({ status: 'cancelled' })
    }

    if (job.status !== 'failed') return Response.json({ error: 'Apenas transcrições com falha podem ser reenviadas.' }, { status: 409 })
    const { error } = await admin.from('omnia_ata_transcription_jobs').update({
      status: 'queued',
      attempt_count: job.attempt_count + 1,
      error_message: null,
      started_at: null,
      heartbeat_at: null,
      completed_at: null,
    }).eq('id', job.id)
    if (error) return Response.json({ error: 'Não foi possível reenfileirar a transcrição.' }, { status: 500 })
    return Response.json({ status: 'queued' })
  }),
}
