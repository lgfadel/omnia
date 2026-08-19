-- Gravações de assembleia chegam do gravador do iPhone e do Mac como .m4a
-- (audio/x-m4a), de Android como AAC e do WhatsApp como OGG. A lista original
-- aceitava apenas os formatos que um navegador produz, o que rejeitava
-- justamente o caminho mais comum de entrada.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'video/mp4',
  'audio/webm',
  'video/webm',
  'audio/ogg',
  'audio/opus'
]
WHERE id = 'ata-transcription-audio';
