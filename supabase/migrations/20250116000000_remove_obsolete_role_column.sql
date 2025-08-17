-- Remove obsolete 'role' column from omnia_users table
-- This column was replaced by 'roles' array in migration 20250815151254
-- Using CASCADE to drop dependent objects (RLS policies that reference this column)

ALTER TABLE public.omnia_users 
DROP COLUMN IF EXISTS role CASCADE;

-- Recreate the "Admins can manage statuses" policy to use roles array instead of role column
DROP POLICY IF EXISTS "Admins can manage statuses" ON public.omnia_statuses;

CREATE POLICY "Admins can manage statuses" ON public.omnia_statuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND 'ADMIN' = ANY(roles)
    )
  );

-- Update the get_current_user_role function to be deprecated
-- (keeping it for backward compatibility but it will return the first role from roles array)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    CASE 
      WHEN roles IS NOT NULL AND array_length(roles, 1) > 0 
      THEN roles[1]
      ELSE 'LEITOR'
    END
  FROM public.omnia_users 
  WHERE auth_user_id = auth.uid();
$$;

-- Add comment to indicate this function is deprecated
COMMENT ON FUNCTION public.get_current_user_role() IS 'DEPRECATED: Use get_current_user_roles() instead. This function returns the first role from the roles array for backward compatibility.';