# Plano de implementação – Menções e Notificações (tarefas/comentários)

> **Última atualização**: 2025-12-14  
> **Branch**: `feat/notificacoes`

---

## Status geral

| Fase | Descrição | Status |
|------|-----------|--------|
| 0 | Descoberta e alinhamento | ✅ Concluída |
| 1 | Modelo de dados e migrações | ✅ Concluída |
| 2 | Parsing de menções | ✅ Concluída |
| 3 | Detecção de troca responsável/secretário | ✅ Concluída |
| 4 | Serviço/API de notificações | ✅ Concluída |
| 5 | UI mínima | ✅ Concluída |
| 6 | QA e segurança | ⬜ Pendente |
| 7 | Observabilidade e rollout | ⬜ Pendente |

---

## Contexto e fontes
- Basear-se nos agentes e guias em `.context/agents/` e `.context/docs/` para padrões de arquitetura, dados e boas práticas.
- Reutilizar o estilo de UI existente (tarefas, comentários) para minimizar impacto visual.

## Objetivos
- Permitir menções em comentários usando `@nome` ou autocomplete (nome não é único).
- Criar notificações automáticas para três eventos: (1) novo responsável, (2) novo secretário, (3) usuário mencionado em comentário.
- Notificar **apenas usuários ativos**.
- Entregar um fluxo simples e seguro (RLS/filtragem por usuário) com UI mínima: badge + lista + marcar como lida.

## Escopo
- Comentários em tickets/tarefas: parsing de `@nome`, resolução para `userId`, persistência das menções e criação de notificações.
- Troca de responsável/secretário: detecção de mudança e notificação para o novo usuário (se ativo).
- API/serviço de notificações: listar não lidas, marcar como lida/ler todas.
- UI: indicador de não lidas + lista; navegação para ticket/comentário quando clicado.

---

## Fases

### Fase 0 — Descoberta e alinhamento ✅
- [x] Ler `.context/docs/README.md` e `.context/agents/README.md` para seguir padrões do projeto.
- [x] Mapear tabelas/estruturas atuais de usuários, tickets, comentários, responsáveis, secretários.
- [x] Confirmar chave única para `nome` → **Decisão**: `omnia_users.name` **não é único**; `email` é único. Menções devem usar autocomplete que resolve `userId`.

**Estruturas mapeadas**:
- `omnia_users`: id, auth_user_id, name, email (unique), roles[], avatar_url, color, active (default true)
- `omnia_tickets`: id, title, assigned_to (→ omnia_users.id), created_by (→ omnia_users.id), is_private, ...
- `omnia_atas`: secretary_id (→ omnia_users.id), responsible_id (→ omnia_users.id)
- `omnia_ticket_comments`: id, ticket_id, author_id, body, created_at
- `omnia_comments` (atas): id, ata_id, author_id, body, created_at

### Fase 1 — Modelo de dados e migrações ✅

**Implementado** (migration `20251207230000_add_notifications_table.sql`):
- [x] Tabela `omnia_notifications` (renomeada de `notifications`) com campos: `id`, `user_id`, `type`, `ticket_id`, `comment_id`, `ticket_comment_id`, `created_by`, `created_at`, `read_at`
- [x] Índice `omnia_notifications_user_read_idx` em (`user_id`, `read_at`)
- [x] Índice `omnia_notifications_type_user_ticket_comment_idx` para consultas
- [x] Unique partial index `omnia_notifications_dedupe_unread_idx` para dedupe de não lidas
- [x] Coluna `active boolean default true` adicionada a `omnia_users`

**Implementado** (migration `20251214170000_add_notifications_rls.sql`):
- [x] RLS habilitado em `public.omnia_notifications`
- [x] Policy de `SELECT` (usuário só vê as próprias notificações)
- [x] Policy de `UPDATE` (usuário só atualiza as próprias notificações — ex.: marcar como lida)

**Implementado** (migration `20251214190000_rename_notifications_to_omnia_notifications.sql`):
- [x] Rename `public.notifications` → `public.omnia_notifications` (padrão `omnia_`)

**Implementado** (migration `20251214200000_add_ticket_comment_fk_to_omnia_notifications.sql`):
- [x] Coluna `ticket_comment_id` em `public.omnia_notifications` com FK para `public.omnia_ticket_comments(id)`
- [x] `ON DELETE CASCADE` para remover notificações de menção quando o comentário de ticket é apagado

**Implementado** (app):
- [x] Types Supabase atualizados em `apps/web-next/src/integrations/supabase/types.ts` (inclui `omnia_notifications` e `omnia_users.active`)
- [x] `apps/web-next/src/repositories/usersRepo.supabase.ts`: `User.active` e `getActiveUsers()` filtrando `active = true`
- [x] Migrações aplicadas no banco com sucesso (confirmado em 2025-12-14)

### Fase 2 — Parsing de menções em comentários ✅

**Arquivos-chave para implementação**:
- `apps/web-next/src/repositories/ticketCommentsRepo.supabase.ts` — criação de comentários em tickets
- `apps/web-next/src/repositories/crmCommentsRepo.supabase.ts` — criação de comentários em leads
- `apps/web-next/src/components/tickets/TicketCommentInput.tsx` — UI de input de comentários

**Tarefas**:
- [x] No frontend: autocomplete de usuários ativos no `TicketCommentInput`
- [x] Inserção de menções como `@Nome` no input com conversão para `@[userId]` ao salvar
- [x] Chamada da Edge Function `notify-mentions` após criar comentário (tickets e atas)
- [x] Tickets: enviar `ticket_comment_id` para permitir remoção automática (`ON DELETE CASCADE`) ao apagar o comentário

### Fase 3 — Detecção de troca de responsável/secretário ✅

**Arquivos-chave**:
- `apps/web-next/src/repositories/tarefasRepo.supabase.ts` — update de tarefas (campo `assignedTo`)
- `apps/web-next/src/repositories/atasRepo.supabase.ts` — atas têm `secretary_id` e `responsible_id`

**Tarefas**:
- [x] No update de tarefa: detectar mudança de `assigned_to` e criar notificação type="assigned" (somente usuários ativos)
- [x] No update de ata: detectar mudança de `secretary_id` (type="secretary") e `responsible_id` (type="responsible")
- [x] Registrar `created_by` (quem fez a alteração) na notificação
- [x] Implementado via triggers no Postgres (`SECURITY DEFINER`) para não depender do frontend e evitar necessidade de policy `INSERT`

### Fase 4 — Serviço/API de notificações ✅

**Opções de implementação**:
1. **Edge Function** (recomendado para lógica complexa)
2. **RPC functions** no Postgres
3. **Queries diretas** via Supabase client com RLS

**Tarefas**:
- [x] Criar `notificationsRepo.supabase.ts` com métodos:
  - `listUnread(userId)` — notificações não lidas do usuário
  - `markAsRead(notificationId)` — atualiza `read_at`
  - `markAllAsRead(userId)` — atualiza todas não lidas
- [x] Aplicar RLS: usuário só lê/atualiza suas notificações
- [x] Supabase Realtime para push de novas notificações (subscribe em `omnia_notifications`)

**Implementado** (app):
- [x] `apps/web-next/src/repositories/notificationsRepo.supabase.ts`: `listUnread`, `listRecent`, `markAsRead`, `markAllAsRead`
- [x] `apps/web-next/src/stores/notifications.store.ts`: Zustand store com `unreadCount` e subscribe Realtime (INSERT/UPDATE)
- [x] `apps/web-next/src/components/notifications/NotificationsBootstrap.tsx` montado em `app/providers.tsx`

**Implementado** (migrations):
- [x] `20251214233000_enable_realtime_omnia_notifications.sql`: habilita publication `supabase_realtime` para `public.omnia_notifications`
- [x] `20251214234000_fix_omnia_notifications_rls.sql`: garante policies de SELECT/UPDATE em `public.omnia_notifications`

### Fase 5 — UI mínima ✅

**Arquivos-chave**:
- `apps/web-next/src/components/layout/TopBar.tsx` — local para badge de notificações
- Criar `apps/web-next/src/components/notifications/` — componentes de notificação

**Tarefas**:
- [x] Badge de não lidas (count) no header/nav
- [x] Dropdown com lista de notificações recentes
- [x] Ação “marcar como lida”
- [x] Ação “marcar todas como lidas”

**Implementado** (app):
- [x] `apps/web-next/src/components/layout/TopBar.tsx`: sino + badge
- [x] `apps/web-next/src/components/notifications/NotificationsMenu.tsx`: dropdown


### Fase 6 — QA e segurança ⬜

**Tarefas**:
- [ ] Testes unitários para `parseMentions` (incluindo usuários inexistentes/inativos)
- [ ] Testes de integração para criação de notificação por mudança de responsável
- [ ] Testes de RLS: usuário só vê suas notificações
- [ ] Testes manuais: fluxo completo de menção, troca de responsável, badge, marcar como lida

**Roteiro de QA manual (recomendado)**:
1. **Sessão A + Sessão B (2 navegadores diferentes / anônimo)**
   - Logar na sessão A com usuário A
   - Logar na sessão B com usuário B

2. **Realtime (menção)**
   - Na sessão A, abrir uma tarefa e mencionar B em um comentário (autocomplete) e salvar
   - Confirmar na sessão B que:
     - Badge incrementa sem refresh
     - Dropdown mostra a notificação nova
     - Ao clicar, navega para a entidade correta

3. **Marcar como lida**
   - Na sessão B, abrir dropdown e marcar uma notificação como lida
   - Confirmar que o contador reduz e o item fica com estilo de “lida”
   - Usar “Marcar todas como lidas” e confirmar contador 0

4. **Realtime (assigned/secretary/responsible)**
   - Na sessão A, atribuir uma tarefa para B e confirmar notificação em B
   - Se aplicável, trocar secretary/responsible de uma ata para B e confirmar notificação em B

5. **RLS (segurança)**
   - Confirmar que B não enxerga notificações de A
   - Confirmar que B não consegue marcar como lida notificações de A (via UI e/ou tentativa de chamada)

6. **Cascade delete (menções em ticket comment)**
   - Na sessão A, mencionar B em comentário de ticket
   - Apagar o comentário
   - Confirmar que a notificação correspondente some da lista de B (recarregar caso necessário)

### Fase 7 — Observabilidade e rollout ⬜

**Tarefas**:
- [ ] Logs para criação de notificações e falhas de resolução de @nome
- [ ] Métricas básicas: notificações criadas por tipo, lidas
- [ ] Rollout gradual: staging primeiro; feature flag em produção se necessário

---

## Decisões

### Fechadas ✅
| Decisão | Resolução |
|---------|-----------|
| Unicidade de `nome` | `omnia_users.name` **não é único**. Menções usarão autocomplete que resolve `userId` |
| Formato de menção | `@[userId]` no corpo salvo; UI exibe como `@nome` com chip clicável |
| Ex-responsável recebe notificação? | Não (apenas novo responsável) |
| Entrega em tempo real | Supabase Realtime |
| Notificações em comentários de atas? | Sim (mesma lógica de tickets) |

### Abertas ⬜
Sem decisões abertas no momento.

---

## Próximos passos imediatos

1. **Fase 6 (QA e segurança)**
   - Validar RLS: usuário só consegue `SELECT/UPDATE` as próprias notificações
   - Teste em 2 sessões (usuário A menciona / atribui; usuário B recebe em realtime)
   - Validar cascade delete: apagar comentário de ticket remove notificações de menção relacionadas

2. **Edge cases de UI**
   - Estado de loading/erro no dropdown
   - Caso entidade tenha sido deletada (ata/tarefa) ou sem título
   - (Opcional) deep-link para o comentário específico quando existir

3. **Fase 7 (observabilidade e rollout)**
   - Logs mínimos no Edge Function `notify-mentions` para falhas de resolução/criação
   - Checklist de deploy: migrations + edge function + app

---

## Resumo de segurança
- Notificar apenas usuários ativos (filtrar por `active = true`)
- RLS policies por `user_id` em `omnia_notifications`
- Sanitizar renderização de comentários; menções só viram links/chips após validação de userId
- INSERT de notificações deve ser restrito (service role ou triggers)

## Convenção de nomenclatura (padrão do banco)
- Tabelas do domínio devem usar o prefixo `omnia_` (ex.: `omnia_notifications`).
