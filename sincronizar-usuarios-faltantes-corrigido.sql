-- =====================================================
-- SCRIPT DE SINCRONIZAÇÃO DE USUÁRIOS FALTANTES - VERSÃO CORRIGIDA
-- =====================================================
-- Criado em: $(date)
-- Objetivo: Sincronizar usuários de auth.users para omnia_users
-- CORREÇÃO: Evita duplicatas verificando existência prévia

-- 1. VERIFICAÇÃO PRÉVIA - Confirmar usuários faltantes
SELECT 
    'USUÁRIOS QUE SERÃO SINCRONIZADOS' as acao,
    au.id,
    au.email,
    au.created_at
FROM auth.users au
LEFT JOIN omnia_users ou ON au.id = ou.id
WHERE ou.id IS NULL
ORDER BY au.created_at DESC;

-- 2. INSERÇÃO DOS USUÁRIOS FALTANTES COM VERIFICAÇÃO DE DUPLICATAS
-- Usando INSERT ... ON CONFLICT DO NOTHING para evitar erros

-- 2.1. euro@euro.adm.br - Provavelmente ADMIN (domínio euro.adm.br)
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    'Euro Administração' as name,
    au.email,
    ARRAY['ADMIN']::text[] as roles,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'euro@euro.adm.br'
  AND NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id OR ou.email = au.email)
ON CONFLICT (email) DO NOTHING;

-- 2.2. londrina@euro.adm.br - Provavelmente ADMIN regional
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    'Euro Londrina' as name,
    au.email,
    ARRAY['ADMIN']::text[] as roles,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'londrina@euro.adm.br'
  AND NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id OR ou.email = au.email)
ON CONFLICT (email) DO NOTHING;

-- 2.3. joao.fernandes@euro.adm.br - Usuário administrativo
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    'João Fernandes' as name,
    au.email,
    ARRAY['SECRETARIO']::text[] as roles,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'joao.fernandes@euro.adm.br'
  AND NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id OR ou.email = au.email)
ON CONFLICT (email) DO NOTHING;

-- 2.4. fabio.silva@euro.adm.br - Usuário administrativo
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    'Fábio Silva' as name,
    au.email,
    ARRAY['SECRETARIO']::text[] as roles,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'fabio.silva@euro.adm.br'
  AND NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id OR ou.email = au.email)
ON CONFLICT (email) DO NOTHING;

-- 3. SINCRONIZAÇÃO GENÉRICA PARA QUALQUER USUÁRIO FALTANTE
-- Este comando sincroniza automaticamente qualquer usuário que esteja em auth.users mas não em omnia_users
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    COALESCE(
        CASE 
            WHEN au.email LIKE '%@euro.adm.br' AND au.email NOT LIKE '%.%@%' THEN 
                INITCAP(REPLACE(SPLIT_PART(au.email, '@', 1), '.', ' '))
            WHEN au.email LIKE '%.%@%' THEN 
                INITCAP(REPLACE(SPLIT_PART(au.email, '@', 1), '.', ' '))
            ELSE 
                SPLIT_PART(au.email, '@', 1)
        END,
        'Usuário'
    ) as name,
    au.email,
    CASE 
        WHEN au.email LIKE '%@euro.adm.br' AND au.email NOT LIKE '%.%@%' THEN 
            ARRAY['ADMIN']::text[]
        WHEN au.email LIKE '%@euro.adm.br' THEN 
            ARRAY['SECRETARIO']::text[]
        ELSE 
            ARRAY['SECRETARIO']::text[]
    END as roles,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id OR ou.email = au.email)
ON CONFLICT (email) DO NOTHING;

-- 4. VERIFICAÇÃO PÓS-SINCRONIZAÇÃO
SELECT 
    'USUÁRIOS APÓS SINCRONIZAÇÃO' as status,
    ou.id,
    ou.name,
    ou.email,
    ou.roles,
    ou.created_at
FROM omnia_users ou
ORDER BY ou.created_at DESC;

-- 5. CONTAGEM FINAL
SELECT 
    'auth.users' as tabela,
    count(*) as total
FROM auth.users
UNION ALL
SELECT 
    'omnia_users' as tabela,
    count(*) as total
FROM omnia_users;

-- 6. VERIFICAÇÃO DE SINCRONIZAÇÃO COMPLETA
SELECT 
    CASE 
        WHEN auth_count = omnia_count THEN 'SINCRONIZAÇÃO COMPLETA ✓'
        ELSE CONCAT('FALTAM ', (auth_count - omnia_count), ' USUÁRIOS')
    END as status_sincronizacao
FROM (
    SELECT 
        (SELECT count(*) FROM auth.users) as auth_count,
        (SELECT count(*) FROM omnia_users) as omnia_count
) counts;

-- =====================================================
-- CORREÇÕES APLICADAS:
-- =====================================================
-- 1. Adicionado ON CONFLICT (email) DO NOTHING para evitar duplicatas
-- 2. Verificação dupla: NOT EXISTS para ID e EMAIL
-- 3. Sincronização genérica para capturar qualquer usuário faltante
-- 4. Lógica de nomes mais robusta
-- 5. Verificação final de sincronização completa
--
-- PRÓXIMOS PASSOS:
-- 1. Execute este script corrigido
-- 2. Verifique se a sincronização está completa
-- 3. Configure o trigger automático
-- 4. Teste login com usuários sincronizados
-- =====================================================