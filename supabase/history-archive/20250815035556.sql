-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20250815035556
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Update existing users to have proper roles arrays
UPDATE public.omnia_users 
SET roles = ARRAY['ADMIN', 'SECRETARIO'] 
WHERE email = 'maria@exemplo.com';

UPDATE public.omnia_users 
SET roles = ARRAY['SECRETARIO'] 
WHERE email = 'ana@exemplo.com';

UPDATE public.omnia_users 
SET roles = ARRAY['SECRETARIO'] 
WHERE email = 'carlos@exemplo.com';
