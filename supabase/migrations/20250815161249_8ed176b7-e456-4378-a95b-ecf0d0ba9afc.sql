-- Fix infinite recursion in RLS policies for omnia_users table
-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can manage users" ON public.omnia_users;
DROP POLICY IF EXISTS "Users can view all users" ON public.omnia_users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.omnia_users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.omnia_users;

-- Create new policies that avoid recursion
-- Policy for viewing users - simplified to avoid recursion
CREATE POLICY "Users can view all users" 
ON public.omnia_users 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Policy for users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.omnia_users 
FOR UPDATE 
USING (auth_user_id = auth.uid());

-- Policy for users to insert their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.omnia_users 
FOR INSERT 
WITH CHECK (auth_user_id = auth.uid());

-- Policy for admins to manage users - use a function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.omnia_users 
    WHERE auth_user_id = user_id 
    AND 'ADMIN' = ANY(roles)
  );
$$;

-- Admin policy using the function
CREATE POLICY "Admins can manage users" 
ON public.omnia_users 
FOR ALL 
USING (public.is_admin_user(auth.uid()));

-- Policy for admin delete operations
CREATE POLICY "Admins can delete users" 
ON public.omnia_users 
FOR DELETE 
USING (public.is_admin_user(auth.uid()));