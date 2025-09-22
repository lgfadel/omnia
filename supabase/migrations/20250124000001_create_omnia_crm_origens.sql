-- Migração: Criar tabela omnia_crm_origens
-- Data: 2025-01-24
-- Descrição: Tabela para gerenciar origens dos leads do CRM

-- Criar tabela omnia_crm_origens
CREATE TABLE public.omnia_crm_origens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(100) NOT NULL,
  color varchar(7) NOT NULL DEFAULT '#3b82f6',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.omnia_crm_origens ENABLE ROW LEVEL SECURITY;

-- Política para permitir SELECT para todos os usuários autenticados
CREATE POLICY "Permitir SELECT para usuários autenticados" ON public.omnia_crm_origens
  FOR SELECT TO authenticated
  USING (true);

-- Política para permitir INSERT/UPDATE/DELETE apenas para administradores
CREATE POLICY "Permitir gerenciamento para administradores" ON public.omnia_crm_origens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN' = ANY(roles)
    )
  );

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_omnia_crm_origens_updated_at
  BEFORE UPDATE ON public.omnia_crm_origens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX idx_omnia_crm_origens_name ON public.omnia_crm_origens(name);
CREATE INDEX idx_omnia_crm_origens_is_default ON public.omnia_crm_origens(is_default);

-- Comentários para documentação
COMMENT ON TABLE public.omnia_crm_origens IS 'Tabela para gerenciar as origens dos leads do CRM';
COMMENT ON COLUMN public.omnia_crm_origens.name IS 'Nome da origem do lead';
COMMENT ON COLUMN public.omnia_crm_origens.color IS 'Cor em formato hexadecimal para identificação visual';
COMMENT ON COLUMN public.omnia_crm_origens.is_default IS 'Indica se esta é a origem padrão para novos leads';