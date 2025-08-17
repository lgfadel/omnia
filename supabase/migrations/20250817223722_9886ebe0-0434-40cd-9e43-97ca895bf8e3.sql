-- FINAL SECURITY FIX: Completely prevent email exposure to other users

-- Step 1: Drop the problematic policy that still allows viewing other users' data
DROP POLICY IF EXISTS "Users can view safe fields of other users" ON public.omnia_users;

-- Step 2: Drop the unused view (views can't have RLS policies anyway)
DROP VIEW IF EXISTS public.omnia_users_safe;

-- Step 3: Drop the unused function since we're using application-level access control
DROP FUNCTION IF EXISTS public.get_users_safe_info();

-- Now users can only access:
-- 1. Their own complete record (including email) via "Users can view their own complete record" policy
-- 2. Admin users can access everything via existing admin policies
-- 3. All other access is explicitly handled in application code with safe column selection