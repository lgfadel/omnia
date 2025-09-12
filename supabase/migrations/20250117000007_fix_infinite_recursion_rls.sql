-- Fix infinite recursion in RLS policy for omnia_users table
-- The previous policy was causing recursion by querying the same table in the USING clause

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage users" ON public.omnia_users;

-- Create a new policy that doesn't cause recursion
-- This policy allows users to manage all users if they have ADMIN role
-- We use a function to check the current user's role to avoid recursion
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_roles text[];
BEGIN
  -- Get the roles of the current authenticated user
  SELECT roles INTO user_roles
  FROM public.omnia_users
  WHERE auth_user_id = auth.uid();
  
  -- Check if ADMIN is in the roles array
  RETURN 'ADMIN' = ANY(user_roles);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Create the new policy using the function
CREATE POLICY "Admins can manage users" ON public.omnia_users
  FOR ALL USING (public.is_current_user_admin());

-- Add comment explaining the fix
COMMENT ON POLICY "Admins can manage users" ON public.omnia_users IS 
'Allows users with ADMIN role to perform all operations on users table - uses function to avoid recursion';

COMMENT ON FUNCTION public.is_current_user_admin() IS 
'Helper function to check if current user has ADMIN role without causing RLS recursion';