-- Adicionar campo is_private à tabela omnia_tickets
ALTER TABLE public.omnia_tickets 
ADD COLUMN is_private BOOLEAN DEFAULT false;

-- Atualizar política RLS para restringir visualização de tarefas privadas
DROP POLICY "Anyone can view tickets" ON public.omnia_tickets;

CREATE POLICY "Users can view public tickets or their own private tickets" 
ON public.omnia_tickets 
FOR SELECT 
USING (
  auth.role() = 'authenticated'::text AND (
    is_private = false OR 
    created_by = auth.uid() OR 
    EXISTS(
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  )
);

-- Atualizar política de criação para validar tarefas privadas
DROP POLICY "Authenticated users can create tickets" ON public.omnia_tickets;

CREATE POLICY "Authenticated users can create tickets" 
ON public.omnia_tickets 
FOR INSERT 
WITH CHECK (
  EXISTS ( 
    SELECT 1 FROM omnia_users 
    WHERE omnia_users.auth_user_id = auth.uid() 
    AND omnia_users.roles && ARRAY['ADMIN'::text, 'SECRETARIO'::text, 'USUARIO'::text]
  ) AND (
    -- Se for tarefa privada, não pode ter assigned_to diferente do criador
    (is_private = false) OR 
    (is_private = true AND (assigned_to IS NULL OR assigned_to = auth.uid()))
  )
);

-- Atualizar política de edição para validar tarefas privadas
DROP POLICY "Authenticated users can update tickets" ON public.omnia_tickets;

CREATE POLICY "Authenticated users can update tickets" 
ON public.omnia_tickets 
FOR UPDATE 
USING (
  EXISTS ( 
    SELECT 1 FROM omnia_users 
    WHERE omnia_users.auth_user_id = auth.uid() 
    AND omnia_users.roles && ARRAY['ADMIN'::text, 'SECRETARIO'::text, 'USUARIO'::text]
  ) AND (
    -- Pode editar se não for privada, ou se for o criador, ou se for admin
    (is_private = false) OR 
    (created_by = auth.uid()) OR
    EXISTS(
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  )
) WITH CHECK (
  -- Validações para atualização
  (is_private = false) OR 
  (is_private = true AND (assigned_to IS NULL OR assigned_to = auth.uid()))
);

-- Comentário explicativo
COMMENT ON COLUMN public.omnia_tickets.is_private IS 'Indica se a tarefa é privada (visível apenas ao criador e admins)';