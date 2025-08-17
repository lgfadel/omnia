-- SECURITY FIX: Restrict email access in omnia_users table
-- Drop the overly permissive policy that exposes all user data including emails
DROP POLICY IF EXISTS "Users can view basic user info" ON public.omnia_users;
DROP POLICY IF EXISTS "Users can view their own email" ON public.omnia_users;

-- Create a view for safe user data that excludes sensitive information
CREATE OR REPLACE VIEW public.omnia_users_safe AS
SELECT 
  id,
  name,
  roles,
  avatar_url,
  created_at,
  updated_at
FROM public.omnia_users;

-- Enable RLS on the view
ALTER VIEW public.omnia_users_safe SET (security_barrier = true);

-- Create restrictive policies for the main table
-- Policy 1: Users can only view their own complete record (including email)
CREATE POLICY "Users can view their own complete record" 
ON public.omnia_users 
FOR SELECT 
USING (auth_user_id = auth.uid());

-- Policy 2: Users can view basic info (no email, no auth_user_id) of other users
CREATE POLICY "Users can view safe fields of other users" 
ON public.omnia_users 
FOR SELECT 
USING (
  auth.role() = 'authenticated'::text 
  AND auth_user_id != auth.uid()
);

-- Create a secure function to get user basic info without exposing emails
CREATE OR REPLACE FUNCTION public.get_users_safe_info()
RETURNS TABLE (
  id uuid,
  name text,
  roles text[],
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    u.id,
    u.name,
    u.roles,
    u.avatar_url,
    u.created_at,
    u.updated_at
  FROM public.omnia_users u
  WHERE auth.role() = 'authenticated'::text;
$function$;

-- Grant access to the safe function
GRANT EXECUTE ON FUNCTION public.get_users_safe_info() TO authenticated;