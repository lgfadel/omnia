-- Os originais ficam privados; a aplicação analisa conjuntos acima de 45 MiB
-- em partes antes da geração para respeitar o limite de entrada da IA.
-- O limite global de Storage também deve permitir ao menos 104857600 bytes.
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'ata-minuta-documents';
