# Sincronização de Usuários entre auth.users e omnia_users

## Problema Identificado

Durante a análise do problema de "Acesso Negado" do usuário ADMIN, foi identificada uma **discrepância crítica** entre as tabelas `auth.users` e `omnia_users`:

- **auth.users**: 6 usuários registrados
- **omnia_users**: apenas 2 usuários (ambos ADMIN)
- **Resultado**: 4 usuários autenticados não conseguem acessar o sistema

## Análise Detalhada

### Usuários em auth.users
```sql
-- 6 usuários encontrados:
1. euro@euro.adm.br (b9071d69-db25-4ce7-bd2c-cf26ae8af93e)
2. teste@loovus.comm.br (765f1b8a-1baf-465d-b192-0f4bf50090ab) ✅ SINCRONIZADO
3. londrina@euro.adm.br (61718e0c-0081-4a9a-82b3-0612a2575592)
4. joao.fernandes@euro.adm.br (6cf5a5f8-b748-4f7a-b4d2-87fbf583a649)
5. fabio.silva@euro.adm.br (aa289518-2960-4f8d-95e1-2ec80f4897ad)
6. gfadel@gmail.com (85fabf36-e30a-49bc-b1a6-0d7e3ae8f1b0) ✅ SINCRONIZADO
```

### Usuários em omnia_users
```sql
-- 2 usuários ADMIN encontrados:
1. Gustavo Fadel (gfadel@gmail.com) - ADMIN, SECRETARIO
2. Teste (teste@loovus.comm.br) - ADMIN
```

### Usuários Faltantes
**4 usuários** precisam ser sincronizados:
1. `euro@euro.adm.br`
2. `londrina@euro.adm.br`
3. `joao.fernandes@euro.adm.br`
4. `fabio.silva@euro.adm.br`

## Solução Implementada

### 1. Scripts Criados

#### `analise-sincronizacao-usuarios.sql`
- **Objetivo**: Analisar discrepâncias entre as tabelas
- **Funcionalidade**: Identifica usuários faltantes, órfãos e sincronizados
- **Uso**: Diagnóstico inicial

#### `sincronizar-usuarios-faltantes.sql`
- **Objetivo**: Sincronizar os 4 usuários faltantes
- **Funcionalidade**: Insere usuários com roles apropriados
- **Uso**: Correção imediata do problema

#### `trigger-sincronizacao-automatica.sql`
- **Objetivo**: Prevenir futuras discrepâncias
- **Funcionalidade**: Trigger automático + função de sincronização manual
- **Uso**: Manutenção contínua

### 2. Critérios de Roles

| Padrão de Email | Role Atribuído | Exemplo |
|---|---|---|
| `@euro.adm.br` genéricos | `ADMIN` | euro@, londrina@ |
| `@euro.adm.br` com nomes | `SECRETARIO` | joao.fernandes@, fabio.silva@ |
| `@loovus.%` | `ADMIN` | teste@loovus.comm.br |
| Outros domínios | `SECRETARIO` | Padrão para novos usuários |

### 3. Nomes Inferidos

O sistema infere nomes baseado nos emails:
- `euro@euro.adm.br` → "Euro Administração"
- `londrina@euro.adm.br` → "Euro Londrina"
- `joao.fernandes@euro.adm.br` → "João Fernandes"
- `fabio.silva@euro.adm.br` → "Fábio Silva"

## Procedimento de Execução

### Passo 1: Análise (Opcional)
```bash
# Execute para confirmar o problema
psql -f analise-sincronizacao-usuarios.sql
```

### Passo 2: Sincronização Imediata
**IMPORTANTE**: Use o script corrigido que evita duplicatas:
```bash
# Sincroniza os 4 usuários faltantes
psql -f sincronizar-usuarios-faltantes-corrigido.sql
```

### Passo 3: Configuração Automática
```bash
# Instala trigger para futuras sincronizações
psql -f trigger-sincronizacao-automatica.sql
```

### Passo 4: Sincronização Manual (se necessário)
```sql
-- Para sincronizar usuários faltantes no futuro
SELECT * FROM manual_sync_all_users();
```

## Verificação Pós-Execução

### 1. Contagem de Usuários
```sql
SELECT 'auth.users' as tabela, count(*) as total FROM auth.users
UNION ALL
SELECT 'omnia_users' as tabela, count(*) as total FROM omnia_users;
```
**Resultado esperado**: Ambas as tabelas com 6 usuários

### 2. Verificação de Roles
```sql
SELECT name, email, roles FROM omnia_users ORDER BY created_at DESC;
```

### 3. Teste de Autenticação
- Faça login com cada usuário sincronizado
- Verifique se o "Acesso Negado" foi resolvido
- Confirme que as permissões estão funcionando

## Prevenção de Problemas Futuros

### Trigger Automático
O trigger `trigger_sync_new_user` foi configurado para:
- **Ativar**: Sempre que um novo usuário for criado em `auth.users`
- **Ação**: Criar automaticamente o registro correspondente em `omnia_users`
- **Roles**: Aplicar regras baseadas no domínio do email
- **Segurança**: Não falha se houver erro (apenas registra warning)

### Monitoramento
```sql
-- Query para monitorar sincronização
SELECT 
    (SELECT count(*) FROM auth.users) as auth_users,
    (SELECT count(*) FROM omnia_users) as omnia_users,
    (SELECT count(*) FROM auth.users au 
     LEFT JOIN omnia_users ou ON au.id = ou.id 
     WHERE ou.id IS NULL) as faltantes;
```

## Impacto na Resolução do "Acesso Negado"

### Antes da Sincronização
- Usuários autenticados em `auth.users` mas sem registro em `omnia_users`
- Função `is_current_user_admin()` retorna `false` ou `null`
- RLS policies bloqueiam acesso
- Resultado: "Acesso Negado"

### Após a Sincronização
- Todos os usuários autenticados têm registro em `omnia_users`
- Função `is_current_user_admin()` funciona corretamente
- RLS policies permitem acesso baseado em roles
- Resultado: Acesso liberado conforme permissões

## Arquivos Relacionados

- `analise-sincronizacao-usuarios.sql` - Análise de discrepâncias
- `sincronizar-usuarios-faltantes.sql` - Correção imediata
- `trigger-sincronizacao-automatica.sql` - Prevenção futura
- `diagnostico-acesso-negado.md` - Diagnóstico do problema original
- `procedimento-correcao-admin.md` - Procedimento de correção ADMIN

## Correção de Erro de Duplicata

### Problema Identificado
Ao executar o script original `sincronizar-usuarios-faltantes.sql`, pode ocorrer o erro:
```
ERROR: 23505: duplicate key value violates unique constraint "omnia_users_email_key"
DETAIL: Key (email)=(euro@euro.adm.br) already exists.
```

### Solução Implementada
Criado o script corrigido `sincronizar-usuarios-faltantes-corrigido.sql` com:

1. **ON CONFLICT (email) DO NOTHING**: Evita erros de duplicata
2. **Verificação dupla**: NOT EXISTS para ID e EMAIL
3. **Sincronização genérica**: Captura automaticamente qualquer usuário faltante
4. **Lógica robusta**: Tratamento de nomes e roles mais inteligente

### Uso Recomendado
- **Sempre use o script corrigido** para evitar erros
- O script original pode ser mantido para referência histórica
- O script corrigido é idempotente (pode ser executado múltiplas vezes)

## Conclusão

A sincronização entre `auth.users` e `omnia_users` é **fundamental** para o funcionamento correto do sistema de permissões OMNIA. Este procedimento:

1. ✅ **Resolve** o problema imediato de "Acesso Negado"
2. ✅ **Previne** futuras discrepâncias com trigger automático
3. ✅ **Mantém** a integridade da arquitetura de permissões
4. ✅ **Documenta** o processo para manutenção futura
5. ✅ **Protege** contra duplicatas com scripts seguros para re-execução

**Recomendação**: Execute os scripts na ordem apresentada e monitore regularmente a sincronização entre as tabelas.