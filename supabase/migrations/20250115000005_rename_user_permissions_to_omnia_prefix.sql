-- Migration: Rename user_permissions table to use omnia_ prefix
-- Created: 2025-01-15
-- Description: Renames user_permissions table to follow OMNIA naming convention

-- Rename user_permissions table to omnia_user_permissions
ALTER TABLE user_permissions RENAME TO omnia_user_permissions;

-- Update foreign key constraints
ALTER TABLE omnia_user_permissions 
DROP CONSTRAINT user_permissions_user_id_fkey;

ALTER TABLE omnia_user_permissions 
ADD CONSTRAINT omnia_user_permissions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES omnia_users(id) ON DELETE CASCADE;

ALTER TABLE omnia_user_permissions 
DROP CONSTRAINT user_permissions_menu_item_id_fkey;

ALTER TABLE omnia_user_permissions 
ADD CONSTRAINT omnia_user_permissions_menu_item_id_fkey 
FOREIGN KEY (menu_item_id) REFERENCES omnia_menu_items(id) ON DELETE CASCADE;

ALTER TABLE omnia_user_permissions 
DROP CONSTRAINT user_permissions_granted_by_fkey;

ALTER TABLE omnia_user_permissions 
ADD CONSTRAINT omnia_user_permissions_granted_by_fkey 
FOREIGN KEY (granted_by) REFERENCES omnia_users(id);

-- Rename indexes to match new table name
ALTER INDEX idx_user_permissions_user_id RENAME TO idx_omnia_user_permissions_user_id;
ALTER INDEX idx_user_permissions_menu_item_id RENAME TO idx_omnia_user_permissions_menu_item_id;
ALTER INDEX idx_user_permissions_can_access RENAME TO idx_omnia_user_permissions_can_access;
ALTER INDEX idx_user_permissions_granted_by RENAME TO idx_omnia_user_permissions_granted_by;

-- Update unique constraint
ALTER TABLE omnia_user_permissions 
DROP CONSTRAINT user_permissions_user_id_menu_item_id_key;

ALTER TABLE omnia_user_permissions 
ADD CONSTRAINT omnia_user_permissions_user_id_menu_item_id_key 
UNIQUE (user_id, menu_item_id);

-- Update RLS policies for omnia_user_permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON omnia_user_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON omnia_user_permissions;
DROP POLICY IF EXISTS "Admins can manage user permissions" ON omnia_user_permissions;

CREATE POLICY "Users can view own omnia permissions" ON omnia_user_permissions
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all omnia permissions" ON omnia_user_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  );

CREATE POLICY "Admins can manage omnia user permissions" ON omnia_user_permissions
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

-- Update trigger names
DROP TRIGGER IF EXISTS trigger_update_user_permissions_updated_at ON omnia_user_permissions;
DROP TRIGGER IF EXISTS trigger_set_user_permissions_granted_by ON omnia_user_permissions;

CREATE TRIGGER trigger_update_omnia_user_permissions_updated_at
  BEFORE UPDATE ON omnia_user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_updated_at();

CREATE TRIGGER trigger_set_omnia_user_permissions_granted_by
  BEFORE INSERT ON omnia_user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION set_user_permissions_granted_by();

-- Update table comment
COMMENT ON TABLE omnia_user_permissions IS 'Stores specific user permissions for menu items in the OMNIA system';