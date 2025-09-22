-- Script de Seed: Origens padrão para leads do CRM
-- Data: 2025-01-24
-- Descrição: Insere origens padrão para os leads do CRM

-- Inserir origens padrão
INSERT INTO public.omnia_crm_origens (name, color, is_default) VALUES
('Indicação', '#10b981', true),
('Site/Internet', '#3b82f6', false),
('Redes Sociais', '#8b5cf6', false),
('Telefone', '#f59e0b', false),
('Email Marketing', '#ef4444', false),
('Evento/Feira', '#06b6d4', false),
('Parceria', '#84cc16', false),
('Publicidade', '#ec4899', false);

-- Verificar se as origens foram inseridas
SELECT 
  name,
  color,
  is_default,
  created_at
FROM public.omnia_crm_origens
ORDER BY name;