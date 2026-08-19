-- Teste controlado em 19/08/2026, mesmo arquivo de áudio e mesmos bytes, variando
-- apenas o modelo: gpt-4o-transcribe-diarize devolveu 6,3% dos segmentos em inglês
-- e frases inventadas ("The board is flat" repetido quatro vezes), enquanto
-- whisper-1 devolveu 0% de inglês e português coerente, 9x mais rápido e pelo
-- mesmo preço. O whisper não separa falantes, então o rótulo automático deixa de
-- existir e o nome passa a ser atribuído por quem revisa.
ALTER TABLE public.omnia_ata_transcription_segments
  ALTER COLUMN speaker_label DROP NOT NULL;

ALTER TABLE public.omnia_ata_transcription_jobs
  ALTER COLUMN model SET DEFAULT 'whisper-1';

COMMENT ON COLUMN public.omnia_ata_transcription_segments.speaker_label IS
  'Rótulo automático do falante. Nulo com whisper-1, que não faz diarização.';
