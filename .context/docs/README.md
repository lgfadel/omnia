<!-- agent-update:start:docs-index -->
# Documentation Index

Welcome to the repository knowledge base. Start with the project overview, then dive into specific guides as needed.

## Core Guides
- [Project Overview](./project-overview.md)
- [Architecture Notes](./architecture.md)
- [Development Workflow](./development-workflow.md)
- [Testing Strategy](./testing-strategy.md)
- [Glossary & Domain Concepts](./glossary.md)
- [Data Flow & Integrations](./data-flow.md)
- [Security & Compliance Notes](./security.md)
- [Tooling & Productivity Guide](./tooling.md)

## Repository Snapshot
Key top-level directories and notable files (based on current repository state with ~37,000 files and 371 MB size):

### Directories
- `@/` — Internal modules or aliases (if applicable).
- `apps/` — Application-specific codebases or sub-projects.
- `docs/` — Living documentation produced by this tool.
- `public/` — Static assets served directly.
- `scripts/` — Build, deployment, and utility scripts.
- `src/` — TypeScript source files and CLI entrypoints.
- `supabase/` — Supabase configuration and migrations.
- `tests/` — Automated tests and fixtures.

### Key Configuration Files
- `package.json` — Dependencies, scripts, and project metadata.
- `apps/web-next/` — Next.js 16 application (App Router + Turbopack).
- `apps/web-next/next.config.ts` — Next.js configuration.
- `apps/web-next/tailwind.config.ts` — Tailwind CSS customization.
- `vitest.config.next.ts` — Vitest testing configuration for Next.js.
- `playwright.config.ts` — Playwright E2E testing setup.
- `vercel.json` — Vercel deployment configuration.
- `supabase/` — Database migrations and Edge Functions.

For a full directory tree, use `tree` or `ls -la` in the root.

## Document Map
| Guide | File | AI Marker | Primary Inputs |
| --- | --- | --- | --- |
| Project Overview | `project-overview.md` | agent-update:project-overview | Roadmap, README, stakeholder notes |
| Architecture Notes | `architecture.md` | agent-update:architecture-notes | ADRs, service boundaries, dependency graphs |
| Development Workflow | `development-workflow.md` | agent-update:development-workflow | Branching rules, CI config, contributing guide |
| Testing Strategy | `testing-strategy.md` | agent-update:testing-strategy | Test configs, CI gates, known flaky suites |
| Glossary & Domain Concepts | `glossary.md` | agent-update:glossary | Business terminology, user personas, domain rules |
| Data Flow & Integrations | `data-flow.md` | agent-update:data-flow | System diagrams, integration specs, queue topics |
| Security & Compliance Notes | `security.md` | agent-update:security | Auth model, secrets management, compliance requirements |
| Tooling & Productivity Guide | `tooling.md` | agent-update:tooling | CLI scripts, IDE configs, automation workflows |

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Gather context with `git status -sb` plus the latest commits touching `docs/` or `agents/`.
2. Compare the current directory tree against the table above; add or retire rows accordingly.
3. Update cross-links if guides moved or were renamed; keep anchor text concise.
4. Record sources consulted inside the commit or PR description for traceability.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Repository tree and `package.json` scripts for canonical command names.
- Maintainer-approved issues, RFCs, or product briefs referenced in the repo.
- Release notes or changelog entries that announce documentation changes.

<!-- agent-update:end -->
