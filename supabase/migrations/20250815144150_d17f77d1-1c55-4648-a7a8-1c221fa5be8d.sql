-- Fix infinite recursion in omnia_users RLS policies

-- First, create a security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.omnia_users WHERE auth_user_id = auth.uid();
$$;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can manage users" ON public.omnia_users;

-- Create new policies using the security definer function
CREATE POLICY "Admins can manage users"
ON public.omnia_users
FOR ALL
USING (public.get_current_user_role() = 'ADMIN');

-- Ensure users can insert their own profile (for new registrations)  
CREATE POLICY "Users can insert their own profile"
ON public.omnia_users
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());