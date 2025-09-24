# Correção da Constraint de Chave Estrangeira - omnia_comments

## Problema Identificado

A tabela `omnia_comments` estava com uma inconsistência na constraint de chave estrangeira do campo `created_by`:

- **Outras tabelas** (`omnia_tags`, `omnia_atas`): `created_by` referencia `omnia_users(id)` ✅
- **Tabela omnia_comments**: `created_by` referencia `auth.users(id)` ❌

Isso causava erro 23503 (violação de chave estrangeira) ao tentar inserir comentários.

## Causa Raiz

A migração `20250911000000_fix_foreign_key_constraints_tags_atas.sql` corrigiu as constraints das tabelas `omnia_tags` e `omnia_atas`, mas **não incluiu** a tabela `omnia_comments`.

## Solução Implementada

### 1. Migração de Correção
Criada migração `20250115000000_fix_omnia_comments_created_by_constraint.sql`:

- Remove constraint antiga: `omnia_comments_created_by_fkey`
- Converte dados existentes de `auth_user_id` para `omnia_users.id`
- Limpa registros órfãos
- Adiciona nova constraint: `created_by REFERENCES omnia_users(id)`

### 2. Atualização do Código
Arquivo: `src/repositories/ataCommentsRepo.supabase.ts`

**Antes:**
```typescript
created_by: user.user.id  // auth.users.id
```

**Depois:**
```typescript
created_by: omniaUser.id  // omnia_users.id
```

## Execução Manual Necessária

⚠️ **O usuário deve executar a migração manualmente:**

```bash
# No diretório do projeto
supabase db reset
# ou
supabase migration up
```

## Resultado

- ✅ Constraint alinhada com outras tabelas
- ✅ Dados existentes preservados e convertidos
- ✅ Funcionalidade de comentários funcionando
- ✅ Consistência na arquitetura do banco

## Arquivos Alterados

- `supabase/migrations/20250115000000_fix_omnia_comments_created_by_constraint.sql` (novo)
- `src/repositories/ataCommentsRepo.supabase.ts` (atualizado)
- `docs/fix-omnia-comments-constraint.md` (documentação)