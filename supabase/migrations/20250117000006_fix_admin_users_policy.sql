-- Fix RLS policy for omnia_users table to use roles array instead of role column
-- This fixes the issue where admin users cannot access user management

-- Drop the existing policy that uses the obsolete 'role' column
DROP POLICY IF EXISTS "Admins can manage users" ON public.omnia_users;

-- Recreate the policy using the correct 'roles' array field
CREATE POLICY "Admins can manage users" ON public.omnia_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND 'ADMIN' = ANY(roles)
    )
  );

-- Add comment explaining the fix
COMMENT ON POLICY "Admins can manage users" ON public.omnia_users IS 
'Allows users with ADMIN role in roles array to perform all operations on users table';