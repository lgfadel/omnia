-- Migration: Create user_permissions table for user permission system
-- Created: 2025-01-17
-- Description: Creates the user_permissions table to store specific user permissions for menu items

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES omnia_users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  can_access BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES omnia_users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique combination of user and menu item
  UNIQUE(user_id, menu_item_id)
);

-- Create indexes for better performance
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_menu_item_id ON user_permissions(menu_item_id);
CREATE INDEX idx_user_permissions_can_access ON user_permissions(can_access);
CREATE INDEX idx_user_permissions_granted_by ON user_permissions(granted_by);

-- Enable RLS (Row Level Security)
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own permissions
CREATE POLICY "Users can view own permissions" ON user_permissions
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
    )
  );

-- Admins can view all permissions
CREATE POLICY "Admins can view all permissions" ON user_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  );

-- Only admins can manage user permissions
CREATE POLICY "Admins can manage user permissions" ON user_permissions
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
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_updated_at();

-- Add trigger to automatically set granted_by when inserting
CREATE OR REPLACE FUNCTION set_user_permissions_granted_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Set granted_by to current user if not explicitly set
  IF NEW.granted_by IS NULL THEN
    SELECT id INTO NEW.granted_by 
    FROM omnia_users 
    WHERE auth_user_id = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_user_permissions_granted_by
  BEFORE INSERT ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION set_user_permissions_granted_by();

-- Add comments for documentation
COMMENT ON TABLE user_permissions IS 'Stores specific user permissions for menu items';
COMMENT ON COLUMN user_permissions.user_id IS 'Reference to the user receiving the permission';
COMMENT ON COLUMN user_permissions.menu_item_id IS 'Reference to the menu item being granted/denied';
COMMENT ON COLUMN user_permissions.can_access IS 'Whether the user can access this menu item';
COMMENT ON COLUMN user_permissions.granted_by IS 'User who granted this permission';
COMMENT ON COLUMN user_permissions.granted_at IS 'When the permission was granted';