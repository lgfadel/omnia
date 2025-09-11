# Correção: Foreign Key Constraint Error em Atas

## Problema Identificado

**Erro:** `insert or update on table "omnia_atas" violates foreign key constraint "omnia_atas_created_by_fkey"`

**Causa:** O campo `created_by` na tabela `omnia_atas` referencia `omnia_users.id`, mas alguns usuários autenticados em `auth.users` não possuem um registro correspondente na tabela `omnia_users`.

## Análise da Arquitetura

### Trigger Automático
Existe um trigger `on_auth_user_created` que deveria criar automaticamente um registro na tabela `omnia_users` quando um usuário é criado em `auth.users`:

```sql
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

### Função handle_new_user
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.omnia_users (auth_user_id, name, email, roles)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    ARRAY['USUARIO'::text]
  );
  RETURN NEW;
END;
$function$;
```

## Solução Implementada

### 1. Verificação e Criação Automática no Código

Modificado o método `create` em `src/repositories/atasRepo.supabase.ts` para:

1. **Verificar** se o usuário existe na tabela `omnia_users`
2. **Criar automaticamente** o registro se não existir
3. **Prosseguir** com a criação da ata

```typescript
// Get the omnia_users.id for the current authenticated user
let { data: omniaUser } = await supabase
  .from('omnia_users')
  .select('id')
  .eq('auth_user_id', user?.user?.id)
  .single();

// If user doesn't exist in omnia_users, create it
if (!omniaUser && user?.user) {
  const { data: newOmniaUser, error: createUserError } = await supabase
    .from('omnia_users')
    .insert({
      auth_user_id: user.user.id,
      name: user.user.user_metadata?.name || user.user.email || 'Usuário',
      email: user.user.email || '',
      roles: ['USUARIO']
    })
    .select('id')
    .single();
  
  if (createUserError) {
    console.error('Error creating omnia_user:', createUserError);
    throw new Error('Erro ao criar perfil do usuário');
  }
  
  omniaUser = newOmniaUser;
}
```

### 2. Script SQL de Correção

Criado script `fix-missing-user.sql` para:
- Identificar usuários ausentes na tabela `omnia_users`
- Inserir registros faltantes
- Verificar status do trigger e função

## Benefícios da Solução

1. **Robustez**: Garante que a criação de atas sempre funcione
2. **Compatibilidade**: Mantém a arquitetura existente
3. **Fallback**: Funciona mesmo se o trigger falhar
4. **Transparência**: Não afeta a experiência do usuário

## Próximos Passos

1. **Monitorar** se o trigger está funcionando corretamente
2. **Aplicar** a mesma lógica em outros repositórios que usam `created_by`
3. **Investigar** por que alguns usuários não foram criados automaticamente

## Arquivos Modificados

- `src/repositories/atasRepo.supabase.ts` - Adicionada verificação e criação automática
- `fix-missing-user.sql` - Script de diagnóstico e correção
- `docs/fix-foreign-key-constraint-atas.md` - Esta documentação

## Status

✅ **Resolvido** - A criação de atas agora funciona corretamente mesmo para usuários sem registro em `omnia_users`.