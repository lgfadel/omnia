-- Correção da política RLS para tarefas privadas
-- Aplicada via aplicação para resolver problema do ícone de cadeado

-- 1. Remover política existente se houver
DROP POLICY IF EXISTS "Users can view public tickets or their own private tickets" ON omnia_tickets;

-- 2. Criar nova política corrigida
CREATE POLICY "Users can view public tickets or their own private tickets" 
ON omnia_tickets 
FOR SELECT 
USING (
  is_private = false 
  OR 
  created_by = (SELECT id FROM omnia_users WHERE auth_user_id = auth.uid())
);

-- 3. Garantir que RLS está habilitado
ALTER TABLE omnia_tickets ENABLE ROW LEVEL SECURITY;

-- 4. Verificar se a política foi aplicada corretamente
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'omnia_tickets' 
AND schemaname = 'public'
AND policyname = 'Users can view public tickets or their own private tickets';