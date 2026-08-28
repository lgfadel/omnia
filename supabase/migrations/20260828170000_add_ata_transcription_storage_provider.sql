-- Áudios novos ficam no Cloudflare R2; linhas históricas continuam no Supabase
-- Storage. O default preserva o comportamento de todos os jobs existentes.
ALTER TABLE public.omnia_ata_transcription_jobs
  ADD COLUMN storage_provider text NOT NULL DEFAULT 'supabase'
  CHECK (storage_provider IN ('supabase', 'r2'));
