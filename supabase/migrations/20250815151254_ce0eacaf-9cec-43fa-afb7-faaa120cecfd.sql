-- Add roles array column to omnia_users table
ALTER TABLE public.omnia_users 
ADD COLUMN roles TEXT[] DEFAULT ARRAY['LEITOR'];

-- Migrate existing role data to roles array
UPDATE public.omnia_users 
SET roles = ARRAY[role] 
WHERE role IS NOT NULL;

-- Update RLS policies to work with roles array
DROP POLICY IF EXISTS "Admins can manage users" ON public.omnia_users;

-- Create new policy that checks if user has ADMIN role in their roles array
CREATE POLICY "Admins can manage users"
ON public.omnia_users
FOR ALL
USING ('ADMIN' = ANY(
  SELECT unnest(roles) 
  FROM public.omnia_users 
  WHERE auth_user_id = auth.uid()
));

-- Update the function to check for roles array
CREATE OR REPLACE FUNCTION public.get_current_user_roles()
RETURNS TEXT[]
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT roles FROM public.omnia_users WHERE auth_user_id = auth.uid();
$$;

-- Update atas policies to work with roles array
DROP POLICY IF EXISTS "Secretarios and Admins can create atas" ON public.omnia_atas;
DROP POLICY IF EXISTS "Secretarios and Admins can update atas" ON public.omnia_atas;
DROP POLICY IF EXISTS "Admins can delete atas" ON public.omnia_atas;

CREATE POLICY "Secretarios and Admins can create atas"
ON public.omnia_atas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.omnia_users
    WHERE auth_user_id = auth.uid()
    AND (roles && ARRAY['ADMIN', 'SECRETARIO'])
  )
);

CREATE POLICY "Secretarios and Admins can update atas"
ON public.omnia_atas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.omnia_users
    WHERE auth_user_id = auth.uid()
    AND (roles && ARRAY['ADMIN', 'SECRETARIO'])
  )
);

CREATE POLICY "Admins can delete atas"
ON public.omnia_atas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.omnia_users
    WHERE auth_user_id = auth.uid()
    AND 'ADMIN' = ANY(roles)
  )
);

-- Update comments policies
DROP POLICY IF EXISTS "Users can delete their own comments or admins can delete any" ON public.omnia_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.omnia_comments;

CREATE POLICY "Users can delete their own comments or admins can delete any"
ON public.omnia_comments
FOR DELETE
USING (
  (created_by = auth.uid()) 
  OR 
  EXISTS (
    SELECT 1 FROM public.omnia_users
    WHERE auth_user_id = auth.uid()
    AND 'ADMIN' = ANY(roles)
  )
);

CREATE POLICY "Users can update their own comments"
ON public.omnia_comments
FOR UPDATE
USING (
  (created_by = auth.uid()) 
  OR 
  EXISTS (
    SELECT 1 FROM public.omnia_users
    WHERE auth_user_id = auth.uid()
    AND 'ADMIN' = ANY(roles)
  )
);

-- Update attachments policies
DROP POLICY IF EXISTS "Users can delete their own attachments or admins can delete any" ON public.omnia_attachments;

CREATE POLICY "Users can delete their own attachments or admins can delete any"
ON public.omnia_attachments
FOR DELETE
USING (
  (uploaded_by = auth.uid()) 
  OR 
  EXISTS (
    SELECT 1 FROM public.omnia_users
    WHERE auth_user_id = auth.uid()
    AND 'ADMIN' = ANY(roles)
  )
);