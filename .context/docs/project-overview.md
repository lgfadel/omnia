<!-- agent-update:start:project-overview -->
# Project Overview

The Omnia project is a full-stack web application designed to streamline communication and collaboration workflows for teams, particularly in creative and media agencies like Loovus Comunicação. It solves the problem of fragmented tools for task management, document sharing, and real-time updates by providing an integrated platform with backend services via Supabase for authentication, database, and storage. Beneficiaries include team leads, designers, and project managers who gain from centralized atas (meeting minutes), task tracking, and deployment optimizations, reducing context-switching and improving productivity.

## Quick Facts
- Root path: `/Users/gustavo/Library/Mobile Documents/com~apple~CloudDocs/Loovus Comunicação/github/omnia`
- Primary languages detected:
- .js (11091 files)
- .ts (3480 files)
- .map (3068 files)
- .json (854 files)
- .md (666 files)

## File Structure & Code Organization
- `@/` — Internal scoped modules and shared utilities, used for organizing reusable code packages within the monorepo.
- `apps/` — Contains sub-applications or micro-frontends, such as the main web app and any supporting tools.
- `docs/` — Living documentation produced by this tool.
- `public/` — Static assets served directly to the client, including images, fonts, and index.html for the web app.
- `scripts/` — Utility scripts for build processes, deployments, and maintenance tasks.
- `src/` — TypeScript source files and CLI entrypoints.
- `supabase/` — Configuration, migrations, and functions for the Supabase backend services (database, auth, storage).
- `tests/` — Automated tests and fixtures.
- Key root files:
  - `package.json` — Defines project dependencies, scripts, and metadata for the Node.js ecosystem.
  - `bun.lockb` — Lockfile for Bun package manager, ensuring reproducible installs alongside npm.
  - `package-lock.json` — NPM lockfile for dependency resolution.
  - `vite.config.ts` — Vite build tool configuration for development server, bundling, and optimization.
  - `tailwind.config.ts` — Tailwind CSS configuration for custom theming and utility classes.
  - `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript compiler options for the project, app, and Node environments.
  - `eslint.config.js` — ESLint configuration for code linting and style enforcement.
  - `postcss.config.js` — PostCSS configuration for CSS processing, integrated with Tailwind.
  - `playwright.config.ts` and `playwright.visual.config.ts` — Playwright setup for end-to-end and visual regression testing.
  - `vitest.config.ts` and `vitest.config.next.ts` — Vitest configuration for unit and component testing.
  - `lighthouserc.js` — Lighthouse configuration for performance audits.
  - `vercel.json` — Vercel deployment configuration for serverless hosting.
  - `README.md`, `CONTRIBUTING.md` — Project entry point and contribution guidelines.
  - Various `.md` files like `atas.md`, `implantacoes.md`, `tarefas.md`, `OPTIMIZATION_SUMMARY.md` — Custom documentation for meeting notes, implementations, tasks, and optimizations.

## Technology Stack Summary
- Primary runtimes: Node.js (for build and scripts), Bun (alternative package manager), web browser (for frontend).
- Languages: JavaScript/TypeScript (core), Markdown (documentation).
- Platforms: Web (client-side), Supabase (cloud backend for Postgres DB, auth, and edge functions).
- Build tooling: Vite (fast dev server and bundler), npm/Bun (dependency management).
- Linting and formatting: ESLint (code quality), Prettier (implied via ESLint setup), PostCSS (CSS transforms).

## Core Framework Stack
- Frontend: Vite + React (inferred from src structure and Vite config), with TypeScript for type safety.
- Backend: Supabase (Postgres database, Realtime subscriptions, Authentication, Storage).
- Data: Supabase client libraries for ORM-like interactions.
- Messaging: Supabase Realtime for live updates (e.g., collaborative editing).
- Architectural patterns: Component-based UI (React), modular monorepo structure, serverless backend with edge functions for low-latency operations.

## UI & Interaction Libraries
- UI kit: Tailwind CSS for utility-first styling, ensuring responsive and accessible designs.
- Design system: Custom theming via Tailwind config; follows accessibility standards (e.g., ARIA attributes, color contrast).
- Localization: No explicit i18n library detected; use React Context or similar for Portuguese/English support as needed.
- CLI helpers: Vite CLI for dev/build, Playwright for browser automation.

## Development Tools Overview
- Essential CLIs: `npm run dev` (Vite dev server), `npm run build` (production bundle), `npm run test` (Vitest/Playwright).
- Scripts: Custom utils in `scripts/` for deployments and optimizations.
- Environments: Local dev with Vite, CI/CD via Vercel or similar (configured in vercel.json).
- Link to [Tooling & Productivity Guide](./tooling.md) for deeper setup instructions.

## Getting Started Checklist
1. Install dependencies with `npm install` (or `bun install` if using Bun).
2. Explore the CLI by running `npm run dev`.
3. Review [Development Workflow](./development-workflow.md) for day-to-day tasks.

## Next Steps
Product positioning: Omnia serves as an internal tool for Loovus Comunicação, focusing on agile workflows for creative projects. Key stakeholders: Project managers and developers at Loovus. External links: Supabase dashboard (via supabase/ config), Vercel deployments. For product specs, refer to `tarefas.md` and `implantacoes.md` for ongoing features.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Review roadmap items or issues labelled “release” to confirm current goals.
2. Cross-check Quick Facts against `package.json` and environment docs.
3. Refresh the File Structure & Code Organization section to reflect new or retired modules; keep guidance actionable.
4. Link critical dashboards, specs, or runbooks used by the team.
5. Flag any details that require human confirmation (e.g., stakeholder ownership).

<!-- agent-readonly:sources -->
## Acceptable Sources
- Recent commits, release notes, or ADRs describing high-level changes.
- Product requirement documents linked from this repository.
- Confirmed statements from maintainers or product leads.

<!-- agent-update:end -->
