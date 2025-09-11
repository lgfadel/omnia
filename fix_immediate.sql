-- Script para corrigir imediatamente o problema de foreign key
-- Este script converte os valores de created_by de auth_user_id para omnia_users.id

-- Atualizar omnia_tags
UPDATE omnia_tags 
SET created_by = (
    SELECT ou.id 
    FROM omnia_users ou 
    WHERE ou.auth_user_id = omnia_tags.created_by::uuid
)
WHERE created_by IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM omnia_users ou2 
    WHERE ou2.auth_user_id = omnia_tags.created_by::uuid
  );

-- Atualizar omnia_atas
UPDATE omnia_atas 
SET created_by = (
    SELECT ou.id  
    FROM omnia_users ou 
    WHERE ou.auth_user_id = omnia_atas.created_by::uuid
)
WHERE created_by IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM omnia_users ou2 
    WHERE ou2.auth_user_id = omnia_atas.created_by::uuid
  );

-- Verificar se ainda há registros órfãos
SELECT 'omnia_tags orphaned records:' as table_name, COUNT(*) as count
FROM omnia_tags 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id FROM omnia_users)
UNION ALL
SELECT 'omnia_atas orphaned records:' as table_name, COUNT(*) as count
FROM omnia_atas 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id FROM omnia_users);