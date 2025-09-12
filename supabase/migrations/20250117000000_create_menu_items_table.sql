-- Migration: Create menu_items table for user permission system
-- Created: 2025-01-17
-- Description: Creates the menu_items table to store all menu items from the OMNIA system

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  icon TEXT,
  parent_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_menu_items_parent_id ON menu_items(parent_id);
CREATE INDEX idx_menu_items_path ON menu_items(path);
CREATE INDEX idx_menu_items_order ON menu_items(order_index);

-- Enable RLS (Row Level Security)
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- All authenticated users can read menu items
CREATE POLICY "Users can view menu items" ON menu_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage menu items
CREATE POLICY "Admins can manage menu items" ON menu_items
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

-- Insert initial menu items based on current OMNIA structure
-- Main navigation items
INSERT INTO menu_items (name, path, icon, parent_id, order_index) VALUES
  ('Dashboard', '/', 'Home', NULL, 1),
  ('Atas', '/atas', 'ClipboardList', NULL, 2),
  ('Tarefas', '/tarefas', 'Ticket', NULL, 3),
  ('CRM', '/crm', 'Building2', NULL, 4),
  ('Relatórios', '/relatorios', 'FileText', NULL, 5);

-- Configuration parent item
INSERT INTO menu_items (name, path, icon, parent_id, order_index) VALUES
  ('Configurações', '/config', 'Settings', NULL, 6);

-- Get the configuration parent ID for sub-items
DO $$
DECLARE
  config_id UUID;
BEGIN
  SELECT id INTO config_id FROM menu_items WHERE path = '/config';
  
  -- Configuration sub-items
  INSERT INTO menu_items (name, path, icon, parent_id, order_index) VALUES
    ('Status', '/config/status', 'BarChart3', config_id, 1),
    ('Status Tickets', '/config/ticket-status', 'BarChart3', config_id, 2),
    ('Status CRM', '/config/crm-status', 'BarChart3', config_id, 3),
    ('Usuários', '/config/usuarios', 'Users', config_id, 4),
    ('Condomínios', '/config/condominiums', 'Building2', config_id, 5),
    ('Administradoras', '/config/administradoras', 'Building2', config_id, 6),
    ('Tags', '/config/tags', 'Tags', config_id, 7);
END $$;

-- User management items (not in main navigation but accessible)
INSERT INTO menu_items (name, path, icon, parent_id, order_index) VALUES
  ('Alterar Senha', '/change-password', 'KeyRound', NULL, 7);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_items_updated_at();

-- Add comments for documentation
COMMENT ON TABLE menu_items IS 'Stores all menu items for the OMNIA permission system';
COMMENT ON COLUMN menu_items.name IS 'Display name of the menu item';
COMMENT ON COLUMN menu_items.path IS 'URL path for the menu item (unique)';
COMMENT ON COLUMN menu_items.icon IS 'Lucide icon name for the menu item';
COMMENT ON COLUMN menu_items.parent_id IS 'Reference to parent menu item for hierarchical structure';
COMMENT ON COLUMN menu_items.order_index IS 'Order of the menu item within its level';
COMMENT ON COLUMN menu_items.is_active IS 'Whether the menu item is active and should be displayed';