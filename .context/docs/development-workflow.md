<!-- agent-update:start:development-workflow -->
# Development Workflow

Outline the day-to-day engineering process for this repository.

## Branching & Releases
- This repository follows a trunk-based development model, where developers create short-lived feature branches (e.g., `feature/user-auth`) from `main` and merge via pull requests. Hotfixes use `hotfix/*` branches from the latest release tag.
- Releases follow semantic versioning (SemVer) with tags like `v1.2.3`. Cadence is on-demand for minor/patch releases, with major releases aligned to quarterly roadmaps. Automated releases are triggered via CI on merges to `main` after passing all checks (see `package.json` scripts and GitHub Actions workflows for details).

## Local Development
- Commands to install dependencies: `npm install` (this installs all dependencies listed in `package.json`, including dev tools for Vite, React, Supabase, and testing).
- Run the dev server locally: `npm run dev` (starts the Vite development server at `http://localhost:5173`).
- Build for distribution: `npm run build` (compiles the application for production; outputs to `dist/`).
- Additional setup: Clone the repo, then set up Supabase environment variables in a `.env.local` file (copy from `.env.example`). For testing: `npm test` to run the full suite.

## Code Review Expectations
- All changes must be submitted as pull requests (PRs) targeting `main`. PRs require: (1) passing CI checks (linting, tests, build), (2) at least one approval, and (3) no conflicts. Use checklists in PR templates for self-review (e.g., docs updated, tests added).
- Reference [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines and collaboration tips.

## Onboarding Tasks
- Newcomers should start with issues labeled `good first issue` or `help wanted` in the GitHub issue tracker.
- Set up your local environment following the quickstart in `README.md`. Review the Supabase configuration in `supabase/config.toml` for backend setup.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Confirm branching/release steps with CI configuration and recent tags.
2. Verify local commands against `package.json`; ensure flags and scripts still exist.
3. Capture review requirements (approvers, checks) from contributing docs or repository settings.
4. Refresh onboarding links (boards, dashboards) to their latest URLs.
5. Highlight any manual steps that should become automation follow-ups.

<!-- agent-readonly:sources -->
## Acceptable Sources
- CONTRIBUTING guidelines and `AGENTS.md`.
- Build pipelines, branch protection rules, or release scripts.
- Issue tracker boards used for onboarding or triage.

<!-- agent-update:end -->
