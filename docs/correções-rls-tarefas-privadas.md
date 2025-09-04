# Correções RLS - Tarefas Privadas

## Problema Identificado

O sistema estava apresentando erros de violação de chave estrangeira ao criar tarefas privadas devido a inconsistências entre:

1. **Código da aplicação**: Usando `auth_user_id` (UUID do Supabase Auth) no campo `assigned_to`
2. **Estrutura do banco**: Campo `assigned_to` referencia `omnia_users.id`, não `auth_user_id`
3. **Políticas RLS**: Comparando `assigned_to` com `auth.uid()` em vez de `omnia_users.id`

## Correções Implementadas

### 1. Repositório de Tarefas (`src/repositories/tarefasRepo.supabase.ts`)

#### Função `create()`
- **Antes**: `assigned_to: currentUser?.user?.id` (auth_user_id)
- **Depois**: `assigned_to: userProfile?.id` (omnia_users.id)

#### Função `update()`
- **Antes**: `assigned_to: currentUser?.user?.id` (auth_user_id)
- **Depois**: Busca `userProfile?.id` usando `auth_user_id` e usa `omnia_users.id`

### 2. Interface de Usuário (`src/pages/Tickets.tsx`)

#### Função `handleResponsibleChange()`
- Adicionada validação para impedir alteração de responsável em tarefas privadas
- Exibe alerta informativo quando tentativa é feita

### 3. Formulário de Tarefas (`src/components/tickets/TicketForm.tsx`)

#### Validação removida
- Removida validação que impedia atribuição de responsável a tarefas privadas
- Agora o usuário logado é automaticamente o responsável

## Migração Pendente

### Arquivo: `supabase/migrations/20250127000001_fix_private_tickets_rls.sql`

**IMPORTANTE**: Esta migração precisa ser aplicada no banco de dados para corrigir as políticas RLS.

#### Políticas corrigidas:

1. **Política de Criação**:
   ```sql
   -- Antes
   assigned_to = auth.uid()
   
   -- Depois
   assigned_to = (SELECT id FROM omnia_users WHERE auth_user_id = auth.uid())
   ```

2. **Política de Atualização**:
   ```sql
   -- Antes
   created_by = auth.uid()
   
   -- Depois
   created_by = (SELECT id FROM omnia_users WHERE auth_user_id = auth.uid())
   ```

## Como Aplicar a Migração

### Opção 1: Supabase CLI (Recomendado)
```bash
supabase link --project-ref elmxwvimjxcswjbrzznq
supabase db push
```

### Opção 2: Dashboard do Supabase
1. Acesse o Dashboard do Supabase
2. Vá para SQL Editor
3. Execute o conteúdo do arquivo `20250127000001_fix_private_tickets_rls.sql`

### Opção 3: MCP Supabase (Se disponível)
```javascript
apply_migration({
  name: "fix_private_tickets_rls",
  query: "[conteúdo da migração]"
})
```

## Validação das Correções

### Testes a realizar:

1. **Criação de tarefa privada**:
   - Usuário deve conseguir criar tarefa privada
   - Campo `assigned_to` deve ser preenchido automaticamente
   - Não deve haver erro de chave estrangeira

2. **Visualização de tarefa privada**:
   - Apenas o criador e admins devem ver a tarefa
   - Outros usuários não devem ter acesso

3. **Edição de tarefa privada**:
   - Apenas o criador e admins devem conseguir editar
   - Campo `assigned_to` deve manter consistência

## Status Atual

- ✅ **Código da aplicação**: Corrigido
- ✅ **Arquivo de migração**: Criado
- ⏳ **Migração no banco**: Pendente de aplicação
- ⏳ **Testes**: Pendentes após aplicação da migração

## Próximos Passos

1. Aplicar a migração no banco de dados
2. Testar criação de tarefas privadas
3. Validar políticas RLS
4. Documentar resultados dos testes