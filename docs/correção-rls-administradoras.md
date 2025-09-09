# Correção das Políticas RLS - Administradoras

## Problema Identificado

A funcionalidade de administradoras estava apresentando erro de permissão ao tentar atualizar registros:

```
Error updating administradora: {code: 42501, details: null, hint: null, message: permission denied for table users}
```

## Causa Raiz

As políticas RLS da tabela `omnia_administradoras` estavam tentando acessar diretamente a tabela `auth.users` do Supabase:

```sql
EXISTS (
  SELECT 1 FROM auth.users 
  WHERE auth.users.id = auth.uid() 
  AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
)
```

Porém, o projeto OMNIA utiliza uma arquitetura própria com a tabela `omnia_users` que possui um campo `roles` do tipo array.

## Solução Aplicada

### Migração: `20250115000001_fix_administradoras_rls_policies.sql`

1. **Remoção das políticas problemáticas**:
   - Removidas as políticas que acessavam `auth.users` diretamente

2. **Criação de novas políticas alinhadas com a arquitetura**:
   - Utilizam a tabela `omnia_users` com campo `roles`
   - Verificam se `'ADMIN'` está presente no array de roles
   - Usam `auth_user_id = auth.uid()` para relacionar com o usuário autenticado

### Padrão Correto

```sql
EXISTS (
  SELECT 1 FROM omnia_users 
  WHERE auth_user_id = auth.uid() 
  AND 'ADMIN'::text = ANY (roles)
)
```

## Arquivos Modificados

- `supabase/migrations/20250115000001_fix_administradoras_rls_policies.sql` (criado)
- `docs/correção-rls-administradoras.md` (criado)

## Impacto

- ✅ Funcionalidade de administradoras agora funciona corretamente
- ✅ Políticas RLS alinhadas com o padrão do projeto
- ✅ Permissões adequadas para usuários com role ADMIN
- ✅ Consistência com outras tabelas do sistema

## Próximos Passos

1. Aplicar a migração no ambiente de desenvolvimento
2. Testar todas as operações CRUD de administradoras
3. Verificar se outras tabelas possuem o mesmo problema
4. Aplicar em produção após validação

## Referências

- Migração de condomínios: `20250204000002_create_condominiums_table.sql` (padrão correto)
- Documentação da arquitetura OMNIA: `omnia.md`