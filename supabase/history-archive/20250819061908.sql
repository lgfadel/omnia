-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20250819061908
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Configurar realtime para a tabela omnia_atas
ALTER TABLE public.omnia_atas REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.omnia_atas;
