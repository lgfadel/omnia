-- Corrigir política RLS de SELECT para tarefas privadas
-- O problema é que a política estava comparando created_by com auth.uid()
-- mas created_by referencia omnia_users.id, não auth_user_id

-- Atualizar política de visualização para corrigir tarefas privadas
DROP POLICY "Users can view public tickets or their own private tickets" ON public.omnia_tickets;

CREATE POLICY "Users can view public tickets or their own private tickets" 
ON public.omnia_tickets 
FOR SELECT 
USING (
  auth.role() = 'authenticated'::text AND (
    -- Tarefas públicas são visíveis para todos
    is_private = false OR 
    -- Tarefas privadas são visíveis para o criador (usando omnia_users.id)
    created_by = (
      SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
    ) OR 
    -- Tarefas privadas são visíveis para admins
    EXISTS(
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  )
);

-- Comentário explicativo
COMMENT ON POLICY "Users can view public tickets or their own private tickets" ON public.omnia_tickets IS 'Permite visualizar tarefas públicas para todos, e tarefas privadas apenas para o criador (usando omnia_users.id) e admins';