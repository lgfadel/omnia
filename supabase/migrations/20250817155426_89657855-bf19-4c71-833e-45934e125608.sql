-- Rename role LEITOR to USUARIO across DB defaults and functions
-- 1) Update functions to use USUARIO as fallback/default
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.omnia_users (auth_user_id, name, email, roles)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    ARRAY['USUARIO'::text]  -- Default role renamed from LEITOR to USUARIO
  );
  RETURN NEW;
END;
$function$;

-- 2) Change default of omnia_users.roles to USUARIO
ALTER TABLE public.omnia_users
  ALTER COLUMN roles SET DEFAULT ARRAY['USUARIO'::text];

-- 3) Backfill: replace LEITOR with USUARIO in existing rows
UPDATE public.omnia_users
SET roles = array_replace(COALESCE(roles, ARRAY['USUARIO']), 'LEITOR', 'USUARIO')
WHERE roles IS NULL OR 'LEITOR' = ANY(roles);
