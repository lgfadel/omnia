-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20250817095206
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Add responsible_id column to omnia_atas table
ALTER TABLE public.omnia_atas 
ADD COLUMN responsible_id uuid REFERENCES public.omnia_users(id);

-- Add index for performance
CREATE INDEX idx_omnia_atas_responsible_id ON public.omnia_atas(responsible_id);
