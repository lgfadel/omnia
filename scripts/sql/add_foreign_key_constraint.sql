-- Script para adicionar constraint de chave estrangeira entre omnia_tickets e omnia_crm_leads
-- Este script deve ser executado manualmente no banco de dados APÓS o script add_oportunidade_id_column.sql
-- Data de criação: $(date)
-- Descrição: Cria constraint de chave estrangeira para garantir integridade referencial

-- Verificar se a constraint já existe antes de adicionar
DO $$
BEGIN
    -- Verificar se a constraint já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'omnia_tickets' 
        AND constraint_name = 'fk_omnia_tickets_oportunidade_id'
    ) THEN
        -- Adicionar constraint de chave estrangeira
        ALTER TABLE public.omnia_tickets 
        ADD CONSTRAINT fk_omnia_tickets_oportunidade_id 
        FOREIGN KEY (oportunidade_id) 
        REFERENCES public.omnia_crm_leads(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
        
        RAISE NOTICE 'Constraint de chave estrangeira fk_omnia_tickets_oportunidade_id adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Constraint fk_omnia_tickets_oportunidade_id já existe';
    END IF;
END
$$;

-- Criar índice para melhorar performance das consultas
DO $$
BEGIN
    -- Verificar se o índice já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'omnia_tickets' 
        AND indexname = 'idx_omnia_tickets_oportunidade_id'
    ) THEN
        -- Criar índice na coluna oportunidade_id
        CREATE INDEX idx_omnia_tickets_oportunidade_id 
        ON public.omnia_tickets(oportunidade_id) 
        WHERE oportunidade_id IS NOT NULL;
        
        RAISE NOTICE 'Índice idx_omnia_tickets_oportunidade_id criado com sucesso';
    ELSE
        RAISE NOTICE 'Índice idx_omnia_tickets_oportunidade_id já existe';
    END IF;
END
$$;