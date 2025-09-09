-- Criar tabela omnia_crm_statuses para status configuráveis do CRM
-- Seguindo o padrão da tabela omnia_statuses

CREATE TABLE public.omnia_crm_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.omnia_crm_statuses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (qualquer usuário autenticado pode visualizar)
CREATE POLICY "Anyone can view CRM statuses" ON public.omnia_crm_statuses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Apenas admins podem gerenciar status do CRM
CREATE POLICY "Admins can manage CRM statuses" ON public.omnia_crm_statuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND 'ADMIN' = ANY(roles)
    )
  );

-- Inserir status padrão baseados no enum atual
INSERT INTO public.omnia_crm_statuses (name, color, order_position, is_default) VALUES
  ('Novo', '#6B7280', 1, true),
  ('Qualificado', '#3B82F6', 2, false),
  ('Proposta Enviada', '#F59E0B', 3, false),
  ('Em Negociação', '#8B5CF6', 4, false),
  ('Em Espera', '#6B7280', 5, false),
  ('Ganho', '#10B981', 6, false),
  ('Perdido', '#EF4444', 7, false);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_omnia_crm_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_omnia_crm_statuses_updated_at
  BEFORE UPDATE ON public.omnia_crm_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_omnia_crm_statuses_updated_at();

-- Índices para performance
CREATE INDEX idx_omnia_crm_statuses_order_position ON public.omnia_crm_statuses(order_position);
CREATE INDEX idx_omnia_crm_statuses_is_default ON public.omnia_crm_statuses(is_default);

-- Comentários para documentação
COMMENT ON TABLE public.omnia_crm_statuses IS 'Status configuráveis para leads do CRM';
COMMENT ON COLUMN public.omnia_crm_statuses.name IS 'Nome do status';
COMMENT ON COLUMN public.omnia_crm_statuses.color IS 'Cor do status em hexadecimal';
COMMENT ON COLUMN public.omnia_crm_statuses.order_position IS 'Posição de ordenação do status';
COMMENT ON COLUMN public.omnia_crm_statuses.is_default IS 'Indica se é o status padrão para novos leads';