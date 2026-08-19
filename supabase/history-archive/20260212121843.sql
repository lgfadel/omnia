-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260212121843
-- Arquivada antes do repair --status reverted que reconciliou o histórico.


ALTER TABLE omnia_rescisoes
  ALTER COLUMN tags TYPE text[]
  USING tags::text[];
