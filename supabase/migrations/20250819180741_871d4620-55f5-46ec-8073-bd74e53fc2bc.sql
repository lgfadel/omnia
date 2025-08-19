-- Ajustar política de INSERT para permitir que usuários com role USUARIO também criem atas
DROP POLICY IF EXISTS "Secretarios and Admins can create atas" ON omnia_atas;

-- Nova política permitindo ADMIN, SECRETARIO e USUARIO criarem atas
CREATE POLICY "Authenticated users can create atas" 
ON omnia_atas 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM omnia_users 
    WHERE omnia_users.auth_user_id = auth.uid()
    AND omnia_users.roles && ARRAY['ADMIN', 'SECRETARIO', 'USUARIO']
  )
);

-- Ajustar política de UPDATE para incluir USUARIO também
DROP POLICY IF EXISTS "Secretarios and Admins can update atas" ON omnia_atas;

CREATE POLICY "Authenticated users can update atas" 
ON omnia_atas 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM omnia_users 
    WHERE omnia_users.auth_user_id = auth.uid()
    AND omnia_users.roles && ARRAY['ADMIN', 'SECRETARIO', 'USUARIO']
  )
);