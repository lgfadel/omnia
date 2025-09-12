# Correções de Nomenclatura de Tabelas - OMNIA

## Status: ✅ Correções no Código Aplicadas

### Resumo
Todas as correções relacionadas aos nomes das tabelas foram aplicadas no código da aplicação. As tabelas `menu_items` e `role_permissions` foram renomeadas para seguir o padrão `omnia_` em todos os arquivos relevantes.

### Alterações Realizadas

#### 1. Criação de Migração
- **Arquivo**: `supabase/migrations/20250115000004_rename_tables_to_omnia_prefix.sql`
- **Objetivo**: Renomear tabelas para seguir padrão `omnia_`
- **Tabelas afetadas**:
  - `menu_items` → `omnia_menu_items`
  - `role_permissions` → `omnia_role_permissions`
  - `user_permissions` → `omnia_user_permissions`

#### 2. Atualização dos Tipos TypeScript
- **Arquivo**: `src/integrations/supabase/types.ts`
- **Alterações**:
  - Renomeado `menu_items` para `omnia_menu_items`
  - Renomeado `role_permissions` para `omnia_role_permissions`
  - Renomeado `user_permissions` para `omnia_user_permissions`
  - Ajustado estrutura de campos conforme nova arquitetura
  - Atualizado relacionamentos e foreign keys

#### 3. Atualização dos Repositórios
- **Arquivo**: `src/repositories/menuItemsRepo.supabase.ts`
  - Alterado referências de `menu_items` para `omnia_menu_items`
- **Arquivo**: `src/repositories/rolePermissionsRepo.supabase.ts`
  - Alterado referências de `role_permissions` para `omnia_role_permissions`
  - Atualizado campo `role` para `role_name`
- **Arquivo**: `src/repositories/userPermissionsRepo.supabase.ts`
  - Alterado referências de `user_permissions` para `omnia_user_permissions`
  - Atualizado funções de permissão para usar novo prefixo

### Migrações Pendentes de Aplicação no Banco

⚠️ **IMPORTANTE**: As seguintes migrações precisam ser aplicadas no banco de dados de produção:

1. **20250115000004_rename_tables_to_omnia_prefix.sql**
   - Renomeia tabelas para padrão `omnia_`
   - Atualiza constraints e índices
   - Recria políticas RLS

2. **20250911000000_fix_foreign_key_constraints_tags_atas.sql**
   - Corrige foreign key constraints
   - Atualiza referências de `auth.users` para `omnia_users`

3. **20250127000001_fix_private_tickets_rls.sql**
   - Corrige políticas RLS para tickets privados

### Como Aplicar as Migrações

#### Opção 1: Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá para SQL Editor
3. Execute os scripts na ordem listada acima

#### Opção 2: Via CLI (quando credenciais estiverem configuradas)
```bash
# Configurar credenciais no .env
cp .env.example .env
# Editar .env com credenciais corretas

# Aplicar migrações
npx supabase db push
```

### Verificação Pós-Aplicação

Após aplicar as migrações, verificar:

1. **Tabelas renomeadas corretamente**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'omnia_%';
   ```

2. **Foreign keys funcionando**:
   ```sql
   SELECT * FROM omnia_tags LIMIT 5;
   SELECT * FROM omnia_atas LIMIT 5;
   ```

3. **Aplicação funcionando**:
   - Testar login
   - Testar criação de tickets
   - Testar upload de anexos
   - Verificar menus e permissões

### Arquivos Afetados

- ✅ `src/integrations/supabase/types.ts`
- ✅ `src/repositories/menuItemsRepo.supabase.ts`
- ✅ `src/repositories/rolePermissionsRepo.supabase.ts`
- ✅ `supabase/migrations/20250115000004_rename_tables_to_omnia_prefix.sql`

### Próximos Passos

1. Aplicar migrações no banco de dados
2. Testar aplicação em ambiente de produção
3. Monitorar logs para possíveis erros
4. Atualizar documentação se necessário

---

**Data**: 2025-01-15  
**Responsável**: Agente OMNIA  
**Status**: Código atualizado, migrações pendentes de aplicação no banco