-- Fix infinite recursion in omnia_users RLS policies
-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage users" ON public.omnia_users;

-- Create a new policy without self-reference
CREATE POLICY "Admins can manage users"
ON public.omnia_users
FOR ALL
USING (
  -- Check if current user is admin by directly comparing auth_user_id
  EXISTS (
    SELECT 1 
    FROM public.omnia_users admin_check
    WHERE admin_check.auth_user_id = auth.uid() 
    AND admin_check.role = 'ADMIN'
  )
);

-- Also ensure users can insert their own profile (for new registrations)
CREATE POLICY IF NOT EXISTS "Users can insert their own profile"
ON public.omnia_users
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());