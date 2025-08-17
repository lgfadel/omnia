-- FINAL SECURITY FIX: Completely prevent email exposure to other users
-- Drop the problematic policy that still allows viewing other users' data
DROP POLICY IF EXISTS "Users can view safe fields of other users" ON public.omnia_users;

-- The remaining policy "Users can view their own complete record" is sufficient for self-access
-- Admin access is handled by the existing "Admins can manage users" policy

-- Add RLS policies to the omnia_users_safe view
CREATE POLICY "Authenticated users can view safe user data" 
ON public.omnia_users_safe 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- Drop the unused view since we're now using explicit column selection in code
DROP VIEW IF EXISTS public.omnia_users_safe;