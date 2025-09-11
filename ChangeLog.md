# ChangeLog - OMNIA

Registro cronológico das principais mudanças, correções e melhorias implementadas no sistema OMNIA.

---

## 2025-09-11

### 🔧 Correções
- **Foreign Key Constraint Error em Atas**: Implementada verificação e criação automática de usuários na tabela `omnia_users` quando ausentes
  - Modificado `src/repositories/atasRepo.supabase.ts` para incluir fallback robusto
  - Criado script de diagnóstico `fix-missing-user.sql`
  - Documentação: `docs/fix-foreign-key-constraint-atas.md`
- **Foreign Key Constraint Fix**: Corrigido problema de constraint de foreign key na criação de atas, tags e comentários
  - **Problema**: Campos `created_by` armazenavam valores de `auth_user_id` em vez de `omnia_users.id`
  - **Causa**: Foreign keys apontavam para `auth.users(id)` mas deveriam referenciar `omnia_users(id)`
  - Arquivos modificados:
    - `src/repositories/atasRepo.supabase.ts`
    - `src/repositories/ticketCommentsRepo.supabase.ts` 
    - `src/repositories/ataCommentsRepo.supabase.ts`
    - `src/repositories/tagsRepo.supabase.ts`
  - Mudança: Alterado `created_by: user.user.id` para `created_by: omniaUser?.id` em todos os repositórios
  - Adicionada validação para garantir que o usuário existe na tabela `omnia_users`
  - **Conversão de Dados**: Migração converte valores `auth_user_id` existentes para `omnia_users.id` correspondentes
  - Impacto: Sistema agora trabalha exclusivamente com usuários da tabela omnia_users
  - Migração criada: `20250911000000_fix_foreign_key_constraints_tags_atas.sql` (corrigida para converter auth_user_id → omnia_users.id)

---

## 2025-09-10

### 🔧 Correções
- **Comment Trigger**: Correção do trigger de comentários
  - Arquivo: `20250120000000_fix_comment_trigger.sql`
- **Ticket Attachments**: Adicionado campo `comment_id` aos anexos de tickets
  - Arquivo: `20250120000000_add_comment_id_to_ticket_attachments.sql`

---

## 2025-09-09

### 🗑️ Limpeza
- **Remoção de Coluna Obsoleta**: Removida coluna `role` obsoleta
  - Arquivo: `20250116000000_remove_obsolete_role_column.sql`

### ✨ Novas Funcionalidades
- **Sistema CRM**: Implementação completa do sistema CRM
  - Arquivo: `20250909010907_ecec29bf-df44-4c1c-b6ea-9957d1383dac.sql`
- **Administradoras**: Criação da tabela de administradoras
  - Arquivo: `20250909020000_create_omnia_administradoras.sql`

---

## 2025-09-08

### 🔧 Correções
- **Nomenclatura CRM**: Correção da nomenclatura na view do CRM
  - Arquivo: `20250115000000_fix_crm_view_nomenclature.sql`
  - Documentação: `docs/correção-nomenclatura-view-crm.md`
- **RLS Administradoras**: Correção das políticas RLS para administradoras
  - Arquivo: `20250115000001_fix_administradoras_rls_policies.sql`
  - Documentação: `docs/correção-rls-administradoras.md`

### ✨ Novas Funcionalidades
- **CRM Status**: Criação da tabela de status do CRM
  - Arquivo: `20250115000002_create_omnia_crm_statuses.sql`
- **Transformação Status CRM**: Alteração do campo status para UUID
  - Arquivo: `20250115000003_alter_crm_leads_status_to_uuid.sql`
  - Documentação: `docs/transformacao-status-crm.md`

---

## 2024-12-27

### ✨ Novas Funcionalidades
- **Tickets Privados**: Implementação de funcionalidade de tickets privados
  - Arquivo: `20250127000000_add_private_tickets.sql`
  - Correções RLS: `20250127000001_fix_private_tickets_rls.sql`
  - Documentação: `docs/funcionalidade-tarefas-privadas-rls.md`
  - Correções adicionais: `docs/correções-rls-tarefas-privadas.md`

---

## 2024-02-04

### 🔧 Correções
- **Políticas RLS**: Múltiplas correções nas políticas de Row Level Security
  - `20250204000000_fix_select_policy_private_tickets.sql`
  - `20250204000001_fix_rls_policy_app_debug.sql`

### ✨ Novas Funcionalidades
- **Condomínios**: Criação da tabela de condomínios
  - Arquivo: `20250204000002_create_condominiums_table.sql`

---

## 2024-08-15 - 2024-08-19

### 🔧 Correções e Melhorias Massivas
- **Sistema de Usuários**: Reestruturação completa do sistema de usuários e permissões
- **RLS Policies**: Implementação e correção de múltiplas políticas de segurança
- **Triggers**: Criação e correção de triggers automáticos
- **Funções**: Implementação de funções de segurança e utilitários

### 📁 Arquivos Principais
- `20250815014608_b34df97d-3fba-4eec-8d7c-21118cedf643.sql` - Base do sistema
- `20250815015013_28abcca5-18f8-49fc-86d8-814727a9e865.sql` - Trigger de usuários
- `20250817155426_89657855-bf19-4c71-833e-45934e125608.sql` - Atualização de roles
- `20250819180741_871d4620-55f5-46ec-8073-bd74e53fc2bc.sql` - Políticas de atas
- `20250819211723_2ba62ddf-a416-476f-9611-a6878f00e706.sql` - Foreign keys

---

## 2024-08-23

### ✨ Novas Funcionalidades
- **Campos de Condomínio**: Atualização dos campos da tabela de condomínios
  - Arquivo: `20250823030000_update_condominium_fields.sql`

---



---

## Legenda

- 🔧 **Correções**: Bugs fixes e correções de problemas
- ✨ **Novas Funcionalidades**: Implementação de novas features
- 🗑️ **Limpeza**: Remoção de código obsoleto ou refatoração
- 📁 **Arquivos**: Referência a arquivos importantes

---

## Observações

- Todas as mudanças seguem a arquitetura planejada do OMNIA
- Documentação detalhada disponível na pasta `docs/`
- Scripts SQL organizados em `supabase/migrations/`
- Backup e versionamento mantidos via Git

**Última atualização**: 11 de Setembro de 2025