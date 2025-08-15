-- Update existing users to have proper roles arrays
UPDATE public.omnia_users 
SET roles = ARRAY['ADMIN', 'SECRETARIO'] 
WHERE email = 'maria@exemplo.com';

UPDATE public.omnia_users 
SET roles = ARRAY['SECRETARIO'] 
WHERE email = 'ana@exemplo.com';

UPDATE public.omnia_users 
SET roles = ARRAY['SECRETARIO'] 
WHERE email = 'carlos@exemplo.com';