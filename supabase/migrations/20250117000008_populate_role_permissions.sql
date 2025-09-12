-- Migration: Populate role permissions table with correct table references
-- Created: 2025-01-17
-- Description: Populates omnia_role_permissions table with default permissions for all roles
-- This fixes the issue where the original migration referenced the wrong table names

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
  change_password_id UUID;
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
  SELECT id INTO change_password_id FROM omnia_menu_items WHERE path = '/change-password';
  
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
    ('ADMIN', config_tags_id, true),
    ('ADMIN', change_password_id, true);
  
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
    ('SECRETARIO', config_tags_id, false),
    ('SECRETARIO', change_password_id, true);
  
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
    ('USUARIO', config_tags_id, false),
    ('USUARIO', change_password_id, true);
    
  -- Log the number of permissions created
  RAISE NOTICE 'Populated omnia_role_permissions with % records', 
    (SELECT COUNT(*) FROM omnia_role_permissions);
END $$;

-- Add comments for documentation
COMMENT ON TABLE omnia_role_permissions IS 'Stores default permissions by role for menu items in the OMNIA system';
COMMENT ON COLUMN omnia_role_permissions.role_name IS 'Role name (ADMIN, SECRETARIO, USUARIO)';
COMMENT ON COLUMN omnia_role_permissions.menu_item_id IS 'Reference to the menu item in omnia_menu_items';
COMMENT ON COLUMN omnia_role_permissions.can_access IS 'Whether users with this role can access this menu item by default';