-- Script para adicionar campo "responsavel_negociacao" à tabela omnia_crm_leads
-- Este script deve ser executado manualmente no Supabase

-- 1. Adicionar a coluna responsavel_negociacao à tabela omnia_crm_leads
ALTER TABLE omnia_crm_leads 
ADD COLUMN responsavel_negociacao UUID;

-- 2. Adicionar constraint de foreign key referenciando a tabela omnia_users
ALTER TABLE omnia_crm_leads 
ADD CONSTRAINT fk_responsavel_negociacao 
FOREIGN KEY (responsavel_negociacao) 
REFERENCES omnia_users(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- 3. Adicionar índice para melhorar performance das consultas
CREATE INDEX idx_omnia_crm_leads_responsavel_negociacao 
ON omnia_crm_leads(responsavel_negociacao);

-- 4. Adicionar comentário para documentar o campo
COMMENT ON COLUMN omnia_crm_leads.responsavel_negociacao 
IS 'ID do usuário responsável pela negociação do lead';

-- 5. Verificar se a coluna foi criada corretamente
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'omnia_crm_leads' 
-- AND column_name = 'responsavel_negociacao';

-- 6. Verificar se a constraint foi criada corretamente
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'omnia_crm_leads' 
-- AND constraint_name = 'fk_responsavel_negociacao';

-- INSTRUÇÕES PARA EXECUÇÃO:
-- 1. Acesse o painel do Supabase
-- 2. Vá para SQL Editor
-- 3. Execute este script linha por linha ou todo de uma vez
-- 4. Verifique se não há erros na execução
-- 5. Teste a funcionalidade no frontend após a execução