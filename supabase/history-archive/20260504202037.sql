-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260504202037
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-recurring-tasks-daily') THEN
    PERFORM cron.unschedule('generate-recurring-tasks-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'generate-recurring-tasks-daily',
  '5 6 * * *',
  $$SELECT public.generate_omnia_ticket_recurrences(current_date);$$
);
