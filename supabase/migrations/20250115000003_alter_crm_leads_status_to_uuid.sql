-- Migração para alterar coluna status de enum para UUID foreign key
-- Referenciando a tabela omnia_crm_statuses

-- Primeiro, adicionar nova coluna status_id como UUID
ALTER TABLE public.omnia_crm_leads 
ADD COLUMN status_id UUID REFERENCES public.omnia_crm_statuses(id);

-- Migrar dados existentes do enum para a nova coluna UUID
-- Mapear cada valor do enum para o ID correspondente na tabela de status
UPDATE public.omnia_crm_leads 
SET status_id = (
  SELECT id FROM public.omnia_crm_statuses 
  WHERE LOWER(name) = CASE 
    WHEN status = 'novo' THEN 'novo'
    WHEN status = 'qualificado' THEN 'qualificado'
    WHEN status = 'proposta_enviada' THEN 'proposta enviada'
    WHEN status = 'em_negociacao' THEN 'em negociação'
    WHEN status = 'on_hold' THEN 'em espera'
    WHEN status = 'ganho' THEN 'ganho'
    WHEN status = 'perdido' THEN 'perdido'
    ELSE 'novo' -- fallback para status padrão
  END
);

-- Definir status padrão para registros que não foram mapeados
UPDATE public.omnia_crm_leads 
SET status_id = (
  SELECT id FROM public.omnia_crm_statuses WHERE is_default = true LIMIT 1
)
WHERE status_id IS NULL;

-- Tornar a nova coluna NOT NULL
ALTER TABLE public.omnia_crm_leads 
ALTER COLUMN status_id SET NOT NULL;

-- Remover a coluna enum antiga
ALTER TABLE public.omnia_crm_leads 
DROP COLUMN status;

-- Renomear a nova coluna para 'status'
ALTER TABLE public.omnia_crm_leads 
RENAME COLUMN status_id TO status;

-- Adicionar índice para performance
CREATE INDEX idx_omnia_crm_leads_status ON public.omnia_crm_leads(status);

-- Remover o enum type se não estiver sendo usado em outros lugares
-- NOTA: Verificar se o enum crm_negotiation_status é usado em outras tabelas antes de remover
-- DROP TYPE IF EXISTS public.crm_negotiation_status;

-- Comentário para documentação
COMMENT ON COLUMN public.omnia_crm_leads.status IS 'Referência para o status configurável na tabela omnia_crm_statuses';

-- Atualizar função de trigger se existir para manter compatibilidade
-- (Verificar se há triggers que dependem da coluna status)