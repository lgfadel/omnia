-- Fix foreign key constraints for omnia_tags and omnia_atas tables
-- Change references from auth.users(id) to public.omnia_users(id)

-- Drop existing foreign key constraints
ALTER TABLE public.omnia_tags DROP CONSTRAINT IF EXISTS omnia_tags_created_by_fkey;
ALTER TABLE public.omnia_atas DROP CONSTRAINT IF EXISTS omnia_atas_created_by_fkey;

-- Update existing records that have auth_user_id values in created_by to use omnia_users.id
-- The created_by field currently stores auth_user_id values, we need to convert them to omnia_users.id
UPDATE public.omnia_tags 
SET created_by = (
  SELECT ou.id 
  FROM public.omnia_users ou 
  WHERE ou.auth_user_id = omnia_tags.created_by::uuid
)
WHERE created_by IS NOT NULL 
AND EXISTS (
  SELECT 1 
  FROM public.omnia_users ou 
  WHERE ou.auth_user_id = omnia_tags.created_by::uuid
);

UPDATE public.omnia_atas 
SET created_by = (
  SELECT ou.id 
  FROM public.omnia_users ou 
  WHERE ou.auth_user_id = omnia_atas.created_by::uuid
)
WHERE created_by IS NOT NULL 
AND EXISTS (
  SELECT 1 
  FROM public.omnia_users ou 
  WHERE ou.auth_user_id = omnia_atas.created_by::uuid
);

-- Set created_by to NULL for records that don't have corresponding omnia_users
UPDATE public.omnia_tags 
SET created_by = NULL 
WHERE created_by IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 
  FROM public.omnia_users ou 
  WHERE ou.id = omnia_tags.created_by
);

UPDATE public.omnia_atas 
SET created_by = NULL 
WHERE created_by IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 
  FROM public.omnia_users ou 
  WHERE ou.id = omnia_atas.created_by
);

-- Add new foreign key constraints referencing omnia_users (after data cleanup)
ALTER TABLE public.omnia_tags 
ADD CONSTRAINT omnia_tags_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.omnia_users(id) ON DELETE SET NULL;

ALTER TABLE public.omnia_atas 
ADD CONSTRAINT omnia_atas_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.omnia_users(id) ON DELETE SET NULL;