-- Malotes passam a aceitar qualquer tipo de arquivo, não apenas PDF.
-- O limite de 18 MB por anexo (janela segura do Gmail) continua valendo.

ALTER TABLE public.omnia_malote_items
  DROP CONSTRAINT IF EXISTS omnia_malote_items_content_type_check;

ALTER TABLE public.omnia_malote_items
  ALTER COLUMN content_type SET DEFAULT 'application/octet-stream';

ALTER TABLE public.omnia_malote_items
  ADD CONSTRAINT omnia_malote_items_content_type_format_check
  CHECK (content_type ~ '^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+$');

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'malote-attachments';
