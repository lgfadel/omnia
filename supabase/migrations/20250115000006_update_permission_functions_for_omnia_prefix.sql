-- Migration: Update permission functions to use omnia_ prefixed tables
-- Created: 2025-01-15
-- Description: Updates permission functions to reference omnia_user_permissions and omnia_menu_items

-- Function to check if a user has permission to access a menu item
CREATE OR REPLACE FUNCTION check_user_menu_permission(
  p_user_id UUID,
  p_menu_item_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_menu_item_id UUID;
  v_user_roles TEXT[];
  v_specific_permission BOOLEAN;
  v_role_permission BOOLEAN;
  v_role TEXT;
BEGIN
  -- Get menu item ID from path
  SELECT id INTO v_menu_item_id 
  FROM omnia_menu_items 
  WHERE path = p_menu_item_path AND is_active = true;
  
  -- If menu item doesn't exist, deny access
  IF v_menu_item_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user roles
  SELECT roles INTO v_user_roles 
  FROM omnia_users 
  WHERE id = p_user_id;
  
  -- If user doesn't exist, deny access
  IF v_user_roles IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check for specific user permission (overrides role permissions)
  SELECT can_access INTO v_specific_permission
  FROM omnia_user_permissions
  WHERE user_id = p_user_id AND menu_item_id = v_menu_item_id;
  
  -- If specific permission exists, use it
  IF v_specific_permission IS NOT NULL THEN
    RETURN v_specific_permission;
  END IF;
  
  -- Check role-based permissions
  -- If user has ADMIN role, check ADMIN permissions first
  IF 'ADMIN' = ANY(v_user_roles) THEN
    SELECT can_access INTO v_role_permission
    FROM omnia_role_permissions
    WHERE role_name = 'ADMIN' AND menu_item_id = v_menu_item_id;
    
    IF v_role_permission IS NOT NULL THEN
      RETURN v_role_permission;
    END IF;
  END IF;
  
  -- Check other roles in order of priority: SECRETARIO, then USUARIO
  FOREACH v_role IN ARRAY v_user_roles LOOP
    IF v_role IN ('SECRETARIO', 'USUARIO') THEN
      SELECT can_access INTO v_role_permission
      FROM omnia_role_permissions
      WHERE role_name = v_role AND menu_item_id = v_menu_item_id;
      
      IF v_role_permission IS NOT NULL THEN
        RETURN v_role_permission;
      END IF;
    END IF;
  END LOOP;
  
  -- Default: deny access if no permission found
  RETURN false;
END;
$$;

-- Function to get all accessible menu items for a user
CREATE OR REPLACE FUNCTION get_user_accessible_menu_items(
  p_user_id UUID
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  path TEXT,
  icon TEXT,
  parent_id UUID,
  order_index INTEGER,
  can_access BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.id,
    mi.name,
    mi.path,
    mi.icon,
    mi.parent_id,
    mi.order_index,
    check_user_menu_permission(p_user_id, mi.path) as can_access
  FROM omnia_menu_items mi
  WHERE mi.is_active = true
  ORDER BY mi.order_index;
END;
$$;

-- Drop existing function if it exists to avoid return type conflicts
DROP FUNCTION IF EXISTS get_user_permissions_summary(UUID);

-- Function to get user permissions summary
CREATE OR REPLACE FUNCTION get_user_permissions_summary(
  p_user_id UUID
)
RETURNS TABLE(
  menu_item_id UUID,
  menu_item_name TEXT,
  menu_item_path TEXT,
  permission_source TEXT,
  granted_by_name TEXT,
  granted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_roles TEXT[];
BEGIN
  -- Get user roles
  SELECT roles INTO v_user_roles 
  FROM omnia_users 
  WHERE id = p_user_id;
  
  RETURN QUERY
  WITH user_specific_perms AS (
    SELECT 
      up.menu_item_id,
      mi.name as menu_item_name,
      mi.path as menu_item_path,
      'USER_SPECIFIC' as permission_source,
      up.can_access,
      gu.name as granted_by_name,
      up.granted_at
    FROM omnia_user_permissions up
    JOIN omnia_menu_items mi ON up.menu_item_id = mi.id
    LEFT JOIN omnia_users gu ON up.granted_by = gu.id
    WHERE up.user_id = p_user_id
  ),
  role_based_perms AS (
    SELECT 
      rp.menu_item_id,
      mi.name as menu_item_name,
      mi.path as menu_item_path,
      'ROLE_BASED (' || rp.role_name || ')' as permission_source,
      rp.can_access,
      NULL::TEXT as granted_by_name,
      NULL::TIMESTAMPTZ as granted_at
    FROM omnia_role_permissions rp
    JOIN omnia_menu_items mi ON rp.menu_item_id = mi.id
    WHERE rp.role_name = ANY(v_user_roles)
    AND NOT EXISTS (SELECT 1 FROM omnia_user_permissions up WHERE up.user_id = p_user_id AND up.menu_item_id = rp.menu_item_id)
  )
  SELECT * FROM user_specific_perms
  UNION ALL
  SELECT * FROM role_based_perms
  ORDER BY menu_item_path;
END;
$$;

-- Function to check if current authenticated user has permission
CREATE OR REPLACE FUNCTION check_current_user_menu_permission(
  p_menu_item_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT id INTO v_user_id 
  FROM omnia_users 
  WHERE auth_user_id = auth.uid();
  
  -- If user not found, deny access
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Use the main permission check function
  RETURN check_user_menu_permission(v_user_id, p_menu_item_path);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_user_menu_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_accessible_menu_items(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_current_user_menu_permission(TEXT) TO authenticated;

-- Add comments
COMMENT ON FUNCTION check_user_menu_permission(UUID, TEXT) IS 'Checks if a user has permission to access a specific menu item';
COMMENT ON FUNCTION get_user_accessible_menu_items(UUID) IS 'Returns all menu items accessible to a user with permission status';
COMMENT ON FUNCTION get_user_permissions_summary(UUID) IS 'Returns detailed permission summary for a user including source and granted by info';
COMMENT ON FUNCTION check_current_user_menu_permission(TEXT) IS 'Checks if the current authenticated user has permission to access a menu item';