-- =====================================================
-- ANÁLISE DE SINCRONIZAÇÃO ENTRE auth.users E omnia_users
-- =====================================================
-- Criado em: $(date)
-- Objetivo: Identificar discrepâncias entre as tabelas de autenticação

-- 1. USUÁRIOS EM auth.users (6 usuários encontrados)
SELECT 'USUÁRIOS EM auth.users' as tabela, count(*) as total
FROM auth.users;

-- 2. USUÁRIOS EM omnia_users (apenas 2 usuários ADMIN encontrados)
SELECT 'USUÁRIOS EM omnia_users' as tabela, count(*) as total
FROM omnia_users;

-- 3. USUÁRIOS EM auth.users QUE NÃO ESTÃO EM omnia_users
-- Esta é a principal discrepância identificada
SELECT 
    'USUÁRIOS FALTANTES EM omnia_users' as status,
    au.id,
    au.email,
    au.created_at as auth_created_at
FROM auth.users au
LEFT JOIN omnia_users ou ON au.id = ou.id
WHERE ou.id IS NULL
ORDER BY au.created_at DESC;

-- 4. USUÁRIOS EM omnia_users QUE NÃO ESTÃO EM auth.users
-- Verificação reversa (não deveria acontecer)
SELECT 
    'USUÁRIOS ÓRFÃOS EM omnia_users' as status,
    ou.id,
    ou.email,
    ou.name,
    ou.roles
FROM omnia_users ou
LEFT JOIN auth.users au ON ou.id = au.id
WHERE au.id IS NULL;

-- 5. USUÁRIOS SINCRONIZADOS CORRETAMENTE
SELECT 
    'USUÁRIOS SINCRONIZADOS' as status,
    au.id,
    au.email as auth_email,
    ou.email as omnia_email,
    ou.name,
    ou.roles,
    au.created_at as auth_created_at
FROM auth.users au
INNER JOIN omnia_users ou ON au.id = ou.id
ORDER BY au.created_at DESC;

-- =====================================================
-- RESUMO DA ANÁLISE:
-- =====================================================
-- auth.users: 6 usuários
-- - euro@euro.adm.br (b9071d69-db25-4ce7-bd2c-cf26ae8af93e)
-- - teste@loovus.comm.br (765f1b8a-1baf-465d-b192-0f4bf50090ab) ✓ SINCRONIZADO
-- - londrina@euro.adm.br (61718e0c-0081-4a9a-82b3-0612a2575592)
-- - joao.fernandes@euro.adm.br (6cf5a5f8-b748-4f7a-b4d2-87fbf583a649)
-- - fabio.silva@euro.adm.br (aa289518-2960-4f8d-95e1-2ec80f4897ad)
-- - gfadel@gmail.com (85fabf36-e30a-49bc-b1a6-0d7e3ae8f1b0) ✓ SINCRONIZADO
--
-- omnia_users: 2 usuários ADMIN
-- - Gustavo Fadel (gfadel@gmail.com) - ADMIN, SECRETARIO
-- - Teste (teste@loovus.comm.br) - ADMIN
--
-- FALTAM 4 USUÁRIOS em omnia_users:
-- 1. euro@euro.adm.br
-- 2. londrina@euro.adm.br  
-- 3. joao.fernandes@euro.adm.br
-- 4. fabio.silva@euro.adm.br
-- =====================================================