-- CORREÇÕES MANUAIS PARA O OMNIA
-- Execute este SQL no Supabase Dashboard > SQL Editor

-- 1. REMOVER "Alterar Senha" do menu (já está no rodapé)
DELETE FROM public.omnia_menu_items 
WHERE name = 'Alterar Senha' AND path = '/change-password';

-- Atualizar comentário da tabela
COMMENT ON TABLE public.omnia_menu_items IS 'Tabela de itens do menu lateral do sistema OMNIA (sem Alterar Senha que fica no rodapé)';

-- 2. CORRIGIR POLÍTICA RLS PARA USUÁRIOS ADMIN (evitar recursão infinita)
-- Remover política problemática
DROP POLICY IF EXISTS "Admins can manage users" ON public.omnia_users;

-- Criar função auxiliar para verificar role admin sem recursão
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_roles text[];
BEGIN
  -- Obter as roles do usuário autenticado atual
  SELECT roles INTO user_roles
  FROM public.omnia_users
  WHERE auth_user_id = auth.uid();
  
  -- Verificar se ADMIN está no array de roles
  RETURN 'ADMIN' = ANY(user_roles);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Criar nova política usando a função
CREATE POLICY "Admins can manage users" ON public.omnia_users
  FOR ALL USING (public.is_current_user_admin());

-- Adicionar comentário explicativo
COMMENT ON POLICY "Admins can manage users" ON public.omnia_users IS 
'Permite usuários com role ADMIN no array roles realizar todas operações na tabela de usuários';

-- 3. POPULAR TABELA omnia_role_permissions
-- Problema: Tabela omnia_role_permissions estava vazia, causando problemas de acesso
-- Solução: Popular com permissões padrão para todos os roles

-- Clear existing data first to avoid conflicts
TRUNCATE TABLE omnia_role_permissions CASCADE;

-- Insert default role permissions based on current OMNIA architecture
DO $$
DECLARE
  dashboard_id UUID;
  atas_id UUID;
  tarefas_id UUID;
  crm_id UUID;
  relatorios_id UUID;
  config_id UUID;
  config_status_id UUID;
  config_ticket_status_id UUID;
  config_crm_status_id UUID;
  config_usuarios_id UUID;
  config_condominiums_id UUID;
  config_administradoras_id UUID;
  config_tags_id UUID;
BEGIN
  -- Get menu item IDs from omnia_menu_items table
  SELECT id INTO dashboard_id FROM omnia_menu_items WHERE path = '/';
  SELECT id INTO atas_id FROM omnia_menu_items WHERE path = '/atas';
  SELECT id INTO tarefas_id FROM omnia_menu_items WHERE path = '/tarefas';
  SELECT id INTO crm_id FROM omnia_menu_items WHERE path = '/crm';
  SELECT id INTO relatorios_id FROM omnia_menu_items WHERE path = '/relatorios';
  SELECT id INTO config_id FROM omnia_menu_items WHERE path = '/config';
  SELECT id INTO config_status_id FROM omnia_menu_items WHERE path = '/config/status';
  SELECT id INTO config_ticket_status_id FROM omnia_menu_items WHERE path = '/config/ticket-status';
  SELECT id INTO config_crm_status_id FROM omnia_menu_items WHERE path = '/config/crm-status';
  SELECT id INTO config_usuarios_id FROM omnia_menu_items WHERE path = '/config/usuarios';
  SELECT id INTO config_condominiums_id FROM omnia_menu_items WHERE path = '/config/condominiums';
  SELECT id INTO config_administradoras_id FROM omnia_menu_items WHERE path = '/config/administradoras';
  SELECT id INTO config_tags_id FROM omnia_menu_items WHERE path = '/config/tags';
  
  -- ADMIN permissions (full access)
  INSERT INTO omnia_role_permissions (role_name, menu_item_id, can_access) VALUES
    ('ADMIN', dashboard_id, true),
    ('ADMIN', atas_id, true),
    ('ADMIN', tarefas_id, true),
    ('ADMIN', crm_id, true),
    ('ADMIN', relatorios_id, true),
    ('ADMIN', config_id, true),
    ('ADMIN', config_status_id, true),
    ('ADMIN', config_ticket_status_id, true),
    ('ADMIN', config_crm_status_id, true),
    ('ADMIN', config_usuarios_id, true),
    ('ADMIN', config_condominiums_id, true),
    ('ADMIN', config_administradoras_id, true),
    ('ADMIN', config_tags_id, true);
  
  -- SECRETARIO permissions (no config access)
  INSERT INTO omnia_role_permissions (role_name, menu_item_id, can_access) VALUES
    ('SECRETARIO', dashboard_id, true),
    ('SECRETARIO', atas_id, true),
    ('SECRETARIO', tarefas_id, true),
    ('SECRETARIO', crm_id, true),
    ('SECRETARIO', relatorios_id, true),
    ('SECRETARIO', config_id, false),
    ('SECRETARIO', config_status_id, false),
    ('SECRETARIO', config_ticket_status_id, false),
    ('SECRETARIO', config_crm_status_id, false),
    ('SECRETARIO', config_usuarios_id, false),
    ('SECRETARIO', config_condominiums_id, false),
    ('SECRETARIO', config_administradoras_id, false),
    ('SECRETARIO', config_tags_id, false);
  
  -- USUARIO permissions (limited access)
  INSERT INTO omnia_role_permissions (role_name, menu_item_id, can_access) VALUES
    ('USUARIO', dashboard_id, true),
    ('USUARIO', atas_id, true),
    ('USUARIO', tarefas_id, true),
    ('USUARIO', crm_id, false),
    ('USUARIO', relatorios_id, false),
    ('USUARIO', config_id, false),
    ('USUARIO', config_status_id, false),
    ('USUARIO', config_ticket_status_id, false),
    ('USUARIO', config_crm_status_id, false),
    ('USUARIO', config_usuarios_id, false),
    ('USUARIO', config_condominiums_id, false),
    ('USUARIO', config_administradoras_id, false),
    ('USUARIO', config_tags_id, false);
    
  -- Log the number of permissions created
  RAISE NOTICE 'Populated omnia_role_permissions with % records', 
    (SELECT COUNT(*) FROM omnia_role_permissions);
END $$;

-- Add comments for documentation
COMMENT ON TABLE omnia_role_permissions IS 'Stores default permissions by role for menu items in the OMNIA system';
COMMENT ON COLUMN omnia_role_permissions.role_name IS 'Role name (ADMIN, SECRETARIO, USUARIO)';
COMMENT ON COLUMN omnia_role_permissions.menu_item_id IS 'Reference to the menu item in omnia_menu_items';
COMMENT ON COLUMN omnia_role_permissions.can_access IS 'Whether users with this role can access this menu item by default';

-- 4. VERIFICAR SE AS CORREÇÕES FORAM APLICADAS
-- Verificar se "Alterar Senha" foi removido do menu
SELECT name, path FROM public.omnia_menu_items WHERE name ILIKE '%senha%';

-- Verificar políticas RLS da tabela omnia_users
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'omnia_users' AND schemaname = 'public';

-- Verificar se as permissões foram populadas
SELECT role_name, COUNT(*) as total_permissions
FROM omnia_role_permissions 
GROUP BY role_name
ORDER BY role_name;