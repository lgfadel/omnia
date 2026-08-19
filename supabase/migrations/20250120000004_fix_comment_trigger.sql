-- Remove trigger incorreto da tabela omnia_comments
-- O trigger update_ticket_comment_count não deveria estar na tabela omnia_comments
-- pois essa tabela é para comentários de atas (usa ata_id) e não tickets (usa ticket_id)

DROP TRIGGER IF EXISTS update_ticket_comment_count ON public.omnia_comments;
DROP FUNCTION IF EXISTS public.update_ticket_comment_count();

-- O trigger correto já existe na tabela omnia_ticket_comments
-- criado pela migração 20250819215021_4e2af9d1-bcee-44c0-9c39-545083561cae.sql