-- Text imports use the same current-source, review and minuta relationships as
-- audio, but never pretend to have a recording or a transcription model.
ALTER TABLE public.omnia_ata_transcription_jobs
  ADD COLUMN replaces_job_id uuid REFERENCES public.omnia_ata_transcription_jobs(id) ON DELETE SET NULL,
  ADD COLUMN source_type text NOT NULL DEFAULT 'audio'
    CHECK (source_type IN ('audio', 'text_import')),
  ALTER COLUMN storage_path DROP NOT NULL,
  ALTER COLUMN storage_provider DROP NOT NULL,
  ALTER COLUMN model DROP NOT NULL;

CREATE INDEX omnia_ata_transcription_jobs_replaces_idx
  ON public.omnia_ata_transcription_jobs (replaces_job_id)
  WHERE replaces_job_id IS NOT NULL;

ALTER TABLE public.omnia_ata_transcription_jobs
  ADD CONSTRAINT omnia_ata_transcription_jobs_source_metadata_check CHECK (
    (source_type = 'audio' AND storage_path IS NOT NULL AND storage_provider IS NOT NULL AND model IS NOT NULL)
    OR
    (source_type = 'text_import' AND status = 'completed'
      AND storage_path IS NULL AND storage_provider IS NULL AND model IS NULL
      AND duration_seconds IS NULL AND size_bytes <= 5242880
      AND mime_type IN ('text/plain', 'text/vtt'))
  );

-- Both audio creation and text import use this transaction. The expected source
-- is supplied by the screen that requested/confirmed replacement; a stale screen
-- cannot overwrite a source another user has just activated.
CREATE OR REPLACE FUNCTION public.omnia_activate_ata_transcription(
  p_job_id uuid,
  p_expected_job_id uuid,
  p_raw_text text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_ata_id uuid;
  next_job public.omnia_ata_transcription_jobs%ROWTYPE;
  previous_job public.omnia_ata_transcription_jobs%ROWTYPE;
BEGIN
  SELECT ata_id INTO target_ata_id FROM public.omnia_ata_transcription_jobs WHERE id = p_job_id;
  IF target_ata_id IS NULL THEN
    RAISE EXCEPTION 'Trabalho não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  -- Consistent lock order: ata first, then its jobs.
  PERFORM id FROM public.omnia_atas WHERE id = target_ata_id FOR UPDATE;
  SELECT * INTO next_job FROM public.omnia_ata_transcription_jobs WHERE id = p_job_id FOR UPDATE;
  IF next_job.is_current THEN
    RAISE EXCEPTION 'Esta transcrição já foi ativada.' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO previous_job FROM public.omnia_ata_transcription_jobs
    WHERE ata_id = target_ata_id AND is_current FOR UPDATE;
  IF previous_job.id IS DISTINCT FROM p_expected_job_id THEN
    RAISE EXCEPTION 'A transcrição atual mudou. Recarregue a ata antes de substituir.' USING ERRCODE = '40001';
  END IF;
  IF previous_job.status IN ('uploading', 'queued', 'processing') THEN
    RAISE EXCEPTION 'Aguarde a transcrição em andamento antes de substituir.' USING ERRCODE = '55000';
  END IF;

  IF next_job.source_type = 'text_import' THEN
    IF p_raw_text IS NULL OR p_raw_text !~ '[^[:space:]]' OR octet_length(p_raw_text) > 5242880 THEN
      RAISE EXCEPTION 'O texto importado está vazio ou ultrapassa o limite de 5 MB.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.omnia_ata_transcriptions (ata_id, job_id, raw_text)
      VALUES (target_ata_id, p_job_id, p_raw_text);
  ELSIF next_job.status <> 'uploading' OR p_raw_text IS NOT NULL THEN
    RAISE EXCEPTION 'Estado inválido para ativar a gravação.' USING ERRCODE = '55000';
  END IF;

  UPDATE public.omnia_ata_transcription_jobs SET is_current = false WHERE id = previous_job.id;
  UPDATE public.omnia_ata_transcription_jobs SET is_current = true, replaces_job_id = previous_job.id WHERE id = p_job_id;
  RETURN jsonb_build_object('previousJob', CASE WHEN previous_job.id IS NULL THEN NULL ELSE
    jsonb_build_object('id', previous_job.id, 'storage_path', previous_job.storage_path, 'storage_provider', previous_job.storage_provider)
  END);
END;
$$;

REVOKE ALL ON FUNCTION public.omnia_activate_ata_transcription(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omnia_activate_ata_transcription(uuid, uuid, text) TO service_role;

-- A failed audio upload restores its exact predecessor, including NULL. Picking
-- by creation time could activate an import still being prepared in another
-- request, or revive a transcript the user had deliberately discarded.
CREATE OR REPLACE FUNCTION public.omnia_cancel_ata_transcription_upload(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_ata_id uuid;
  upload_job public.omnia_ata_transcription_jobs%ROWTYPE;
BEGIN
  SELECT ata_id INTO target_ata_id FROM public.omnia_ata_transcription_jobs WHERE id = p_job_id;
  IF target_ata_id IS NULL THEN
    RAISE EXCEPTION 'Trabalho não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM id FROM public.omnia_atas WHERE id = target_ata_id FOR UPDATE;
  SELECT * INTO upload_job FROM public.omnia_ata_transcription_jobs WHERE id = p_job_id FOR UPDATE;
  IF upload_job.status <> 'uploading' OR upload_job.source_type <> 'audio' THEN
    RAISE EXCEPTION 'Apenas envios pendentes podem ser cancelados.' USING ERRCODE = '55000';
  END IF;
  DELETE FROM public.omnia_ata_transcription_jobs WHERE id = p_job_id;
  IF upload_job.is_current AND upload_job.replaces_job_id IS NOT NULL THEN
    UPDATE public.omnia_ata_transcription_jobs SET is_current = true
      WHERE id = upload_job.replaces_job_id AND ata_id = target_ata_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.omnia_cancel_ata_transcription_upload(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omnia_cancel_ata_transcription_upload(uuid) TO service_role;
