-- Migration: Create role_permissions table for user permission system
-- Created: 2025-01-17
-- Description: Creates the role_permissions table to store default permissions by role

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL CHECK (role_name IN ('ADMIN', 'SECRETARIO', 'USUARIO')),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  can_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique combination of role and menu item
  UNIQUE(role_name, menu_item_id)
);

-- Create indexes for better performance
CREATE INDEX idx_role_permissions_role_name ON role_permissions(role_name);
CREATE INDEX idx_role_permissions_menu_item_id ON role_permissions(menu_item_id);
CREATE INDEX idx_role_permissions_can_access ON role_permissions(can_access);

-- Enable RLS (Row Level Security)
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- All authenticated users can read role permissions
CREATE POLICY "Users can view role permissions" ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage role permissions
CREATE POLICY "Admins can manage role permissions" ON role_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_role_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_role_permissions_updated_at();

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
  -- Get menu item IDs
  SELECT id INTO dashboard_id FROM menu_items WHERE path = '/';
  SELECT id INTO atas_id FROM menu_items WHERE path = '/atas';
  SELECT id INTO tarefas_id FROM menu_items WHERE path = '/tarefas';
  SELECT id INTO crm_id FROM menu_items WHERE path = '/crm';
  SELECT id INTO relatorios_id FROM menu_items WHERE path = '/relatorios';
  SELECT id INTO config_id FROM menu_items WHERE path = '/config';
  SELECT id INTO config_status_id FROM menu_items WHERE path = '/config/status';
  SELECT id INTO config_ticket_status_id FROM menu_items WHERE path = '/config/ticket-status';
  SELECT id INTO config_crm_status_id FROM menu_items WHERE path = '/config/crm-status';
  SELECT id INTO config_usuarios_id FROM menu_items WHERE path = '/config/usuarios';
  SELECT id INTO config_condominiums_id FROM menu_items WHERE path = '/config/condominiums';
  SELECT id INTO config_administradoras_id FROM menu_items WHERE path = '/config/administradoras';
  SELECT id INTO config_tags_id FROM menu_items WHERE path = '/config/tags';
  SELECT id INTO change_password_id FROM menu_items WHERE path = '/change-password';
  
  -- ADMIN permissions (full access)
  INSERT INTO role_permissions (role_name, menu_item_id, can_access) VALUES
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
  INSERT INTO role_permissions (role_name, menu_item_id, can_access) VALUES
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
  INSERT INTO role_permissions (role_name, menu_item_id, can_access) VALUES
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
END $$;

-- Add comments for documentation
COMMENT ON TABLE role_permissions IS 'Stores default permissions by role for menu items';
COMMENT ON COLUMN role_permissions.role_name IS 'Role name (ADMIN, SECRETARIO, USUARIO)';
COMMENT ON COLUMN role_permissions.menu_item_id IS 'Reference to the menu item';
COMMENT ON COLUMN role_permissions.can_access IS 'Whether users with this role can access this menu item by default';