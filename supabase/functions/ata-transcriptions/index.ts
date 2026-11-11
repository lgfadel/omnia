import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { abortR2MultipartUpload, completeR2MultipartUpload, createR2DownloadUrl, deleteR2Object, r2ObjectSize, startR2MultipartUpload } from './r2.ts'
import { parseTranscriptionText } from './importText.ts'

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

// Precisa bater com STALE_LEASE_MINUTES do worker: o worker publica sinal de
// vida a cada minuto, e cinco sem nenhum significam que ele morreu.
const STALE_LEASE_MS = 5 * 60 * 1000

const ACCEPTED_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac',
  'audio/wav', 'audio/x-wav', 'video/mp4', 'audio/webm', 'video/webm',
  'audio/ogg', 'audio/opus',
])

type Action = 'create' | 'import' | 'complete' | 'retry' | 'cancel' | 'discard' | 'audio' | 'wake'
type UploadInput = { fileName: string; mimeType: string; sizeBytes: number; durationSeconds?: number | null }
type CompletedUpload = { fileId: string; uploadId: string; parts: Array<{ partNumber: number; etag: string }> }
type AudioSource = { id?: string; storage_path: string | null; storage_provider: string | null; upload_id?: string | null }
type SourceFile = AudioSource & { id: string; job_id: string; position: number; size_bytes: number }
type TeamProfile = { id: string; roles: string[] | null }
type AtaAccess = { responsible_id: string | null }

function isAction(value: unknown): value is Action {
  return value === 'create' || value === 'import' || value === 'complete' || value === 'retry' || value === 'cancel' || value === 'discard' || value === 'audio' || value === 'wake'
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
//
// O que não pode é o atraso ser silencioso. Quando o Railway tira o serviço do ar
// (trial expirado, crédito do mês esgotado), o endereço passa a responder 404
// "Application not found" e o job fica em "Na fila" para sempre, sem erro na
// tela. Por isso a função devolve se alcançou o worker, e o painel avisa.
//
// Só conta como fora do ar o que é definitivo: resposta de erro ou falha de rede.
// Estourar o tempo é o caso normal de um serviço que o Railway está acordando, e
// alarmar nele assustaria quem acabou de enviar uma gravação saudável.
const WAKE_TIMEOUT_MS = 20_000

async function wakeWorker(): Promise<boolean> {
  const url = Deno.env.get('TRANSCRIPTION_WORKER_URL')
  const secret = Deno.env.get('WORKER_WAKE_SECRET')
  if (!url || !secret) {
    console.error('Worker wake is not configured; the job will wait for the next wake')
    return false
  }
  try {
    const response = await fetch(`${url}/wake`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
    })
    if (!response.ok) console.error('Worker wake returned', response.status)
    return response.ok
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') return true
    console.error('Unable to wake the transcription worker', error)
    return false
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

  async function getFiles(jobId: string): Promise<SourceFile[]> {
    const { data, error } = await admin.from('omnia_ata_transcription_files').select('*').eq('job_id', jobId).order('position')
    if (error) throw error
    return data ?? []
  }

  async function removeSources(sources: AudioSource[]) {
    const aborted = new Set<string>()
    const deleted = new Set<string>()
    for (const source of sources) {
      if (!source.storage_path) continue
      const key = `${source.storage_provider}:${source.storage_path}`
      if (source.storage_provider === 'r2' && source.upload_id && !aborted.has(`${key}:${source.upload_id}`)) {
        aborted.add(`${key}:${source.upload_id}`)
        await abortR2MultipartUpload(source.storage_path, source.upload_id).catch((error) => console.error('Unable to abort audio upload', error))
      }
      if (deleted.has(key)) continue
      deleted.add(key)
      if (source.storage_provider === 'r2') {
        await deleteR2Object(source.storage_path).catch((error) => console.error('Unable to purge R2 audio', error))
      } else {
        const { error } = await admin.storage.from(AUDIO_BUCKET).remove([source.storage_path])
        if (error) console.error('Unable to purge audio', error)
      }
    }
  }

  async function purgeAudio(source: AudioSource | null) {
    if (!source) return
    const files = source.id ? await getFiles(source.id) : []
    await removeSources(files.length ? files : [source])
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
      // Rede de segurança para quem ler por aqui. O painel não usa este endpoint —
      // lê as tabelas direto e insiste pela ação `wake` enquanto o job espera.
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
      files?: UploadInput[] | CompletedUpload[]
      fileId?: string
      parts?: Array<{ partNumber: number; etag: string }>
      contextText?: string
      content?: string
      expectedJobId?: string | null
    }
    if (!isAction(payload.action)) return json({ error: 'Ação inválida.' }, 400)

    if (payload.action === 'import') {
      if (!payload.ataId || typeof payload.fileName !== 'string' || !payload.fileName.trim() || payload.fileName.length > 255 || typeof payload.content !== 'string') {
        return json({ error: 'Informe a ata e um arquivo TXT ou VTT para importar.' }, 400)
      }
      const authorization = await getAuthorizedAta(payload.ataId)
      if (!authorization) return json({ error: 'Acesso negado.' }, 403)
      let text: string
      try {
        text = parseTranscriptionText(payload.fileName, payload.content)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'O arquivo não contém uma transcrição válida.' }, 400)
      }
      const jobId = crypto.randomUUID()
      const { error: insertError } = await admin.from('omnia_ata_transcription_jobs').insert({
        id: jobId,
        ata_id: payload.ataId,
        created_by: authorization.profile.id,
        source_type: 'text_import',
        original_filename: payload.fileName,
        mime_type: /\.vtt$/i.test(payload.fileName) ? 'text/vtt' : 'text/plain',
        size_bytes: new TextEncoder().encode(payload.content).byteLength,
        storage_path: null,
        storage_provider: null,
        model: null,
        status: 'completed',
        completed_at: new Date().toISOString(),
        context_text: typeof payload.contextText === 'string' ? payload.contextText.slice(0, MAX_CONTEXT_CHARS).trim() || null : null,
        is_current: false,
      })
      if (insertError) return json({ error: 'Não foi possível preparar a importação da transcrição.' }, 500)
      const { data: activated, error: activateError } = await admin.rpc('omnia_activate_ata_transcription', {
        p_job_id: jobId,
        p_expected_job_id: payload.expectedJobId ?? null,
        p_raw_text: text,
      })
      if (activateError) {
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId).eq('is_current', false)
        const conflict = ['40001', '55000', '23505'].includes(activateError.code)
        return json({ error: conflict ? 'A transcrição atual mudou ou está em andamento. Recarregue a ata antes de substituir.' : 'Não foi possível importar a transcrição. O texto anterior foi preservado.' }, conflict ? 409 : 500)
      }
      await purgeAudio(activated?.previousJob)
      return json({ jobId }, 201)
    }

    if (payload.action === 'create') {
      const newContract = Object.prototype.hasOwnProperty.call(payload, 'files')
      const inputFiles = (newContract ? payload.files : [payload]) as UploadInput[]
      if (!payload.ataId || !Array.isArray(inputFiles) || inputFiles.length < 1 || inputFiles.length > 3) {
        return json({ error: 'Envie entre 1 e 3 arquivos de áudio.' }, 400)
      }
      for (const file of inputFiles) {
        if (!file || typeof file.fileName !== 'string' || !file.fileName.trim() || file.fileName.length > 255 ||
          !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes <= 0 ||
          (file.durationSeconds != null && (typeof file.durationSeconds !== 'number' || !Number.isFinite(file.durationSeconds) || file.durationSeconds <= 0))) {
          return json({ error: 'Dados do áudio incompletos ou inválidos.' }, 400)
        }
        if (!ACCEPTED_MIME_TYPES.has(file.mimeType)) {
          return json({ error: `Formato de áudio não suportado: "${file.mimeType || 'desconhecido'}". Envie MP3, M4A, AAC, WAV, MP4, WebM ou OGG.` }, 400)
        }
      }
      if (inputFiles.reduce((total, file) => total + file.sizeBytes, 0) > MAX_FILE_SIZE_BYTES) {
        return json({ error: 'Os arquivos excedem o limite total de 1 GB.' }, 400)
      }
      if (inputFiles.reduce((total, file) => total + (file.durationSeconds == null ? 0 : Math.ceil(file.durationSeconds)), 0) > MAX_DURATION_SECONDS) {
        return json({ error: 'A gravação deve ter até 6 horas no total.' }, 400)
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
      const sourceFiles = inputFiles.map((file, index) => {
        const id = crypto.randomUUID()
        return {
          id, job_id: jobId, position: index + 1,
          storage_path: `${payload.ataId}/${jobId}/${id}/${sanitizeFileName(file.fileName)}`,
          original_filename: file.fileName, mime_type: file.mimeType, size_bytes: file.sizeBytes,
          duration_seconds: file.durationSeconds == null ? null : Math.ceil(file.durationSeconds),
          storage_provider: 'r2', upload_id: null as string | null,
        }
      })
      const first = sourceFiles[0]
      const { error: insertError } = await admin.from('omnia_ata_transcription_jobs').insert({
        id: jobId, ata_id: payload.ataId, created_by: authorization.profile.id,
        storage_path: first.storage_path, original_filename: first.original_filename,
        mime_type: first.mime_type, size_bytes: first.size_bytes, duration_seconds: first.duration_seconds,
        context_text: contextText, storage_provider: 'r2', is_current: false,
      })
      if (insertError) {
        console.error('Unable to create transcription job', insertError)
        return json({ error: 'Não foi possível criar o trabalho de transcrição.' }, 500)
      }
      const uploads: Array<{ fileId: string; uploadId: string; partSize: number; parts: Array<{ partNumber: number; url: string }> }> = []
      try {
        for (const file of sourceFiles) {
          const upload = await startR2MultipartUpload(file.storage_path, file.mime_type, file.size_bytes)
          file.upload_id = upload.uploadId
          uploads.push({ fileId: file.id, ...upload, parts: upload.parts.map((url, index) => ({ partNumber: index + 1, url })) })
        }
        const { error } = await admin.from('omnia_ata_transcription_files').insert(sourceFiles)
        if (error) throw error
      } catch (uploadError) {
        await removeSources(sourceFiles)
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId).eq('is_current', false)
        console.error('Unable to prepare transcription uploads', uploadError)
        return json({ error: 'Não foi possível preparar o envio dos áudios.' }, 500)
      }

      const { error: activateError } = await admin.rpc('omnia_activate_ata_transcription', {
        p_job_id: jobId, p_expected_job_id: payload.expectedJobId ?? null, p_raw_text: null,
      })
      if (activateError) {
        await removeSources(sourceFiles)
        await admin.from('omnia_ata_transcription_jobs').delete().eq('id', jobId).eq('is_current', false)
        const conflict = ['40001', '55000', '23505'].includes(activateError.code)
        return json({ error: conflict ? 'A transcrição atual mudou ou está em andamento. Recarregue a ata antes de substituir.' : 'Não foi possível ativar o trabalho de transcrição.' }, conflict ? 409 : 500)
      }
      const { fileId: _firstFileId, ...legacyUpload } = uploads[0]
      return json({ jobId, ...legacyUpload, ...(newContract ? { uploads } : {}) }, 201)
    }

    if (!payload.jobId) return json({ error: 'jobId é obrigatório.' }, 400)
    const { data: job, error: jobError } = await admin
      .from('omnia_ata_transcription_jobs')
      .select('id, ata_id, source_type, replaces_job_id, storage_path, storage_provider, size_bytes, status, is_current, attempt_count, heartbeat_at')
      .eq('id', payload.jobId)
      .maybeSingle()
    if (jobError || !job) return json({ error: 'Trabalho não encontrado.' }, 404)
    if (!await getAuthorizedAta(job.ata_id)) return json({ error: 'Acesso negado.' }, 403)

    if (job.source_type === 'text_import' && payload.action !== 'audio' && payload.action !== 'discard') {
      return json({ error: 'Esta transcrição foi importada e não possui áudio para processar.' }, 409)
    }

    if (payload.action === 'complete') {
      const sourceFiles = await getFiles(job.id)
      const hasFiles = Object.prototype.hasOwnProperty.call(payload, 'files')
      const completedFiles = (hasFiles ? payload.files : sourceFiles.length <= 1
        ? [{ fileId: sourceFiles[0]?.id ?? job.id, uploadId: payload.uploadId, parts: payload.parts }] : null) as CompletedUpload[] | null
      const expectedFiles = sourceFiles.length ? sourceFiles : [{ ...job, id: job.id, upload_id: null }]
      if (!Array.isArray(completedFiles) || completedFiles.length !== expectedFiles.length ||
        new Set(completedFiles.map(file => file?.fileId)).size !== expectedFiles.length ||
        completedFiles.some(file => !file || typeof file.uploadId !== 'string' || !file.uploadId ||
          !expectedFiles.some(expected => expected.id === file.fileId && (!expected.upload_id || expected.upload_id === file.uploadId)) ||
          !Array.isArray(file.parts) || !file.parts.length ||
          file.parts.some(part => !part || !Number.isInteger(part.partNumber) || part.partNumber < 1 || typeof part.etag !== 'string' || !part.etag) ||
          new Set(file.parts.map(part => part.partNumber)).size !== file.parts.length)) {
        return json({ error: 'Arquivos ou partes do envio inválidos.' }, 400)
      }
      // An acknowledged queue transition remains successful on transport retries,
      // even after processing/compaction has changed the original storage paths.
      if (['queued', 'processing', 'completed'].includes(job.status) && job.is_current) {
        return json({ status: 'queued', workerAvailable: job.status === 'completed' ? true : await wakeWorker() })
      }
      if (job.status !== 'uploading') return json({ error: 'O áudio já foi enviado.' }, 409)
      try {
        for (const file of expectedFiles) {
          const completed = completedFiles.find(item => item.fileId === file.id)!
          let size: number | null = null
          try { size = await r2ObjectSize(file.storage_path) } catch { /* No object yet; finish its multipart upload. */ }
          if (size !== Number(file.size_bytes)) {
            try {
              await completeR2MultipartUpload(file.storage_path, completed.uploadId, completed.parts)
            } catch (error) {
              // Another completion can consume this upload ID after both
              // requests saw a missing object. Its exact object is success.
              if (await r2ObjectSize(file.storage_path).catch(() => null) !== Number(file.size_bytes)) throw error
            }
            if (await r2ObjectSize(file.storage_path) !== Number(file.size_bytes)) throw new Error('R2 object size does not match source file.')
          }
        }
      } catch (error) {
        console.error('Unable to complete R2 transcription upload', error)
        return json({ error: 'Não foi possível concluir o envio dos áudios.' }, 500)
      }
      const { data: queuedJob, error } = await admin.from('omnia_ata_transcription_jobs')
        .update({ status: 'queued', error_message: null })
        .eq('id', job.id).eq('status', 'uploading').eq('is_current', true)
        .select('id').maybeSingle()
      if (error && error.code !== 'PGRST116') return json({ error: 'Não foi possível enfileirar a transcrição.' }, 500)
      if (!queuedJob) {
        // Another complete request may have queued the same verified objects
        // while this one was in R2. A cancelled/deleted job must still lose.
        const { data: currentJob, error: currentError } = await admin.from('omnia_ata_transcription_jobs')
          .select('status, is_current').eq('id', job.id).maybeSingle()
        if (!currentError && currentJob?.is_current && ['queued', 'processing', 'completed'].includes(currentJob.status)) {
          return json({ status: 'queued', workerAvailable: currentJob.status === 'completed' ? true : await wakeWorker() })
        }
        return json({ error: 'Este envio foi cancelado ou já foi concluído. Recarregue a ata.' }, 409)
      }
      // Keep the previous recording until upload succeeds, so cancellation can
      // restore both its text and its playable audio.
      if (job.replaces_job_id) {
        const { data: previousJob } = await admin.from('omnia_ata_transcription_jobs')
          .select('id, storage_path, storage_provider').eq('id', job.replaces_job_id).maybeSingle()
        await purgeAudio(previousJob)
      }
      return json({ status: 'queued', workerAvailable: await wakeWorker() })
    }

    if (payload.action === 'wake') {
      // Substitui a rede de segurança do GET, que o painel nunca chamou: enquanto
      // o job espera na fila, o painel insiste por aqui e fica sabendo se há
      // alguém do outro lado para processá-lo.
      //
      // Um job em processamento sem sinal de vida perdeu o worker — o Railway
      // encerra o container sem aviso. Acordar um worker novo é o que o devolve
      // à fila (ver reclaimStaleJobs no worker), então o painel insiste também aí.
      const stalled = job.status === 'processing' &&
        (!job.heartbeat_at || Date.parse(job.heartbeat_at) < Date.now() - STALE_LEASE_MS)
      if (job.status !== 'queued' && !stalled) return json({ workerAvailable: true, stalled: false })
      return json({ workerAvailable: await wakeWorker(), stalled })
    }

    if (payload.action === 'cancel') {
      if (job.status !== 'uploading') return json({ error: 'Apenas envios pendentes podem ser cancelados.' }, 409)
      // The cancellation RPC deletes the parent and cascades files; capture
      // all paths/upload IDs first, but touch storage only after winning it.
      const sourceFiles = await getFiles(job.id)
      const { error: cancelError } = await admin.rpc('omnia_cancel_ata_transcription_upload', { p_job_id: job.id })
      if (cancelError) return json({ error: 'Não foi possível cancelar o envio. Recarregue a ata para conferir o estado atual.' }, 409)
      await removeSources([...sourceFiles, { ...job, upload_id: sourceFiles.length ? null : payload.uploadId }])

      return json({ status: 'cancelled' })
    }

    if (payload.action === 'audio') {
      const sourceFiles = await getFiles(job.id)
      const source = payload.fileId ? sourceFiles.find(file => file.id === payload.fileId) : sourceFiles[0] ?? job
      if (!source) return json({ error: 'Arquivo não encontrado nesta transcrição.' }, 404)
      if (job.source_type === 'text_import' || !source.storage_path || job.status === 'uploading') return json({ url: null })
      if (source.storage_provider === 'r2') {
        try { return json({ url: await createR2DownloadUrl(source.storage_path, AUDIO_URL_TTL_SECONDS) }) }
        catch (error) { console.error('Unable to sign R2 transcription audio', error); return json({ url: null }) }
      }
      const { data, error } = await admin.storage.from(AUDIO_BUCKET).createSignedUrl(source.storage_path, AUDIO_URL_TTL_SECONDS)
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
      if (['uploading', 'queued', 'processing'].includes(job.status)) return json({ error: 'Esta transcrição ainda está em andamento.' }, 409)
      const { error } = await admin
        .from('omnia_ata_transcription_jobs')
        .update({ is_current: false })
        .eq('id', job.id)
      if (error) {
        console.error('Unable to discard transcription', error)
        return json({ error: 'Não foi possível descartar a transcrição.' }, 500)
      }
      await purgeAudio(job)
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
    return json({ status: 'queued', workerAvailable: await wakeWorker() })
  } catch (error) {
    console.error('Unhandled ata-transcriptions failure', error)
    return json({ error: 'Falha inesperada ao processar a solicitação.' }, 500)
  }
})
