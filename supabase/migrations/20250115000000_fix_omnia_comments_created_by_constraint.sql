-- Fix foreign key constraint for omnia_comments table
-- Change reference from auth.users(id) to public.omnia_users(id) to align with other tables

-- Drop existing foreign key constraint
ALTER TABLE public.omnia_comments DROP CONSTRAINT IF EXISTS omnia_comments_created_by_fkey;

-- Update existing records that have auth_user_id values in created_by to use omnia_users.id
-- The created_by field currently stores auth_user_id values, we need to convert them to omnia_users.id
UPDATE public.omnia_comments 
SET created_by = (
  SELECT ou.id 
  FROM public.omnia_users ou 
  WHERE ou.auth_user_id = omnia_comments.created_by::uuid
)
WHERE created_by IS NOT NULL 
AND EXISTS (
  SELECT 1 
  FROM public.omnia_users ou 
  WHERE ou.auth_user_id = omnia_comments.created_by::uuid
);

-- Clean up records where no matching omnia_user exists
UPDATE public.omnia_comments 
SET created_by = NULL
WHERE created_by IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 
  FROM public.omnia_users ou 
  WHERE ou.id = omnia_comments.created_by
);

-- Add new foreign key constraint referencing omnia_users (after data cleanup)
ALTER TABLE public.omnia_comments 
ADD CONSTRAINT omnia_comments_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.omnia_users(id) ON DELETE SET NULL;