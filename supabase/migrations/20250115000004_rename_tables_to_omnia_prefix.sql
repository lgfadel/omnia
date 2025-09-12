-- Migration: Rename tables to use omnia_ prefix
-- Created: 2025-01-15
-- Description: Renames menu_items and role_permissions tables to follow OMNIA naming convention

-- Rename menu_items table to omnia_menu_items
ALTER TABLE menu_items RENAME TO omnia_menu_items;

-- Rename role_permissions table to omnia_role_permissions
ALTER TABLE role_permissions RENAME TO omnia_role_permissions;

-- Update foreign key constraint in omnia_role_permissions to reference omnia_menu_items
ALTER TABLE omnia_role_permissions 
DROP CONSTRAINT role_permissions_menu_item_id_fkey;

ALTER TABLE omnia_role_permissions 
ADD CONSTRAINT omnia_role_permissions_menu_item_id_fkey 
FOREIGN KEY (menu_item_id) REFERENCES omnia_menu_items(id) ON DELETE CASCADE;

-- Update self-referencing foreign key in omnia_menu_items
ALTER TABLE omnia_menu_items 
DROP CONSTRAINT menu_items_parent_id_fkey;

ALTER TABLE omnia_menu_items 
ADD CONSTRAINT omnia_menu_items_parent_id_fkey 
FOREIGN KEY (parent_id) REFERENCES omnia_menu_items(id) ON DELETE CASCADE;

-- Rename indexes to match new table names
ALTER INDEX idx_menu_items_parent_id RENAME TO idx_omnia_menu_items_parent_id;
ALTER INDEX idx_menu_items_path RENAME TO idx_omnia_menu_items_path;
ALTER INDEX idx_menu_items_order RENAME TO idx_omnia_menu_items_order;

ALTER INDEX idx_role_permissions_role_name RENAME TO idx_omnia_role_permissions_role_name;
ALTER INDEX idx_role_permissions_menu_item_id RENAME TO idx_omnia_role_permissions_menu_item_id;
ALTER INDEX idx_role_permissions_can_access RENAME TO idx_omnia_role_permissions_can_access;

-- Update RLS policies for omnia_menu_items
DROP POLICY IF EXISTS "Users can view menu items" ON omnia_menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON omnia_menu_items;

CREATE POLICY "Users can view omnia menu items" ON omnia_menu_items
  FOR SELECT
  TO authenticated
  USING (true);

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

-- Update RLS policies for omnia_role_permissions
DROP POLICY IF EXISTS "Users can view role permissions" ON omnia_role_permissions;
DROP POLICY IF EXISTS "Admins can manage role permissions" ON omnia_role_permissions;

CREATE POLICY "Users can view omnia role permissions" ON omnia_role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage omnia role permissions" ON omnia_role_permissions
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

-- Update table comments
COMMENT ON TABLE omnia_menu_items IS 'Stores all menu items for the OMNIA permission system';
COMMENT ON TABLE omnia_role_permissions IS 'Stores default permissions by role for the OMNIA system';