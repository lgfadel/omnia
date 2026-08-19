-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260428143105
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

ALTER TABLE public.omnia_condominiums
  ADD COLUMN analista_financeiro TEXT;

COMMENT ON COLUMN public.omnia_condominiums.analista_financeiro IS 'Nome do analista financeiro responsável pelo condomínio';
