<!-- agent-update:start:tooling -->
# Tooling & Productivity Guide

Collect the scripts, automation, and editor settings that keep contributors efficient.

## Required Tooling
- **Node.js** (v18 or higher) — Download and install from [nodejs.org](https://nodejs.org/). Required for running the application, executing scripts, and managing dependencies via the npm package manager. Verify installation with `node --version`.
- **Git** (v2.30 or higher) — Install from [git-scm.com](https://git-scm.com/). Essential for version control, cloning the repository, and contributing changes. Configure with `git config --global user.name "Your Name"` and `git config --global user.email "your.email@example.com"`.
- **Supabase CLI** (latest stable) — Install via `npm install -g supabase` or Homebrew (`brew install supabase/tap/supabase`). Powers local database emulation, migrations, and Supabase project management. See [Supabase CLI docs](https://supabase.com/docs/guides/cli) for setup.

## Recommended Automation
- **Pre-commit hooks** — If configured via Husky and lint-staged in `package.json`, run `npm install` to set up; it automatically formats code with Prettier and runs ESLint on staged files before commits.
- **Linting and formatting** — Use `npm run lint` for ESLint checks. Integrate into CI via GitHub Actions for automated enforcement.
- **Dependency management** — Use npm for dependency management: Run `npm install` to install all packages from `package.json`.
- **Build and dev scripts** — Run `npm run dev` for hot-reload development server (Vite). Use `npm run build` for production bundles. Utility scripts are available in `/scripts`.
- **Testing automation** — `npm test` runs Vitest. Configure CI to run full suites on PRs.

## IDE / Editor Setup
- **VS Code extensions**:
  - ESLint (by Microsoft) — Integrates linting directly in the editor for real-time feedback.
  - Prettier - Code formatter (by Prettier) — Auto-formats on save; configure in `.prettierrc`.
  - Tailwind CSS IntelliSense (by Tailwind Labs) — If using Tailwind; provides autocompletion for classes.
  - Supabase (by Supabase) — For SQL editing and Supabase-specific snippets.
  - GitLens (by GitKraken) — Enhances Git integration with blame and history views.
- **Workspace settings** — Use the provided `.vscode/settings.json` for shared configurations like TypeScript validation and emmet abbreviations. Enable format-on-save: `"editor.formatOnSave": true`.
- **Snippets** — Install "React Snippets" or create custom ones for common patterns like AI agent playbooks (e.g., YAML front matter templates).

## Productivity Tips
- **Terminal aliases** — Add to `~/.zshrc` or `~/.bashrc`: `alias dev='npm run dev'`, `alias testw='npm test -- --watch'`. This speeds up common workflows.
- **Local emulators** — Use Supabase local setup (`supabase start`) to mirror production DB without cloud costs.
- **Shared scripts** — Check `/scripts` for utilities like SQL migrations and cleanup scripts. Configuration files (e.g., `eslint.config.js`, `tsconfig.json`) are in the root for consistency.
- **Review shortcuts** — Use `npm run lint -- --fix` during PR prep to auto-resolve issues, and GitHub's diff view with syntax highlighting for faster code reviews.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Verify commands align with the latest scripts and build tooling.
2. Remove instructions for deprecated tools and add replacements.
3. Highlight automation that saves time during reviews or releases.
4. Cross-link to runbooks or README sections that provide deeper context.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Onboarding docs, internal wikis, and team retrospectives.
- Script directories, package manifests, CI configuration.
- Maintainer recommendations gathered during pairing or code reviews.

<!-- agent-update:end -->
