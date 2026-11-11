-- Source order is explicit; parent audio metadata remains the first file for
-- older clients and jobs created before ordered recordings were introduced.
CREATE TABLE public.omnia_ata_transcription_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.omnia_ata_transcription_jobs(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 3),
  original_filename text NOT NULL CHECK (length(btrim(original_filename)) > 0 AND length(original_filename) <= 255),
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  storage_path text NOT NULL UNIQUE,
  storage_provider text NOT NULL CHECK (storage_provider IN ('r2', 'supabase')),
  upload_id text,
  UNIQUE (job_id, position)
);

ALTER TABLE public.omnia_ata_transcription_files ENABLE ROW LEVEL SECURITY;
-- Resolve visibility through the parent, whose SELECT policy already encodes
-- administrator/secretary/responsible access. Do not duplicate authorization.
CREATE POLICY "Ata transcription team can view source files"
ON public.omnia_ata_transcription_files FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.omnia_ata_transcription_jobs AS job
  WHERE job.id = omnia_ata_transcription_files.job_id
));
REVOKE ALL ON TABLE public.omnia_ata_transcription_files FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.omnia_ata_transcription_files TO authenticated;
GRANT ALL ON TABLE public.omnia_ata_transcription_files TO service_role;

-- Compaction must commit the first file and compatibility pointer together.
-- Lock the parent first, like queue/cancel, and reject stale worker results.
CREATE FUNCTION public.omnia_commit_ata_transcription_file(
  p_file_id uuid,
  p_storage_path text,
  p_size_bytes bigint,
  p_mime_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_job_id uuid;
  source_position integer;
  processing_job public.omnia_ata_transcription_jobs%ROWTYPE;
BEGIN
  SELECT job_id INTO target_job_id FROM public.omnia_ata_transcription_files WHERE id = p_file_id;
  IF target_job_id IS NULL THEN
    RAISE EXCEPTION 'Arquivo não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO processing_job FROM public.omnia_ata_transcription_jobs WHERE id = target_job_id FOR UPDATE;
  IF processing_job.id IS NULL OR processing_job.status <> 'processing' OR NOT processing_job.is_current THEN
    RAISE EXCEPTION 'A transcrição não está mais em processamento.' USING ERRCODE = '55000';
  END IF;
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' OR p_size_bytes IS NULL OR p_size_bytes <= 0
    OR p_mime_type IS NULL OR btrim(p_mime_type) = '' THEN
    RAISE EXCEPTION 'Metadados do áudio inválidos.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.omnia_ata_transcription_files
    SET storage_path = p_storage_path, size_bytes = p_size_bytes, mime_type = p_mime_type
    WHERE id = p_file_id AND job_id = target_job_id
    RETURNING position INTO source_position;
  IF source_position IS NULL THEN
    RAISE EXCEPTION 'Arquivo não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF source_position = 1 THEN
    UPDATE public.omnia_ata_transcription_jobs
      SET storage_path = p_storage_path, size_bytes = p_size_bytes, mime_type = p_mime_type
      WHERE id = target_job_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.omnia_commit_ata_transcription_file(uuid, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omnia_commit_ata_transcription_file(uuid, text, bigint, text) TO service_role;
