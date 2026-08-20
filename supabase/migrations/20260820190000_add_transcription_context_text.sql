-- A convocação da assembleia traz, sem ambiguidade, o nome do condomínio, o do
-- síndico, a data e a pauta. É o melhor contexto possível para a transcrição:
-- ancora exatamente a classe de erro que mais dói numa ata, o nome próprio.
-- Guardamos o texto extraído, não o PDF: é o texto que o modelo consome, e
-- assim nenhum arquivo novo entra no Storage.
ALTER TABLE public.omnia_ata_transcription_jobs
  ADD COLUMN IF NOT EXISTS context_text TEXT;

COMMENT ON COLUMN public.omnia_ata_transcription_jobs.context_text IS
  'Texto extraído da convocação enviada junto da gravação, usado como contexto e fonte de keywords na transcrição.';
