# Scripts SQL - Vinculação de Tarefas a Oportunidades

Este diretório contém os scripts SQL necessários para implementar a funcionalidade de vincular tarefas a oportunidades do CRM.

## Ordem de Execução

Execute os scripts na seguinte ordem:

### 1. `add_oportunidade_id_column.sql`
- **Descrição**: Adiciona a coluna `oportunidade_id` na tabela `omnia_tickets`
- **Função**: Permite armazenar o ID da oportunidade vinculada à tarefa
- **Características**:
  - Campo opcional (NULL permitido)
  - Tipo UUID para compatibilidade com `omnia_crm_leads.id`
  - Inclui verificação de existência para evitar erros em re-execuções

### 2. `add_foreign_key_constraint.sql`
- **Descrição**: Adiciona constraint de chave estrangeira e índice
- **Função**: Garante integridade referencial entre tarefas e oportunidades
- **Características**:
  - Constraint com `ON DELETE SET NULL` (se oportunidade for excluída, tarefa mantém-se sem vinculação)
  - Constraint com `ON UPDATE CASCADE` (se ID da oportunidade mudar, atualiza automaticamente)
  - Índice para otimizar consultas por oportunidade
  - Inclui verificações de existência para evitar erros

## Como Executar

1. Conecte-se ao banco de dados PostgreSQL/Supabase
2. Execute o primeiro script:
   ```sql
   \i add_oportunidade_id_column.sql
   ```
3. Execute o segundo script:
   ```sql
   \i add_foreign_key_constraint.sql
   ```

## Verificação

Para verificar se as alterações foram aplicadas corretamente:

```sql
-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'omnia_tickets' 
AND column_name = 'oportunidade_id';

-- Verificar se a constraint foi criada
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'omnia_tickets' 
AND constraint_name = 'fk_omnia_tickets_oportunidade_id';

-- Verificar se o índice foi criado
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'omnia_tickets' 
AND indexname = 'idx_omnia_tickets_oportunidade_id';
```

## Rollback (se necessário)

Para reverter as alterações:

```sql
-- Remover constraint
ALTER TABLE public.omnia_tickets 
DROP CONSTRAINT IF EXISTS fk_omnia_tickets_oportunidade_id;

-- Remover índice
DROP INDEX IF EXISTS public.idx_omnia_tickets_oportunidade_id;

-- Remover coluna
ALTER TABLE public.omnia_tickets 
DROP COLUMN IF EXISTS oportunidade_id;
```

## Impacto

- **Compatibilidade**: Mantém total compatibilidade com processos existentes
- **Performance**: Índice otimiza consultas por oportunidade
- **Integridade**: Constraint garante que apenas oportunidades válidas sejam vinculadas
- **Flexibilidade**: Campo opcional permite tarefas sem vinculação a oportunidades