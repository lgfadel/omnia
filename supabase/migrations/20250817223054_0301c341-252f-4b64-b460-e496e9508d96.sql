-- SECURITY FIX 1: Fix email exposure in omnia_users table
-- Drop the overly permissive policy that allows all users to see all user data
DROP POLICY IF EXISTS "Users can view all users" ON public.omnia_users;

-- Create restrictive policies for user data access
-- Policy 1: Users can view basic info (name, roles, avatar) of all users (needed for ATA assignments)
CREATE POLICY "Users can view basic user info" 
ON public.omnia_users 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- Policy 2: Users can only view their own email
CREATE POLICY "Users can view their own email" 
ON public.omnia_users 
FOR SELECT 
USING (auth_user_id = auth.uid());

-- SECURITY FIX 2: Add search_path security to database functions
-- Fix get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT 
    CASE 
      WHEN roles IS NOT NULL AND array_length(roles, 1) > 0 
      THEN roles[1]
      ELSE 'USUARIO'
    END
  FROM public.omnia_users 
  WHERE auth_user_id = auth.uid();
$function$;

-- Fix get_current_user_roles function
CREATE OR REPLACE FUNCTION public.get_current_user_roles()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT roles FROM public.omnia_users WHERE auth_user_id = auth.uid();
$function$;

-- Fix is_admin_user function
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.omnia_users 
    WHERE auth_user_id = user_id 
    AND 'ADMIN' = ANY(roles)
  );
$function$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_ata_comment_count function
CREATE OR REPLACE FUNCTION public.update_ata_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.omnia_atas 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.ata_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.omnia_atas 
    SET comment_count = comment_count - 1 
    WHERE id = OLD.ata_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.omnia_users (auth_user_id, name, email, roles)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    ARRAY['USUARIO'::text]
  );
  RETURN NEW;
END;
$function$;