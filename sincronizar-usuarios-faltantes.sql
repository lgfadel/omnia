-- =====================================================
-- SCRIPT DE SINCRONIZAÇÃO DE USUÁRIOS FALTANTES
-- =====================================================
-- Criado em: $(date)
-- Objetivo: Sincronizar usuários de auth.users para omnia_users
-- IMPORTANTE: Execute este script após verificar a análise

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

-- 2. INSERÇÃO DOS USUÁRIOS FALTANTES
-- Baseado na análise, temos 4 usuários para sincronizar

-- 2.1. euro@euro.adm.br - Provavelmente ADMIN (domínio euro.adm.br)
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    'Euro Administração' as name, -- Nome inferido do email
    au.email,
    ARRAY['ADMIN']::text[] as roles, -- Role ADMIN por ser domínio administrativo
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'euro@euro.adm.br'
  AND NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id);

-- 2.2. londrina@euro.adm.br - Provavelmente ADMIN regional
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    'Euro Londrina' as name, -- Nome inferido do email
    au.email,
    ARRAY['ADMIN']::text[] as roles, -- Role ADMIN por ser domínio administrativo
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'londrina@euro.adm.br'
  AND NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id);

-- 2.3. joao.fernandes@euro.adm.br - Usuário administrativo
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    'João Fernandes' as name, -- Nome inferido do email
    au.email,
    ARRAY['SECRETARIO']::text[] as roles, -- Role SECRETARIO (pode ser promovido depois)
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'joao.fernandes@euro.adm.br'
  AND NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id);

-- 2.4. fabio.silva@euro.adm.br - Usuário administrativo
INSERT INTO omnia_users (id, name, email, roles, created_at, updated_at)
SELECT 
    au.id,
    'Fábio Silva' as name, -- Nome inferido do email
    au.email,
    ARRAY['SECRETARIO']::text[] as roles, -- Role SECRETARIO (pode ser promovido depois)
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'fabio.silva@euro.adm.br'
  AND NOT EXISTS (SELECT 1 FROM omnia_users ou WHERE ou.id = au.id);

-- 3. VERIFICAÇÃO PÓS-SINCRONIZAÇÃO
SELECT 
    'USUÁRIOS APÓS SINCRONIZAÇÃO' as status,
    ou.id,
    ou.name,
    ou.email,
    ou.roles,
    ou.created_at
FROM omnia_users ou
ORDER BY ou.created_at DESC;

-- 4. CONTAGEM FINAL
SELECT 
    'auth.users' as tabela,
    count(*) as total
FROM auth.users
UNION ALL
SELECT 
    'omnia_users' as tabela,
    count(*) as total
FROM omnia_users;

-- =====================================================
-- CRITÉRIOS DE ROLES APLICADOS:
-- =====================================================
-- 1. Emails com domínio @euro.adm.br genéricos (euro@, londrina@) → ADMIN
-- 2. Emails com nomes pessoais @euro.adm.br → SECRETARIO
-- 3. Todos podem ser ajustados posteriormente via interface
--
-- PRÓXIMOS PASSOS RECOMENDADOS:
-- 1. Execute este script
-- 2. Verifique os usuários criados
-- 3. Ajuste roles conforme necessário via interface
-- 4. Teste login com cada usuário
-- 5. Configure trigger para sincronização automática futura
-- =====================================================