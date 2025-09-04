-- Corrigir políticas RLS para tarefas privadas
-- O problema é que as políticas estavam comparando assigned_to e created_by com auth.uid()
-- mas esses campos referenciam omnia_users.id, não auth_user_id

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
    -- Se for tarefa privada, assigned_to deve ser NULL ou o id do omnia_users do criador
    (is_private = false) OR 
    (is_private = true AND (
      assigned_to IS NULL OR 
      assigned_to = (
        SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
      )
    ))
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
    (created_by = (
      SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
    )) OR
    EXISTS(
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  )
) WITH CHECK (
  -- Validações para atualização
  (is_private = false) OR 
  (is_private = true AND (
    assigned_to IS NULL OR 
    assigned_to = (
      SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
    )
  ))
);

-- Comentário explicativo
COMMENT ON COLUMN public.omnia_tickets.is_private IS 'Indica se a tarefa é privada (visível apenas ao criador e admins). As políticas RLS foram corrigidas para usar omnia_users.id em vez de auth.uid() nas comparações.';