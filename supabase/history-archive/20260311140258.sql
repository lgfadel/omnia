-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260311140258
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Add active column to omnia_condominiums table
ALTER TABLE omnia_condominiums
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true NOT NULL;

-- Set all existing condominiums as active by default
UPDATE omnia_condominiums
SET active = true
WHERE active IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN omnia_condominiums.active IS 'Indicates if the condominium is active. Inactive condominiums are filtered out in the application.';
