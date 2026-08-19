-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20250823025502
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Adicionar nova opção URGENTE ao enum de prioridade
ALTER TYPE ticket_priority ADD VALUE 'URGENTE' BEFORE 'ALTA';
