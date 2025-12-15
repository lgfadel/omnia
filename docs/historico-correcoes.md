# Histórico de Correções - OMNIA

Este documento consolida todas as correções implementadas no sistema OMNIA durante Janeiro/Fevereiro 2025. Todas as correções listadas abaixo foram **aplicadas com sucesso**.

---

## Correções de RLS (Row Level Security)

### Políticas RLS de Administradoras
- **Problema**: Erro 42501 ao atualizar administradoras
- **Causa**: Políticas tentavam acessar `auth.users` diretamente
- **Solução**: Migração `20250115000001_fix_administradoras_rls_policies.sql` para usar `omnia_users`
- **Status**: ✅ Resolvido

### Recursão Infinita em RLS
- **Problema**: Erro 42P17 recursão infinita na tabela `omnia_users`
- **Causa**: Política RLS consultava a própria tabela na condição USING
- **Solução**: Função auxiliar `is_current_user_admin()` com SECURITY DEFINER
- **Migração**: `20250117000007_fix_infinite_recursion_rls.sql`
- **Status**: ✅ Resolvido

### Tarefas Privadas - Política SELECT
- **Problema**: Tarefas privadas não apareciam para o criador
- **Causa**: Comparação incorreta `created_by = auth.uid()` (tipos diferentes)
- **Solução**: Subquery `created_by = (SELECT id FROM omnia_users WHERE auth_user_id = auth.uid())`
- **Migração**: `20250204000000_fix_select_policy_private_tickets.sql`
- **Status**: ✅ Resolvido

---

## Correções de Nomenclatura e Estrutura

### Prefixo omnia_ nas Tabelas
- **Problema**: Tabelas `menu_items`, `role_permissions`, `user_permissions` sem prefixo padrão
- **Solução**: Renomeação para `omnia_menu_items`, `omnia_role_permissions`, `omnia_user_permissions`
- **Migração**: `20250115000004_rename_tables_to_omnia_prefix.sql`
- **Status**: ✅ Resolvido

### View CRM
- **Problema**: View `crm_lead_comment_counts` sem prefixo
- **Solução**: Renomeada para `omnia_crm_lead_comment_counts`
- **Migração**: `20250115000000_fix_crm_view_nomenclature.sql`
- **Status**: ✅ Resolvido

---

## Correções de Foreign Keys

### Constraint omnia_atas
- **Problema**: Violação de FK ao criar atas (usuário não existe em omnia_users)
- **Causa**: Trigger `on_auth_user_created` não executado para alguns usuários
- **Solução**: Verificação e criação automática do usuário no repositório
- **Status**: ✅ Resolvido

### Constraint omnia_comments
- **Problema**: `created_by` referenciava `auth.users` em vez de `omnia_users`
- **Solução**: Migração para atualizar constraint e converter dados existentes
- **Migração**: `20250115000000_fix_omnia_comments_created_by_constraint.sql`
- **Status**: ✅ Resolvido

---

## Correções de Edge Functions

### BOOT_ERROR Oportunidades
- **Problema**: Edge Function não iniciava (BOOT_ERROR)
- **Causa**: Imports incorretos (`npm:@supabase/supabase-js@2` incompatível)
- **Solução**: Usar imports Deno corretos (`https://esm.sh/@supabase/supabase-js@2`)
- **Status**: ✅ Resolvido

### RLS em Edge Functions
- **Problema**: Edge Function retornava array vazio
- **Causa**: ANON_KEY não tinha contexto `authenticated` para RLS
- **Solução**: Usar SERVICE_ROLE_KEY internamente na Edge Function
- **Status**: ✅ Resolvido

---

## Correções de Menu e Interface

### Item "Alterar Senha" Duplicado
- **Problema**: Item aparecia no menu lateral (já existe no rodapé)
- **Solução**: Removido da tabela `omnia_menu_items`
- **Migração**: `20250117000005_remove_change_password_menu_item.sql`
- **Status**: ✅ Resolvido

### Menu Lateral Vazio
- **Problema**: Menu mostrava apenas Dashboard e Perfil
- **Causa**: Fallback hardcoded no repositório
- **Solução**: Busca real na tabela `omnia_menu_items` com fallback robusto
- **Status**: ✅ Resolvido

---

## Funcionalidades Implementadas

### Status Dinâmicos do CRM
- **Antes**: Enum fixo no código
- **Depois**: Tabela `omnia_crm_statuses` configurável
- **Migração**: `20250115000002_create_omnia_crm_statuses.sql`
- **Status**: ✅ Implementado

### Campo "Tipo" em Administradoras
- **Funcionalidade**: Classificação por tipo (Administradora, Contabilidade, Construtora, Advogado)
- **Migração**: `20250120000000_add_tipo_to_administradoras.sql`
- **Status**: ✅ Implementado

### Cores Únicas para Tags
- **Problema**: Paleta limitada causava repetições
- **Solução**: Expansão para 102 cores distintas + algoritmo determinístico
- **Status**: ✅ Implementado

### Sincronização auth.users ↔ omnia_users
- **Problema**: Usuários autenticados sem registro em omnia_users
- **Solução**: Scripts de sincronização + trigger automático
- **Status**: ✅ Implementado

---

## Padrões Estabelecidos

### Imports em Edge Functions
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
```

### Verificação de Admin em RLS
```sql
EXISTS (
  SELECT 1 FROM omnia_users 
  WHERE auth_user_id = auth.uid() 
  AND 'ADMIN' = ANY(roles)
)
```

### Prefixo de Tabelas
Todas as tabelas do OMNIA usam prefixo `omnia_` para evitar conflitos.

---

**Última atualização**: Dezembro 2024  
**Responsável**: Equipe OMNIA
