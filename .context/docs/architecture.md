<!-- agent-update:start:architecture-notes -->
# Architecture Notes

The system is a modern single-page application (SPA) built with React and Vite, integrated with Supabase as a backend-as-a-service (BaaS) for authentication, database, and storage. A migration to Next.js 16 with App Router is in progress (see `apps/web-next/` and `docs/plans/migracao-next16.md`). This design choice enables rapid development and deployment without managing a custom backend server, leveraging Supabase's PostgreSQL database, real-time subscriptions, and edge functions. The application is deployed to Vercel, ensuring fast global distribution via CDN. The architecture prioritizes developer experience with hot module replacement (HMR) during development and optimized builds for production.

## System Architecture Overview
The application follows a monolithic frontend topology with modular components, where the client-side code handles UI rendering, state management, and API interactions. It is not a microservices-based system but a cohesive SPA that communicates with external services.

- **Topology**: Client-side rendered SPA using React for the UI layer. Currently bundled with Vite (`src/`), with Next.js App Router migration underway (`apps/web-next/`).
- **Deployment Model**: Static/SSR hosting on Vercel, with serverless functions via Supabase Edge Functions.
- **Request Flow**: User requests load the entry point, which bootstraps the React app. The app fetches initial data and handles subsequent interactions via the Supabase client SDK. Real-time updates use Supabase's WebSocket-based subscriptions. Control pivots between the UI (React components), local state (via Zustand stores in `src/stores/`), and the Supabase client for data persistence.

## Core System Components
The repository is structured as a Vite-based React project with clear separation of concerns:

- `@/` — Symlink or alias for shared utilities (minimal files, used for imports).
- `apps/` — Contains the primary application code, including subdirectories for features, pages, and modules (bulk of the codebase, ~20k files including dependencies and generated assets).
- `docs/` — Documentation files, including guides, architecture notes, and API references (~31 files).
- `public/` — Static assets like images, fonts, and favicons (~5 files).
- `scripts/` — Utility scripts for builds, migrations, and deployments (~9 files).
- `src/` — Core source code, including components, hooks, pages, services, and utilities (~220 files).
- `supabase/` — Supabase configuration, including database migrations, functions, and client setup (~72 files).
- `tests/` — Test suites using Vitest for unit/integration tests and Playwright for E2E/visual regression (~6 config and setup files).

Supporting configs include `package.json` for dependencies (React, Supabase JS client, Tailwind CSS), `vite.config.ts` for bundling, `tailwind.config.ts` for styling, and TypeScript configs (`tsconfig*.json`) for type safety.

## Internal System Boundaries
The system defines boundaries around the UI domain (React components and state), the data access layer (Supabase client wrappers in `src/services/` or similar), and configuration (environment-specific Supabase URLs and keys).

- **Bounded Contexts**: 
  - **UI Layer**: Handles rendering and user interactions; owns local state but does not persist data.
  - **Data Layer**: Encapsulated in Supabase client instances; enforces contracts via TypeScript interfaces for queries and mutations.
- **Data Ownership**: Supabase owns persistent data (PostgreSQL tables for users, content, etc.). Client-side synchronization uses real-time subscriptions to keep local state in sync, with optimistic updates for UX.
- **Seams**: API calls are abstracted in hooks (e.g., `useSupabaseQuery`), preventing direct client exposure. Shared contracts are enforced via Supabase Row Level Security (RLS) policies on the backend.

## System Integration Points
- **Inbound Interfaces**: 
  - Web UI: Handled by React Router for client-side routing.
  - Supabase Auth: Email/password, OAuth providers (e.g., Google), managed via Supabase Auth UI components.
- **Outbound Orchestration**: 
  - Supabase Client: All data operations (CRUD, real-time) route through the SDK in `src/lib/supabase.ts`.
  - No direct calls to other internal services; coordination is via Supabase's ecosystem (e.g., invoking Edge Functions from client code).
- **Events/Webhooks**: Supabase handles real-time events via broadcasts and database triggers; client subscribes using `supabase.channel()`.

## External Service Dependencies
The system relies on a few key external services, with built-in fallbacks and error handling:

- **Supabase**:
  - **Usage**: Authentication, PostgreSQL database, real-time subscriptions, storage.
  - **Authentication**: Supabase Auth (JWT tokens stored in localStorage/session).
  - **Rate Limits**: Standard Supabase limits (e.g., 500 req/s per project); mitigated by client-side caching.
  - **Failure Considerations**: Offline support via service workers (if implemented); retries with exponential backoff in Supabase SDK.

- **Vercel**:
  - **Usage**: Hosting and CDN for static assets.
  - **Authentication**: API keys for deployments.
  - **Rate Limits**: Free tier limits; monitored via Vercel dashboard.
  - **Failure Considerations**: Automatic rollbacks on deploy failures; static nature ensures high availability.

- **Other**: Tailwind CSS (CDN or built-in), but primarily local.

## Key Decisions & Trade-offs
- **Vite over Webpack**: Chosen for faster HMR and smaller bundles; trade-off is less mature plugin ecosystem but sufficient for this SPA (see `vite.config.ts`).
- **Supabase as BaaS**: Enables quick prototyping without DevOps overhead; alternative (custom Node.js/Express backend) was rejected for time-to-market. Trade-off: Vendor lock-in, mitigated by standard PostgreSQL.
- **React with TypeScript**: For component reusability and type safety; Zustand for lightweight state management over Redux to reduce boilerplate.
- **Supporting Docs**: No formal ADRs yet; decisions captured in commit history (e.g., initial setup PRs). Recent experiments with Playwright for E2E testing improved CI reliability over Jest alone.

Key outcomes: Focus on frontend velocity, with Supabase handling 80% of backend needs. Alternatives like Firebase were considered but Supabase won for SQL familiarity and open-source alignment.

## Diagrams
Below is a high-level component diagram using Mermaid:

```mermaid
graph TD
    A[User Browser] --> B[React SPA<br/>(src/, apps/)]
    B --> C[Supabase Client<br/>(src/lib/supabase.ts)]
    C --> D[Supabase Project<br/>(Auth, DB, Realtime)]
    B --> E[Vercel CDN<br/>(Static Hosting)]
    D --> F[PostgreSQL Database<br/>(supabase/migrations)]
    D --> G[Edge Functions<br/>(supabase/functions)]
    style A fill:#f9f,stroke:#333
    style E fill:#bbf,stroke:#333
    style D fill:#bfb,stroke:#333
```

For detailed data flows, refer to [Data Flow & Integrations](./data-flow.md).

## Risks & Constraints
- **Performance**: Large `apps/` directory may increase build times; mitigated by Vite's caching. Lighthouse scores targeted >90 (see `lighthouserc.js`).
- **Scaling**: Supabase free tier limits concurrent connections; upgrade path to Pro for production traffic. Client-side rendering may cause initial load delays—consider SSR if needed.
- **Security**: Relies on Supabase RLS; client exposure of API keys is a risk (use environment variables). Assumptions: Users are authenticated before sensitive data access.
- **Constraints**: No offline-first design yet; assumes reliable internet. Technical debt: Incomplete test coverage in `tests/`; active incidents include Supabase connection pooling tweaks (tracked in issues).
- **External Assumptions**: Supabase uptime SLA (99.9%); Vercel deploys are atomic.

## Top Directories Snapshot
Based on current repository state (commit: latest main; total files ~20,745; size ~371 MB):

| Directory | Description | Approx. Files |
|-----------|-------------|---------------|
| `@/` | Import aliases/shared modules | 1 |
| `apps/` | Main application modules and features | 20,369 |
| `docs/` | Project documentation | 31 |
| `public/` | Static public assets | 5 |
| `scripts/` | Build and deployment utilities | 9 |
| `src/` | Core React source code | 220 |
| `supabase/` | Backend configurations and migrations | 72 |
| `tests/` | Testing setups and suites | 6 |

This snapshot excludes configs like `package.json` and lockfiles for brevity. For full git status, run `git status -sb`.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Review ADRs, design docs, or major PRs for architectural changes.
2. Verify that each documented decision still holds; mark superseded choices clearly.
3. Capture upstream/downstream impacts (APIs, events, data flows).
4. Update Risks & Constraints with active incident learnings or TODO debt.
5. Link any new diagrams or dashboards referenced in recent work.

<!-- agent-readonly:sources -->
## Acceptable Sources
- ADR folders, `/docs/architecture` notes, or RFC threads.
- Dependency visualisations from build tooling or scripts.
- Issue tracker discussions vetted by maintainers.

## Related Resources
- [Project Overview](./project-overview.md)
- Update [agents/README.md](../agents/README.md) when architecture changes.

<!-- agent-update:end -->
