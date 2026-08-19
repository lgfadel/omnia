-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20251214231926
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'omnia_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.omnia_notifications;
  END IF;
END $$;
