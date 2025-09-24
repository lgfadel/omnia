-- Script para adicionar coluna oportunidade_id na tabela omnia_tickets
-- Este script deve ser executado manualmente no banco de dados
-- Data de criação: $(date)
-- Descrição: Adiciona campo opcional para vincular tarefas a oportunidades do CRM

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
    -- Verificar se a coluna oportunidade_id já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'omnia_tickets' 
        AND column_name = 'oportunidade_id'
    ) THEN
        -- Adicionar a coluna oportunidade_id como UUID opcional
        ALTER TABLE public.omnia_tickets 
        ADD COLUMN oportunidade_id UUID NULL;
        
        -- Adicionar comentário na coluna para documentação
        COMMENT ON COLUMN public.omnia_tickets.oportunidade_id IS 'ID da oportunidade do CRM vinculada à tarefa (opcional)';
        
        RAISE NOTICE 'Coluna oportunidade_id adicionada com sucesso à tabela omnia_tickets';
    ELSE
        RAISE NOTICE 'Coluna oportunidade_id já existe na tabela omnia_tickets';
    END IF;
END
$$;