-- Migration: Fix menu items table creation
-- Created: 2025-01-17
-- Description: Ensures omnia_menu_items table exists with correct structure and data

-- Drop the old menu_items table if it exists (from the later migration)
DROP TABLE IF EXISTS menu_items CASCADE;

-- Create omnia_menu_items table with correct structure
CREATE TABLE IF NOT EXISTS omnia_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  icon TEXT,
  parent_id UUID REFERENCES omnia_menu_items(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_omnia_menu_items_parent_id ON omnia_menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_omnia_menu_items_path ON omnia_menu_items(path);
CREATE INDEX IF NOT EXISTS idx_omnia_menu_items_order ON omnia_menu_items(order_index);

-- Enable RLS (Row Level Security)
ALTER TABLE omnia_menu_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view menu items" ON omnia_menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON omnia_menu_items;
DROP POLICY IF EXISTS "Users can view omnia menu items" ON omnia_menu_items;
DROP POLICY IF EXISTS "Admins can manage omnia menu items" ON omnia_menu_items;

-- Create RLS policies
-- All authenticated users can read menu items
CREATE POLICY "Users can view omnia menu items" ON omnia_menu_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage menu items
CREATE POLICY "Admins can manage omnia menu items" ON omnia_menu_items
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
-- Clear existing data first
TRUNCATE TABLE omnia_menu_items CASCADE;

-- Main navigation items
INSERT INTO omnia_menu_items (name, path, icon, parent_id, order_index) VALUES
  ('Dashboard', '/', 'Home', NULL, 1),
  ('Atas', '/atas', 'ClipboardList', NULL, 2),
  ('Tarefas', '/tarefas', 'Ticket', NULL, 3),
  ('CRM', '/crm', 'Building2', NULL, 4),
  ('Relatórios', '/relatorios', 'FileText', NULL, 5);

-- Configuration parent item
INSERT INTO omnia_menu_items (name, path, icon, parent_id, order_index) VALUES
  ('Configurações', '/config', 'Settings', NULL, 6);

-- Get the configuration parent ID for sub-items
DO $$
DECLARE
  config_id UUID;
BEGIN
  SELECT id INTO config_id FROM omnia_menu_items WHERE path = '/config';
  
  -- Configuration sub-items
  INSERT INTO omnia_menu_items (name, path, icon, parent_id, order_index) VALUES
    ('Status', '/config/status', 'BarChart3', config_id, 1),
    ('Status Tickets', '/config/ticket-status', 'BarChart3', config_id, 2),
    ('Status CRM', '/config/crm-status', 'BarChart3', config_id, 3),
    ('Usuários', '/config/usuarios', 'Users', config_id, 4),
    ('Condomínios', '/config/condominiums', 'Building2', config_id, 5),
    ('Administradoras', '/config/administradoras', 'Building2', config_id, 6),
    ('Tags', '/config/tags', 'Tags', config_id, 7);
END $$;

-- User management items (not in main navigation but accessible)
INSERT INTO omnia_menu_items (name, path, icon, parent_id, order_index) VALUES
  ('Alterar Senha', '/change-password', 'KeyRound', NULL, 7);

-- Add table comment
COMMENT ON TABLE omnia_menu_items IS 'Stores all menu items for the OMNIA permission system';