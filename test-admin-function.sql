-- TESTE ESPECÍFICO DA FUNÇÃO is_current_user_admin()
-- Execute essas queries no Supabase para verificar se a função está funcionando

-- 1. VERIFICAR SE O USUÁRIO ESTÁ AUTENTICADO
SELECT 
  auth.uid() as current_auth_uid,
  auth.role() as current_auth_role;

-- 2. VERIFICAR SE O USUÁRIO EXISTE NA TABELA omnia_users
SELECT 
  id,
  name,
  email,
  roles,
  auth_user_id,
  'ADMIN' = ANY(roles) as has_admin_role
FROM omnia_users 
WHERE auth_user_id = auth.uid();

-- 3. TESTAR A FUNÇÃO is_current_user_admin() DIRETAMENTE
SELECT 
  public.is_current_user_admin() as is_admin_function_result;

-- 4. VERIFICAR SE A FUNÇÃO ESTÁ DEFINIDA CORRETAMENTE
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'is_current_user_admin';

-- 5. TESTAR ACESSO À TABELA omnia_users COM A POLÍTICA RLS
SELECT 
  'Teste de acesso à tabela omnia_users' as test_description,
  COUNT(*) as total_users_visible
FROM omnia_users;

-- 6. VERIFICAR TODAS AS POLÍTICAS RLS ATIVAS NA TABELA omnia_users
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'omnia_users' 
AND schemaname = 'public'
ORDER BY policyname;

-- 7. TESTE MANUAL DA LÓGICA DA FUNÇÃO (sem usar a função)
SELECT 
  CASE 
    WHEN auth.uid() IS NULL THEN 'Usuário não autenticado'
    WHEN NOT EXISTS (SELECT 1 FROM omnia_users WHERE auth_user_id = auth.uid()) THEN 'Usuário não encontrado na tabela omnia_users'
    WHEN EXISTS (SELECT 1 FROM omnia_users WHERE auth_user_id = auth.uid() AND 'ADMIN' = ANY(roles)) THEN 'Usuário é ADMIN'
    ELSE 'Usuário não é ADMIN'
  END as manual_admin_check;

-- 8. VERIFICAR SE HÁ ALGUM ERRO NA EXECUÇÃO DA FUNÇÃO
DO $$
DECLARE
  result boolean;
  error_msg text;
BEGIN
  BEGIN
    SELECT public.is_current_user_admin() INTO result;
    RAISE NOTICE 'Função executada com sucesso. Resultado: %', result;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
      RAISE NOTICE 'Erro na execução da função: %', error_msg;
  END;
END $$;