# Plano de implementação – Menções e Notificações (tarefas/comentários)

## Contexto e fontes
- Basear-se nos agentes e guias em `.context/agents/` e `.context/docs/` para padrões de arquitetura, dados e boas práticas.
- Reutilizar o estilo de UI existente (tarefas, comentários) para minimizar impacto visual.

## Objetivos
- Permitir menções em comentários usando `@nome` (display name único no sistema).
- Criar notificações automáticas para três eventos: (1) novo responsável, (2) novo secretário, (3) usuário mencionado em comentário.
- Notificar **apenas usuários ativos**.
- Entregar um fluxo simples e seguro (RLS/filtragem por usuário) com UI mínima: badge + lista + marcar como lida.

## Escopo
- Comentários em tickets/tarefas: parsing de `@nome`, resolução para `userId`, persistência das menções e criação de notificações.
- Troca de responsável/secretário: detecção de mudança e notificação para o novo usuário (se ativo).
- API/serviço de notificações: listar não lidas, marcar como lida/ler todas.
- UI: indicador de não lidas + lista; navegação para ticket/comentário quando clicado.

## Fases

### Fase 0 — Descoberta e alinhamento
- Ler `.context/docs/README.md` e `.context/agents/README.md` para seguir padrões do projeto.
- Mapear tabelas/estruturas atuais de usuários, tickets, comentários, responsáveis, secretários.
- Confirmar chave única para `nome` (display) ou definir fallback (autocomplete que resolve userId).

### Fase 1 — Modelo de dados e migrações
- Criar tabela `notifications` com: `id`, `user_id`, `type` ("assigned" | "secretary" | "mentioned"), `ticket_id`, `comment_id` (nullable), `created_by`, `created_at`, `read_at`.
- Índices: (`user_id`, `read_at`) e, se necessário, índice para (`type`, `user_id`, `ticket_id`, `comment_id`) para consulta e dedupe.
- Constraint de dedupe opcional: unique parcial em (`type`, `user_id`, `ticket_id`, `comment_id`) onde `read_at IS NULL`.
- Adicionar coluna `active boolean default true` em `omnia_users` (se ainda não existir) e refletir em tipos/SDK.
- Atualizar tipos Supabase gerados (se aplicável) e reexportar modelos usados em stores/repos.

### Fase 2 — Parsing de menções em comentários
- No backend de criação de comentário:
  - Extrair `@nome` com regex `/@([\w._-]+)/g`.
  - Resolver `nome -> userId` apenas para usuários ativos; ignorar inexistentes/inativos.
  - Persistir `mentions: userId[]` no comentário.
  - Criar notificações type="mentioned" para cada userId ativo.
- Sanitizar corpo de comentário antes de renderizar (sem HTML bruto).

### Fase 3 — Detecção de troca de responsável/secretário
- No update de tarefa: comparar `assignedTo` e `secretary` (se existir).
- Se mudou e novo usuário é ativo e diferente do anterior: criar notificação type="assigned" ou "secretary".
- Registrar `createdBy` (quem fez a alteração) para auditoria.

### Fase 4 — Serviço/API de notificações
- Endpoints/serviço:
  - `GET /notifications?unread=1` (ou RPC) filtrando por `userId` autenticado.
  - `PATCH /notifications/:id/read` e `POST /notifications/mark-all-read`.
- Aplicar RLS/filters: usuário só lê suas notificações.
- Se usar Supabase Realtime: publicar novos registros de `notifications` no canal do usuário.

### Fase 5 — UI mínima
- Badge de não lidas (count) em header/nav.
- Lista de notificações (dropdown ou página):
  - Mostrar tipo, ticket, preview de comentário (menção) e tempo relativo.
  - Ação: marcar como lida (individual ou todas).
  - Clique navega para o ticket; se houver `commentId`, rolar até o comentário.
- Indicador visual de não lida (ponto ou fundo destacado).

### Fase 6 — QA e segurança
- Testes automatizados:
  - Parsing de menções (incluindo inexistentes/inativos).
  - Criação de notificação por mudança de responsável/secretário.
  - Acesso restrito: usuário só vê suas notificações.
- Testes manuais: fluxo de menção, troca de responsável, badge de não lidas, marcar como lida.

### Fase 7 — Observabilidade e rollout
- Logs para criação de notificações e falhas de resolução de @nome.
- Métricas básicas: notificações criadas por tipo, entregues/lidas.
- Rollout gradual: habilitar primeiro em staging; depois produção com feature flag se necessário.

## Decisões abertas
- Confirmar unicidade de `nome` (display). Se não for único, exigir autocomplete para resolver userId no frontend de comentário.
- Confirmar se ex-responsável deve receber notificação de remoção (atualmente, apenas o novo responsável é notificado).
- Realtime vs polling: se realtime estiver pronto via Supabase, usar; senão começar com polling leve.

## Resumo de segurança
- Notificar apenas usuários ativos.
- RLS/filters por `userId` em `notifications` e nas queries.
- Sanitizar renderização de comentários; menções só viram links/chips após validação de userId.
