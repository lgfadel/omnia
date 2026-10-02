-- Os PDFs de apoio ficam abaixo do teto agregado de 50 MB da Responses API.
-- A aplicação limita também a soma dos documentos da ata a 45 MiB.
-- O limite global de Storage do ambiente deve permitir pelo menos 47.185.920 bytes.
UPDATE storage.buckets
SET file_size_limit = 47185920
WHERE id = 'ata-minuta-documents';
