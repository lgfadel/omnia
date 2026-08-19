CREATE TABLE public.omnia_ata_transcription_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id uuid NOT NULL REFERENCES public.omnia_atas(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.omnia_users(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'queued', 'processing', 'completed', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_message text,
  model text NOT NULL DEFAULT 'gpt-4o-transcribe-diarize',
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX omnia_ata_transcription_jobs_one_current_per_ata
  ON public.omnia_ata_transcription_jobs (ata_id)
  WHERE is_current;

CREATE INDEX omnia_ata_transcription_jobs_ata_id_idx
  ON public.omnia_ata_transcription_jobs (ata_id);

CREATE INDEX omnia_ata_transcription_jobs_created_by_idx
  ON public.omnia_ata_transcription_jobs (created_by);

CREATE INDEX IF NOT EXISTS omnia_users_auth_user_id_idx
  ON public.omnia_users (auth_user_id);

CREATE INDEX omnia_ata_transcription_jobs_worker_queue_idx
  ON public.omnia_ata_transcription_jobs (status, created_at)
  WHERE status IN ('queued', 'processing');

CREATE TABLE public.omnia_ata_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id uuid NOT NULL REFERENCES public.omnia_atas(id) ON DELETE CASCADE,
  job_id uuid NOT NULL UNIQUE REFERENCES public.omnia_ata_transcription_jobs(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  revised_text text,
  language text NOT NULL DEFAULT 'pt-BR',
  is_reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX omnia_ata_transcriptions_ata_id_idx
  ON public.omnia_ata_transcriptions (ata_id, created_at DESC);

CREATE TABLE public.omnia_ata_transcription_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcription_id uuid NOT NULL REFERENCES public.omnia_ata_transcriptions(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 0),
  start_ms integer NOT NULL CHECK (start_ms >= 0),
  end_ms integer NOT NULL CHECK (end_ms >= start_ms),
  speaker_label text NOT NULL,
  speaker_name text,
  text text NOT NULL,
  confidence numeric(4, 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transcription_id, sequence)
);

CREATE INDEX omnia_ata_transcription_segments_transcription_idx
  ON public.omnia_ata_transcription_segments (transcription_id, sequence);

ALTER TABLE public.omnia_ata_transcription_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_ata_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_ata_transcription_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ata transcription team can view jobs"
ON public.omnia_ata_transcription_jobs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_users u
    LEFT JOIN public.omnia_atas a ON a.id = omnia_ata_transcription_jobs.ata_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND (
        u.roles && ARRAY['ADMIN', 'SECRETARIO']
        OR a.responsible_id = u.id
      )
  )
);

CREATE POLICY "Ata transcription team can view transcripts"
ON public.omnia_ata_transcriptions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_users u
    LEFT JOIN public.omnia_atas a ON a.id = omnia_ata_transcriptions.ata_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND (
        u.roles && ARRAY['ADMIN', 'SECRETARIO']
        OR a.responsible_id = u.id
      )
  )
);

CREATE POLICY "Ata transcription team can revise transcripts"
ON public.omnia_ata_transcriptions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_users u
    LEFT JOIN public.omnia_atas a ON a.id = omnia_ata_transcriptions.ata_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.omnia_users u
    LEFT JOIN public.omnia_atas a ON a.id = omnia_ata_transcriptions.ata_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
);

CREATE POLICY "Ata transcription team can view segments"
ON public.omnia_ata_transcription_segments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_ata_transcriptions t
    JOIN public.omnia_atas a ON a.id = t.ata_id
    JOIN public.omnia_users u ON u.auth_user_id = (SELECT auth.uid())
    WHERE t.id = omnia_ata_transcription_segments.transcription_id
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
);

CREATE POLICY "Ata transcription team can revise segments"
ON public.omnia_ata_transcription_segments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_ata_transcriptions t
    JOIN public.omnia_atas a ON a.id = t.ata_id
    JOIN public.omnia_users u ON u.auth_user_id = (SELECT auth.uid())
    WHERE t.id = omnia_ata_transcription_segments.transcription_id
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.omnia_ata_transcriptions t
    JOIN public.omnia_atas a ON a.id = t.ata_id
    JOIN public.omnia_users u ON u.auth_user_id = (SELECT auth.uid())
    WHERE t.id = omnia_ata_transcription_segments.transcription_id
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
);

GRANT SELECT ON public.omnia_ata_transcription_jobs TO authenticated;
GRANT SELECT, UPDATE ON public.omnia_ata_transcriptions TO authenticated;
GRANT SELECT, UPDATE ON public.omnia_ata_transcription_segments TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ata-transcription-audio',
  'ata-transcription-audio',
  false,
  1073741824,
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'video/mp4', 'audio/webm', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TRIGGER update_omnia_ata_transcription_jobs_updated_at
  BEFORE UPDATE ON public.omnia_ata_transcription_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_ata_transcription_reviewer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_reviewed IS DISTINCT FROM OLD.is_reviewed
    OR NEW.revised_text IS DISTINCT FROM OLD.revised_text
    OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
    IF NEW.is_reviewed THEN
      SELECT id INTO NEW.reviewed_by
      FROM public.omnia_users
      WHERE auth_user_id = (SELECT auth.uid());
      NEW.reviewed_at = now();
    ELSE
      NEW.reviewed_by = NULL;
      NEW.reviewed_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_omnia_ata_transcription_reviewer
  BEFORE UPDATE ON public.omnia_ata_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_ata_transcription_reviewer();

CREATE TRIGGER update_omnia_ata_transcriptions_updated_at
  BEFORE UPDATE ON public.omnia_ata_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_omnia_ata_transcription_segments_updated_at
  BEFORE UPDATE ON public.omnia_ata_transcription_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
