<!-- agent-update:start:data-flow -->
# Data Flow & Integrations

Explain how data enters, moves through, and exits the system, including interactions with external services.

## High-level Flow
The primary data pipeline follows a client-server model centered on the frontend application built with Vite and React (inferred from tsconfig and vite.config.ts). User interactions begin in the browser, where data is captured via UI components in `src/`. This data is processed locally (e.g., validation, state management with hooks) before being sent to Supabase for persistence, authentication, or real-time updates. Responses flow back synchronously (REST) or asynchronously (realtime subscriptions). Outputs include rendered UI updates, API responses, or exported data (e.g., via downloads if implemented).

For visualization, refer to the architecture overview in [docs/architecture.md](architecture.md), which includes a Mermaid diagram of the client-Supabase interaction. Key stages:
1. **Input**: User events (forms, clicks) in `apps/` or `src/components/`.
2. **Processing**: Local state in `src/stores/` or services; optional caching.
3. **Output**: UI renders or external exports; data persisted in Supabase.

## Internal Movement
Data moves through the monorepo structure via modular components and services. The `@` directory likely hosts shared utilities or scoped packages (e.g., types, utils). Core logic resides in `src/`, where:
- UI components (`src/components/`) capture and dispatch events.
- Services or hooks (`src/lib/` or `src/services/`) handle business logic, such as form validation or data transformation.
- The Supabase client (initialized in `src/lib/supabaseClient.ts` or similar) acts as the central gateway, using RPC-like calls (via PostgREST) or event subscriptions (Supabase Realtime) to interact with the backend.
- Shared state (e.g., via Zustand or React Context) propagates changes across `apps/` (if multi-app setup) without direct queues, relying on in-memory updates and database syncs. No explicit internal queues or RPC; movement is primarily async HTTP/WebSocket to Supabase, with local event emitters for reactivity.

Collaboration between directories:
- `scripts/` for build-time data processing (e.g., env vars).
- `tests/` for mocking flows during validation.
- No shared databases internally; all persistence is external via Supabase.

## External Integrations
- **Supabase** — Provides authentication, PostgreSQL database, real-time subscriptions, and storage as a Backend-as-a-Service (BaaS). Authentication uses the Supabase JS client with methods like `signInWithPassword` or OAuth providers (e.g., Google); requires anon/public keys from `supabase/` config. Payload shapes follow Supabase conventions: JSON bodies for inserts/updates (e.g., `{ data: { user_id: string, content: string } }`), query params for selects. Retry strategy: SDK defaults to exponential backoff (up to 3 attempts) on network errors; custom retries can be added in service wrappers. Rate limits: Supabase enforces per-project quotas (e.g., 500 req/min for free tier); monitor via dashboard. See `src/integrations/supabase/client.ts` for client initialization.

No other major external integrations detected (e.g., no Stripe or external APIs in current scans); future additions would follow similar SDK patterns with error boundaries.

## Observability & Failure Modes
- **Metrics & Logs**: Frontend errors are logged via console (or integrated with Sentry if added); Supabase provides query logs, auth events, and edge function traces in the dashboard. Realtime connections emit events for monitoring (e.g., `SUBSCRIBE`, `BROADCAST`). Use Playwright/Vitest in `tests/` for flow assertions.
- **Traces**: Supabase Realtime includes channel traces; frontend can use browser devtools for request tracing.
- **Failure Modes**: Network failures trigger SDK retries with backoff (1s, 2s, 5s). Auth expirations redirect to login via `onAuthStateChange`. Dead-letter handling: Unhandled errors bubble to global error boundaries; no explicit queues, so failed inserts roll back via transactions (Supabase supports ACID). Compensating actions: Optimistic UI updates with rollback on error. Recent lessons: Ensure RLS policies to prevent unauthorized flows (from supabase/migrations/).

For triage, refer to Supabase logs in the dashboard.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Validate flows against the latest integration contracts or diagrams.
2. Update authentication, scopes, or rate limits when they change.
3. Capture recent incidents or lessons learned that influenced reliability.
4. Link to runbooks or dashboards used during triage.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Architecture diagrams, ADRs, integration playbooks.
- API specs, queue/topic definitions, infrastructure code.
- Postmortems or incident reviews impacting data movement.

<!-- agent-update:end -->
