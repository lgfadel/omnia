-- Migração: Corrigir política RLS da tabela omnia_crm_origens
-- Data: 2025-01-24
-- Descrição: Corrige a política RLS para usar auth_user_id e 'ADMIN' em maiúsculo

-- Remover política existente
DROP POLICY IF EXISTS "Permitir gerenciamento para administradores" ON public.omnia_crm_origens;

-- Recriar política com a verificação correta
CREATE POLICY "Permitir gerenciamento para administradores" ON public.omnia_crm_origens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  );

-- Comentário para documentação
COMMENT ON POLICY "Permitir gerenciamento para administradores" ON public.omnia_crm_origens IS 
'Permite INSERT/UPDATE/DELETE apenas para usuários com role ADMIN. Corrigido para usar auth_user_id e ADMIN em maiúsculo.';