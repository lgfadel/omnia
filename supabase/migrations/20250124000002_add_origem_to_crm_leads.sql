-- Migração: Adicionar campo origem_id na tabela omnia_crm_leads
-- Data: 2025-01-24
-- Descrição: Adiciona referência para a origem do lead

-- Adicionar coluna origem_id na tabela omnia_crm_leads
ALTER TABLE public.omnia_crm_leads 
ADD COLUMN origem_id uuid REFERENCES public.omnia_crm_origens(id);

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_omnia_crm_leads_origem_id ON public.omnia_crm_leads(origem_id);

-- Comentário para documentação
COMMENT ON COLUMN public.omnia_crm_leads.origem_id IS 'Referência para a origem do lead (tabela omnia_crm_origens)';