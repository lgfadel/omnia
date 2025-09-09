-- Corrigir políticas RLS da tabela omnia_administradoras
-- O problema era que as políticas estavam tentando acessar auth.users diretamente,
-- mas o projeto usa omnia_users com campo roles

-- Remover políticas antigas que causam erro de permissão
DROP POLICY IF EXISTS "Administradores podem criar administradoras" ON omnia_administradoras;
DROP POLICY IF EXISTS "Administradores podem atualizar administradoras" ON omnia_administradoras;
DROP POLICY IF EXISTS "Administradores podem excluir administradoras" ON omnia_administradoras;

-- Política para administradores criarem administradoras (usando omnia_users)
CREATE POLICY "Administradores podem criar administradoras" ON omnia_administradoras
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN'::text = ANY (roles)
    )
  );

-- Política para administradores atualizarem administradoras (usando omnia_users)
CREATE POLICY "Administradores podem atualizar administradoras" ON omnia_administradoras
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN'::text = ANY (roles)
    )
  );

-- Política para administradores excluírem administradoras (usando omnia_users)
CREATE POLICY "Administradores podem excluir administradoras" ON omnia_administradoras
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN'::text = ANY (roles)
    )
  );