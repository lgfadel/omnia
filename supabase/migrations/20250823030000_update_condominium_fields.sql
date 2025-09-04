-- Migração para alterar campos syndic_id e manager_id para syndic_name e manager_name
-- Esta migração deve ser executada se a tabela foi criada com os campos antigos

-- Verificar se os campos antigos existem e fazer a alteração
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Verificar se syndic_id existe e alterar para syndic_name
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'omnia_condominiums' 
               AND column_name = 'syndic_id') THEN
        
        -- Remover índice se existir
        DROP INDEX IF EXISTS idx_omnia_condominiums_syndic_id;
        
        -- Buscar e remover constraints de chave estrangeira para syndic_id
        FOR constraint_name IN 
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'omnia_condominiums' 
                AND kcu.column_name = 'syndic_id'
                AND tc.constraint_type = 'FOREIGN KEY'
        LOOP
            EXECUTE 'ALTER TABLE omnia_condominiums DROP CONSTRAINT ' || constraint_name;
            RAISE NOTICE 'Removida constraint: %', constraint_name;
        END LOOP;
        
        -- Alterar tipo da coluna de UUID para TEXT
        ALTER TABLE omnia_condominiums 
        ALTER COLUMN syndic_id TYPE TEXT;
        
        -- Renomear a coluna
        ALTER TABLE omnia_condominiums 
        RENAME COLUMN syndic_id TO syndic_name;
        
        RAISE NOTICE 'Campo syndic_id alterado para syndic_name';
    ELSE
        RAISE NOTICE 'Campo syndic_id não existe ou já foi alterado';
    END IF;
    
    -- Verificar se manager_id existe e alterar para manager_name
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'omnia_condominiums' 
               AND column_name = 'manager_id') THEN
        
        -- Remover índice se existir
        DROP INDEX IF EXISTS idx_omnia_condominiums_manager_id;
        
        -- Buscar e remover constraints de chave estrangeira para manager_id
        FOR constraint_name IN 
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'omnia_condominiums' 
                AND kcu.column_name = 'manager_id'
                AND tc.constraint_type = 'FOREIGN KEY'
        LOOP
            EXECUTE 'ALTER TABLE omnia_condominiums DROP CONSTRAINT ' || constraint_name;
            RAISE NOTICE 'Removida constraint: %', constraint_name;
        END LOOP;
        
        -- Alterar tipo da coluna de UUID para TEXT
        ALTER TABLE omnia_condominiums 
        ALTER COLUMN manager_id TYPE TEXT;
        
        -- Renomear a coluna
        ALTER TABLE omnia_condominiums 
        RENAME COLUMN manager_id TO manager_name;
        
        RAISE NOTICE 'Campo manager_id alterado para manager_name';
    ELSE
        RAISE NOTICE 'Campo manager_id não existe ou já foi alterado';
    END IF;
END $$;

-- Comentário explicativo
COMMENT ON COLUMN omnia_condominiums.syndic_name IS 'Nome do síndico como texto livre (anteriormente syndic_id)';
COMMENT ON COLUMN omnia_condominiums.manager_name IS 'Nome do gerente como texto livre (anteriormente manager_id)';