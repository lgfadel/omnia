-- Sem contador de blocos, a interface só conseguia mostrar "Processando" por
-- vários minutos seguidos, o que é indistinguível de um processo travado.
ALTER TABLE public.omnia_ata_transcription_jobs
  ADD COLUMN total_chunks integer CHECK (total_chunks IS NULL OR total_chunks > 0),
  ADD COLUMN processed_chunks integer NOT NULL DEFAULT 0 CHECK (processed_chunks >= 0),
  ADD COLUMN stage text CHECK (stage IS NULL OR stage IN ('downloading', 'splitting', 'transcribing', 'saving'));

COMMENT ON COLUMN public.omnia_ata_transcription_jobs.total_chunks IS
  'Blocos gerados pelo FFmpeg; nulo até o áudio ser fatiado.';
COMMENT ON COLUMN public.omnia_ata_transcription_jobs.processed_chunks IS
  'Blocos já transcritos, usado para o percentual exibido durante o processamento.';
