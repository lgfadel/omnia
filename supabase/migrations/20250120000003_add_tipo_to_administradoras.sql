-- Migração: Adicionar campo "tipo" à tabela omnia_administradoras
-- Data: 2025-01-20
-- Descrição: Adiciona coluna obrigatória "tipo" com valores permitidos

-- IMPORTANTE: Execute este script durante horário de menor movimento
-- IMPORTANTE: Faça backup completo do banco antes da execução

BEGIN;

-- 1. Adicionar a coluna tipo como opcional inicialmente
ALTER TABLE omnia_administradoras 
ADD COLUMN tipo VARCHAR(50);

-- 2. Criar constraint para valores permitidos
ALTER TABLE omnia_administradoras 
ADD CONSTRAINT check_tipo_values 
CHECK (tipo IN ('Administradora', 'Contabilidade', 'Construtora', 'Advogado'));

-- 3. Atualizar registros existentes com valor padrão
UPDATE omnia_administradoras 
SET tipo = 'Administradora' 
WHERE tipo IS NULL;

-- 4. Tornar a coluna obrigatória (NOT NULL)
ALTER TABLE omnia_administradoras 
ALTER COLUMN tipo SET NOT NULL;

-- 5. Criar índice para otimização de consultas por tipo
CREATE INDEX idx_omnia_administradoras_tipo ON omnia_administradoras(tipo);

-- 6. Atualizar comentário da tabela
COMMENT ON COLUMN omnia_administradoras.tipo IS 'Tipo da administradora: Administradora, Contabilidade, Construtora ou Advogado';

COMMIT;

-- Script de verificação (execute após a migração):
-- SELECT tipo, COUNT(*) FROM omnia_administradoras GROUP BY tipo;
-- SELECT * FROM omnia_administradoras WHERE tipo IS NULL; -- Deve retornar 0 registros