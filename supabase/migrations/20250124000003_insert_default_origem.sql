-- Migração: Inserir origem padrão
-- Data: 2025-01-24
-- Descrição: Insere a origem padrão na tabela omnia_crm_origens

-- Inserir origem padrão
INSERT INTO public.omnia_crm_origens (name, color, is_default)
VALUES ('Site', '#3b82f6', true)
ON CONFLICT DO NOTHING;

-- Garantir que apenas uma origem seja padrão
-- Se houver múltiplas origens marcadas como padrão, manter apenas a primeira
UPDATE public.omnia_crm_origens 
SET is_default = false 
WHERE is_default = true 
AND id NOT IN (
  SELECT id 
  FROM public.omnia_crm_origens 
  WHERE is_default = true 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- Comentário para documentação
COMMENT ON TABLE public.omnia_crm_origens IS 'Tabela para gerenciar as origens dos leads do CRM - origem padrão inserida';