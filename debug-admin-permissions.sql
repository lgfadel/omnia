-- QUERIES PARA DEBUGAR PERMISSÕES DO USUÁRIO ADMIN
-- Execute essas queries no Supabase para verificar o problema

-- 1. VERIFICAR SEU USUÁRIO E ROLES
SELECT 
  id,
  name,
  email,
  roles,
  auth_user_id
FROM omnia_users 
WHERE auth_user_id = auth.uid();

-- 2. VERIFICAR SE EXISTE PERMISSÃO ESPECÍFICA PARA /config/usuarios
SELECT 
  up.user_id,
  up.menu_item_id,
  up.can_access,
  mi.name as menu_name,
  mi.path as menu_path
FROM omnia_user_permissions up
JOIN omnia_menu_items mi ON up.menu_item_id = mi.id
WHERE up.user_id = (
  SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
)
AND mi.path = '/config/usuarios';

-- 3. VERIFICAR PERMISSÕES DE ROLE PARA ADMIN
SELECT 
  rp.role_name,
  rp.menu_item_id,
  rp.can_access,
  mi.name as menu_name,
  mi.path as menu_path
FROM omnia_role_permissions rp
JOIN omnia_menu_items mi ON rp.menu_item_id = mi.id
WHERE rp.role_name = 'ADMIN'
AND mi.path = '/config/usuarios';

-- 4. VERIFICAR SE O MENU ITEM /config/usuarios EXISTE
SELECT 
  id,
  name,
  path,
  is_active,
  parent_id
FROM omnia_menu_items 
WHERE path = '/config/usuarios';

-- 5. TESTAR A FUNÇÃO DE VERIFICAÇÃO DE PERMISSÃO
SELECT check_user_menu_permission(
  (SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()),
  '/config/usuarios'
) as has_permission;

-- 6. VERIFICAR TODAS AS PERMISSÕES DO SEU USUÁRIO
SELECT * FROM get_user_permissions_summary(
  (SELECT id FROM omnia_users WHERE auth_user_id = auth.uid())
);

-- 7. VERIFICAR POLÍTICAS RLS DA TABELA omnia_users
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'omnia_users' 
AND schemaname = 'public';

-- 8. VERIFICAR SE HÁ ALGUMA PERMISSÃO ESPECÍFICA NEGANDO ACESSO
SELECT 
  up.user_id,
  u.name as user_name,
  u.email,
  mi.path,
  mi.name as menu_name,
  up.can_access
FROM omnia_user_permissions up
JOIN omnia_users u ON up.user_id = u.id
JOIN omnia_menu_items mi ON up.menu_item_id = mi.id
WHERE u.auth_user_id = auth.uid()
AND up.can_access = false;