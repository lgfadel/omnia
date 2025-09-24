-- Script para verificar se a coluna oportunidade_id existe na tabela omnia_tickets
-- Execute este script para confirmar se as migrações foram aplicadas corretamente

-- Verificar se a coluna existe
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'omnia_tickets' 
  AND column_name = 'oportunidade_id';

-- Verificar se a constraint de foreign key existe
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'omnia_tickets'
  AND kcu.column_name = 'oportunidade_id';

-- Verificar se o índice existe
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'omnia_tickets' 
  AND indexname = 'idx_omnia_tickets_oportunidade_id';

-- Testar uma consulta simples para verificar se a coluna é acessível
SELECT COUNT(*) as total_tickets,
       COUNT(oportunidade_id) as tickets_with_oportunidade
FROM omnia_tickets;