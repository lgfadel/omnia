<!-- agent-update:start:agent-documentation-writer -->
# Documentation Writer Agent Playbook

## Mission
The Documentation Writer Agent supports the team by creating, updating, and maintaining clear and comprehensive documentation across the project. Engage this agent when adding new features that require user guides, updating API references after code changes, improving README files, or ensuring that architecture and workflow docs stay in sync with the codebase. It ensures knowledge is accessible, accurate, and actionable for developers and contributors.

## Responsibilities
- Create clear, comprehensive documentation
- Update existing documentation as code changes
- Write helpful code comments and examples
- Maintain README and API documentation

## Best Practices
- Keep documentation up-to-date with code
- Write from the user's perspective
- Include practical examples

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Core project configuration, including package.json, tsconfig.json, and root-level scripts for the monorepo setup.
- `apps/` — Contains sub-applications, such as the main web app or admin dashboard, built with frameworks like Next.js.
- `docs/` — Houses all project documentation, including guides, API references, and architecture overviews in Markdown format.
- `public/` — Static assets like images, fonts, and favicons that are served directly to the client without processing.
- `scripts/` — Utility scripts for tasks like database migrations, environment setup, linting, or deployment automation.
- `src/` — Primary source code directory, organized by features or modules, containing components, services, and business logic.
- `supabase/` — Supabase-specific configurations, including database schemas, edge functions, auth policies, and migration files.
- `tests/` — Test suites, fixtures, and utilities for unit, integration, and end-to-end testing using Vitest and Playwright.

## Documentation Touchpoints
- [Documentation Index](../docs/README.md) — agent-update:docs-index
- [Project Overview](../docs/project-overview.md) — agent-update:project-overview
- [Architecture Notes](../docs/architecture.md) — agent-update:architecture-notes
- [Development Workflow](../docs/development-workflow.md) — agent-update:development-workflow
- [Testing Strategy](../docs/testing-strategy.md) — agent-update:testing-strategy
- [Glossary & Domain Concepts](../docs/glossary.md) — agent-update:glossary
- [Data Flow & Integrations](../docs/data-flow.md) — agent-update:data-flow
- [Security & Compliance Notes](../docs/security.md) — agent-update:security
- [Tooling & Productivity Guide](../docs/tooling.md) — agent-update:tooling

<!-- agent-readonly:guidance -->
## Collaboration Checklist
1. Confirm assumptions with issue reporters or maintainers.
2. Review open pull requests affecting this area.
3. Update the relevant doc section listed above and remove any resolved `agent-fill` placeholders.
4. Capture learnings back in [docs/README.md](../docs/README.md) or the appropriate task marker.

## Success Metrics
Track effectiveness of this agent's contributions:
- **Code Quality:** Reduced bug count, improved test coverage, decreased technical debt
- **Velocity:** Time to complete typical tasks, deployment frequency
- **Documentation:** Coverage of features, accuracy of guides, usage by team
- **Collaboration:** PR review turnaround time, feedback quality, knowledge sharing

**Target Metrics:**
- Ensure 100% of new features and PRs include updated or new documentation within 1 week of merge.
- Achieve 95% accuracy in documentation as measured by quarterly team reviews or contributor feedback surveys.
- Track trends over time to identify improvement areas, such as reducing outdated docs incidents by 50% annually through automated checks.

## Troubleshooting Common Issues
Document frequent problems this agent encounters and their solutions:

### Issue: Outdated Documentation After Code Changes
**Symptoms:** Guides reference deprecated APIs or missing new features, leading to user confusion.
**Root Cause:** Documentation not updated in sync with code merges or refactors.
**Resolution:**
1. Scan recent PRs and commits for changes in src/, apps/, or supabase/.
2. Cross-reference with existing docs using tools like grep or IDE search.
3. Draft updates in a feature branch and validate against live code.
4. Submit PR with clear diff highlights for affected sections.
**Prevention:** Integrate doc updates into PR templates and use CI checks to flag potential doc gaps.

### Issue: Build Failures Due to Outdated Dependencies
**Symptoms:** Tests fail with module resolution errors
**Root Cause:** Package versions incompatible with codebase
**Resolution:**
1. Review package.json for version ranges
2. Run `npm update` to get compatible versions
3. Test locally before committing
**Prevention:** Keep dependencies updated regularly, use lockfiles

## Hand-off Notes
Summarize outcomes, remaining risks, and suggested follow-up actions after the agent completes its work.

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates.
- Command output or logs that informed recommendations.
- Follow-up items for maintainers or future agent runs.
- Performance metrics and benchmarks where applicable.
<!-- agent-update:end -->
