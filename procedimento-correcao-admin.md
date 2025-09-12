# Procedimento para Correção do Acesso Negado - Usuário ADMIN

## Problema Identificado

O usuário ADMIN não consegue acessar a página `/config/usuarios`, recebendo "Acesso Negado" mesmo tendo as permissões corretas configuradas.

## Diagnóstico Realizado

Baseado na análise das políticas RLS da tabela `omnia_users`, identificamos que:

1. ✅ Existe a política "Admins can manage users" que usa `is_current_user_admin()`
2. ❓ A função `is_current_user_admin()` pode não estar funcionando corretamente
3. ❓ Pode haver problema de autenticação ou configuração de roles

## Procedimento de Correção

### Passo 1: Diagnóstico Detalhado

Execute o arquivo `test-admin-function.sql` no Supabase Dashboard:

```bash
# Arquivo: test-admin-function.sql
```

Este arquivo irá verificar:
- Se o usuário está autenticado (`auth.uid()`)
- Se o usuário existe na tabela `omnia_users`
- Se a função `is_current_user_admin()` está funcionando
- Se as políticas RLS estão ativas

### Passo 2: Análise dos Resultados

**Se `auth.uid()` retornar `null`:**
- Problema de autenticação no Supabase
- Verificar se o usuário está logado corretamente
- Verificar configuração do cliente Supabase

**Se o usuário não existir na `omnia_users`:**
- Executar as correções do `fix-admin-permissions.sql` (CORREÇÃO 4)

**Se `is_current_user_admin()` retornar `false` mas o usuário tem role ADMIN:**
- Executar `fix-admin-function.sql`

**Se a função retornar erro:**
- Executar `fix-admin-function.sql`

### Passo 3: Aplicar Correções

#### 3.1 Correção da Função (se necessário)

Execute `fix-admin-function.sql` que irá:
- Recriar a função `is_current_user_admin()` com melhor tratamento de erros
- Recriar a política RLS
- Adicionar permissões corretas

#### 3.2 Correções de Permissões (se necessário)

Execute as correções específicas do `fix-admin-permissions.sql`:
- CORREÇÃO 1: Criar menu item se não existir
- CORREÇÃO 2: Adicionar permissão de role
- CORREÇÃO 3: Remover permissões negativas
- CORREÇÃO 4: Adicionar role ADMIN ao usuário
- CORREÇÃO 5: Forçar permissão específica

### Passo 4: Verificação Final

Após aplicar as correções:

1. Execute novamente `test-admin-function.sql`
2. Verifique se `is_current_user_admin()` retorna `true`
3. Teste o acesso à página `/config/usuarios` na aplicação

## Arquivos Criados

1. **`test-admin-function.sql`** - Diagnóstico completo da função e políticas RLS
2. **`fix-admin-function.sql`** - Correção da função `is_current_user_admin()`
3. **`debug-admin-permissions.sql`** - Diagnóstico das permissões (já existente)
4. **`fix-admin-permissions.sql`** - Correções das permissões (já existente)
5. **`fix-permissions-function.sql`** - Correção da função de resumo (já existente)

## Ordem de Execução Recomendada

1. `fix-permissions-function.sql` (corrige função com erro de tipo)
2. `test-admin-function.sql` (diagnóstico)
3. `fix-admin-function.sql` (se a função estiver com problema)
4. `debug-admin-permissions.sql` (diagnóstico de permissões)
5. `fix-admin-permissions.sql` (correções específicas conforme necessário)

## Possíveis Causas Raiz

1. **Função `is_current_user_admin()` com erro** - Mais provável
2. **Usuário não autenticado no Supabase** - Crítico
3. **Role ADMIN não atribuída ao usuário** - Configuração
4. **Menu item `/config/usuarios` não existe** - Dados
5. **Permissão específica negando acesso** - Configuração

## Contato para Suporte

Se o problema persistir após seguir este procedimento, documente:
- Resultados do `test-admin-function.sql`
- Quais correções foram aplicadas
- Mensagens de erro específicas