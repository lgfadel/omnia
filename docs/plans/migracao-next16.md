# Plano de migração para Next.js 16 (App Router + Turbopack)

## Objetivo
Migrar o frontend atual (Vite/React + Tailwind + React Router + Vitest/Playwright) para Next.js 16 utilizando App Router e Turbopack, preservando funcionalidades, reduzindo tempo de build e habilitando SSR/ISR onde fizer sentido.

## Premissas e decisões
- Next.js 16, App Router, Turbopack (dev/build), TypeScript.
- Tailwind CSS + shadcn mantidos.
- React Query e Supabase continuam; revisar exposição de envs (`NEXT_PUBLIC_*`).
- Estrutura principal em `app/`; utilizar `/public` para estáticos; `/app/api` para handlers quando preciso.
- SSR/ISR aplicado a páginas que se beneficiem; restante como Client Components.
- Testes: manter Playwright; avaliar manter Vitest ou migrar unitários para Jest/`next/jest`.

## Fases e tarefas

### Fase 0 — Preparação
- Revisar matriz de rotas/funcionalidades existentes (React Router) e dependências críticas.
- Mapear necessidades de SSR/ISR/CSR por rota.
- Confirmar versões de Node/PNPM/NPM suportadas pelo Next 16.
- Planejar estratégia de migração incremental (feature flag ou branch dedicado).

### Fase 1 — Scaffold Next 16
- Criar app Next (`create-next-app@latest`) com `app/`, Tailwind, TypeScript, Turbopack.
- Ajustar `package.json`: scripts `next dev/build/start/lint/test` (se aplicável); remover scripts Vite.
- Configurar `tsconfig` com `baseUrl`/`paths` para `@/*` apontando para `./src` ou `./app` (decisão final).
- Habilitar ESLint com preset Next; portar regras atuais.

### Fase 2 — Fundamentos e estilos
- Migrar `src/index.css` → `app/globals.css`; garantir imports Tailwind.
- Reaproveitar `tailwind.config.ts` e `postcss.config.js` (ajustar `content` para `app/**/*`).
- Trazer layout global (`App.tsx`) para `app/layout.tsx` com providers (tema, query client, toasts, ErrorBoundary).

### Fase 3 — Roteamento e páginas
- Converter rotas do React Router para estrutura de pastas em `app/` (rotas estáticas e dinâmicas).
- Substituir `Link`/`Navigate` por `next/link` e `next/navigation`.
- Criar `not-found.tsx` e `error.tsx` conforme necessário.

### Fase 4 — Dados e componentes client/server
- Classificar componentes/páginas como Server ou Client (`"use client"`).
- Para dados: decidir SSR/ISR vs CSR por rota; mover fetches de dados de loaders/client para server components ou hooks client.
- Configurar React Query hydration se necessário; validar Supabase uso em ambiente server/client.
- Ajustar `next-themes` ou outro provider de tema no layout.

### Fase 5 — API e integrações
- Migrar chamadas que precisem de backend para `/app/api` (ou manter no backend existente se já houver).
- Proteger segredos: mover variáveis para `.env.local` com prefixo `NEXT_PUBLIC_` quando expostas ao client.
- Revisar integrações de upload/imagens; avaliar `next/image` para assets.

### Fase 6 — Testes e qualidade
- Atualizar suites de testes:
  - E2E: apontar Playwright para novas rotas/base URL.
  - Unitários: escolher manter Vitest (com preset Next) ou migrar para Jest/`next/jest`; atualizar setup (jsdom, paths).
- Rodar `next lint` e corrigir avisos.
- Adicionar checagem `next build` no CI.

### Fase 7 — Performance e build
- Validar Turbopack em dev e build; medir tempos vs Vite.
- Habilitar otimizações de imagens (`next/image`) e cache/ISR onde aplicável.
- Revisar bundle splitting e carregamento de fontes/icones.

### Fase 8 — Deploy e rollout
- Ajustar configuração de deploy (Vercel ou pipeline atual) para Next 16.
- Validar variáveis de ambiente no provedor.
- Fazer rollout gradual (flag/percentual) e monitorar erros/performance.

### Fase 9 — Limpeza e documentação
- Remover artefatos Vite: `vite.config.ts`, `vitest.config.ts` (se migrou), `index.html`, scripts antigos.
- Atualizar `README.md` e docs de execução/testes/deploy.
- Registrar lições aprendidas e pontos de atenção para futuros upgrades.

## Entregáveis
- Código migrado para Next.js 16 (App Router, Turbopack) com rotas funcionais e estilos preservados.
- Testes (unit/e2e) e `next build` passando.
- Documentação atualizada em README e docs internos.

## Progresso da Migração

### ✅ Fase 0 — Preparação (Concluída)
- Rotas mapeadas do React Router
- Dependências identificadas

### ✅ Fase 1 — Scaffold Next 16 (Concluída)
- App criado em `apps/web-next/`
- Scripts configurados no `package.json` raiz
- `tsconfig.json` com aliases configurados

### ✅ Fase 2 — Fundamentos e estilos (Concluída)
- `globals.css` migrado com variáveis de tema
- `tailwind.config.ts` configurado
- `layout.tsx` com providers (QueryClient, AuthProvider, Toasts, ErrorBoundary)

### ✅ Fase 3 — Roteamento e páginas (Concluída)
Páginas migradas para App Router:
- `/` → `app/page.tsx` (Dashboard/Index)
- `/auth` → `app/auth/page.tsx`
- `/access-denied` → `app/access-denied/page.tsx`
- `/change-password` → `app/change-password/page.tsx`
- `/atas` → `app/atas/page.tsx`
- `/atas/new` → `app/atas/new/page.tsx`
- `/atas/[id]` → `app/atas/[id]/page.tsx`
- `/atas/[id]/edit` → `app/atas/[id]/edit/page.tsx`
- `/tarefas` → `app/tarefas/page.tsx`
- `/tarefas/new` → `app/tarefas/new/page.tsx`
- `/tarefas/[id]` → `app/tarefas/[id]/page.tsx`
- `/tarefas/[id]/edit` → `app/tarefas/[id]/edit/page.tsx`
- `/crm` → `app/crm/page.tsx`
- `/crm/[id]` → `app/crm/[id]/page.tsx`
- `/crm/edit/[id]` → `app/crm/edit/[id]/page.tsx`
- `/config/status` → `app/config/status/page.tsx`
- `/config/usuarios` → `app/config/usuarios/page.tsx`
- `/config/tags` → `app/config/tags/page.tsx`
- `/config/condominiums` → `app/config/condominiums/page.tsx`
- `/config/administradoras` → `app/config/administradoras/page.tsx`
- `/config/ticket-status` → `app/config/ticket-status/page.tsx`
- `/config/crm-status` → `app/config/crm-status/page.tsx`
- `/config/origens` → `app/config/origens/page.tsx`
- `not-found.tsx` criado

### 🔄 Fase 4 — Dados e componentes (Em andamento)
- Componentes marcados como `"use client"` onde necessário
- Componentes compartilhados, stores, hooks, lib, integrations já copiados para `apps/web-next/src/`
- Pendente: finalizar lint/build após remoção do alias cruzado (rodar `npm --prefix apps/web-next run lint`/`build`)

### 🔄 Fase 5 — API e integrações (Pendente)
- Pendente: revisar variáveis de ambiente `NEXT_PUBLIC_*`
- Pendente: configurar `next.config.ts` para domínios de imagem

### ⏳ Fase 6-9 (Pendentes)
- Testes, performance, deploy e limpeza

## Riscos e mitigação
- Diferenças CSR vs SSR podem quebrar hooks: validar componentes marcados como client.
- Variáveis de ambiente sem `NEXT_PUBLIC_` podem falhar no browser: revisar todas.
- Integrações de arquivo/imagem podem exigir ajustes de domínio/configuração de imagem.
- Turbopack pode ter incompatibilidades com plugins específicos: manter fallback para `next build` clássico se necessário.
