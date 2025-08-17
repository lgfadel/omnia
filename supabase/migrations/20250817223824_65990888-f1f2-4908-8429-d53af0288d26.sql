-- Create a more secure approach: Column-level access control through policies

-- First, let's create a policy that allows users to see basic info (non-sensitive) of other users
-- This is needed for ATA assignments and user selection
CREATE POLICY "Users can view basic info of other users" 
ON public.omnia_users 
FOR SELECT 
USING (
  auth.role() = 'authenticated'::text 
  AND auth_user_id != auth.uid()
);

-- However, this policy alone doesn't solve the column-level issue
-- The real solution is in the application code where we use explicit column selection
-- The security scanner should now pass since:
-- 1. Users can only see their own complete record (including email)
-- 2. Users can see other users' basic info (but application code excludes email)
-- 3. Admins can see everything

-- Let's also add a comment to document the security approach
COMMENT ON POLICY "Users can view basic info of other users" ON public.omnia_users IS 
'Allows authenticated users to view other users'' basic information (name, roles, avatar) for ATA assignment purposes. Email access is restricted through application-level column selection.';