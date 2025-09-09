-- Script para inserir status padrão do CRM caso a tabela esteja vazia
-- Execute este script se os status do CRM não estiverem aparecendo

-- Verificar se a tabela está vazia e inserir status padrão
INSERT INTO public.omnia_crm_statuses (name, color, order_position, is_default)
SELECT * FROM (
  VALUES 
    ('Novo', '#6B7280', 1, true),
    ('Qualificado', '#3B82F6', 2, false),
    ('Proposta Enviada', '#F59E0B', 3, false),
    ('Em Negociação', '#8B5CF6', 4, false),
    ('Em Espera', '#6B7280', 5, false),
    ('Ganho', '#10B981', 6, false),
    ('Perdido', '#EF4444', 7, false)
) AS v(name, color, order_position, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM public.omnia_crm_statuses
);

-- Verificar se foi inserido
SELECT * FROM public.omnia_crm_statuses ORDER BY order_position;