-- A listagem de atas assina os jobs para ligar/desligar o selo de
-- "transcrição em curso" sem recarregar a página.
ALTER TABLE public.omnia_ata_transcription_jobs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'omnia_ata_transcription_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.omnia_ata_transcription_jobs;
  END IF;
END $$;
