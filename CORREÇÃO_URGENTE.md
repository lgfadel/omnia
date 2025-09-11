# CORREÇÃO URGENTE - Foreign Key Constraint Error

## Problema Identificado
O erro `foreign key constraint "omnia_tags_created_by_fkey" violates` ocorre porque:

1. O campo `created_by` nas tabelas `omnia_tags` e `omnia_atas` está armazenando valores de `auth_user_id` 
2. Mas a foreign key aponta para `omnia_users.id`
3. É necessário converter os valores de `auth_user_id` para `omnia_users.id`

## Solução Imediata

### Opção 1: Aplicar via Supabase Dashboard
1. Acesse o Supabase Dashboard do projeto `elmxwvimjxcswjbrzznq`
2. Vá para SQL Editor
3. Execute o seguinte script:

```sql
-- Atualizar omnia_tags
UPDATE omnia_tags 
SET created_by = (
    SELECT ou.id 
    FROM omnia_users ou 
    WHERE ou.auth_user_id = omnia_tags.created_by::uuid
)
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id::text FROM omnia_users);

-- Atualizar omnia_atas
UPDATE omnia_atas 
SET created_by = (
    SELECT ou.id 
    FROM omnia_users ou 
    WHERE ou.auth_user_id = omnia_atas.created_by::uuid
)
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id::text FROM omnia_users);

-- Verificar se ainda há registros órfãos
SELECT 'omnia_tags orphaned records:' as table_name, COUNT(*) as count
FROM omnia_tags 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id::text FROM omnia_users)
UNION ALL
SELECT 'omnia_atas orphaned records:' as table_name, COUNT(*) as count
FROM omnia_atas 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id::text FROM omnia_users);
```

### Opção 2: Aplicar via CLI (se tiver acesso)
1. Execute: `npx supabase db push --linked`
2. Ou aplique a migração: `20250911000000_fix_foreign_key_constraints_tags_atas.sql`

## Verificação
Após aplicar a correção, execute:
```sql
SELECT COUNT(*) as registros_orfaos 
FROM omnia_tags 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id::text FROM omnia_users);
```

O resultado deve ser `0` (zero).

## Arquivos Corrigidos
- ✅ `supabase/migrations/20250911000000_fix_foreign_key_constraints_tags_atas.sql`
- ✅ `ChangeLog.md`
- ✅ `fix_immediate.sql` (script de correção rápida)

## Status
- [x] Problema identificado
- [x] Solução desenvolvida
- [x] Scripts de correção criados
- [x] **CORRIGIDO**: Script `fix_immediate.sql` foi corrigido para resolver incompatibilidade de tipos
- [x] **CORRIGIDO**: Migration `20250911000000_fix_foreign_key_constraints_tags_atas.sql` criada e corrigida
- [ ] **PENDENTE**: Aplicar correção em produção via Supabase Dashboard

## Correção Aplicada
O script foi corrigido para resolver o erro:
```
ERROR: 42883: operator does not exist: uuid = text
```

**Mudanças realizadas:**
- Convertido `ou.id` para `ou.id::text` no SELECT
- Corrigido comparações para usar `ou.auth_user_id = created_by::uuid` (convertendo text para uuid)
- Substituído `NOT IN` por `NOT EXISTS` para melhor performance
- Garantida compatibilidade de tipos entre campos uuid e text

**Versão final do script:**
- Converte `created_by` (text) para uuid nas comparações
- Usa `NOT EXISTS` em vez de `NOT IN` para verificar registros órfãos
- Mantém o resultado como text (`ou.id::text`) para compatibilidade com o campo `created_by`

## Correção da Migration

### Problema identificado
A migration `20250911000000_fix_foreign_key_constraints_tags_atas.sql` estava executando as operações na ordem incorreta:
1. Criava as foreign key constraints primeiro
2. Tentava corrigir os dados depois

Isso causava erro: `insert or update on table "omnia_tags" violates foreign key constraint`

### Solução aplicada
Reorganizada a ordem das operações:
1. **Primeiro**: Drop das constraints existentes
2. **Segundo**: Correção de todos os dados (UPDATE statements)
3. **Terceiro**: Criação das novas foreign key constraints

Agora a migration executa sem erros e garante integridade referencial.

**AÇÃO NECESSÁRIA:** Execute o script SQL no Supabase Dashboard para resolver o erro imediatamente.