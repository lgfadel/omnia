<!-- agent-update:start:agent-feature-developer -->
# Feature Developer Agent Playbook

## Mission
The Feature Developer Agent supports the team by turning high-level requirements and specifications into production-ready code. Engage this agent when starting implementation on new features, refactoring existing ones, or integrating third-party services. It ensures features are robust, testable, and aligned with the project's architecture, reducing technical debt and accelerating delivery.

## Responsibilities
- Implement new features according to specifications
- Design clean, maintainable code architecture
- Integrate features with existing codebase
- Write comprehensive tests for new functionality

## Best Practices
- Follow existing patterns and conventions
- Consider edge cases and error handling
- Write tests alongside implementation

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Shared packages and monorepo workspaces, including common utilities, types, and configurations used across applications.
- `apps/` — Main applications, such as the web frontend, admin dashboard, or other deployable services built with frameworks like Next.js or React.
- `docs/` — Project documentation, including guides, architecture overviews, and API references to onboard contributors and maintain knowledge.
- `public/` — Static assets served directly by the web server, such as images, fonts, favicons, and other non-buildable files.
- `scripts/` — Automation scripts for tasks like building, linting, deploying, database migrations, and environment setup.
- `src/` — Core source code directory containing application logic, components, services, and business rules organized by feature or module.
- `supabase/` — Supabase-specific configurations, including database schemas, migrations, auth policies, storage setups, and edge functions.
- `tests/` — Test suites for unit, integration, and end-to-end testing, using tools like Jest, Playwright, or Vitest, often mirroring the src structure.

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
- Achieve at least 90% test coverage for all new features implemented.
- Reduce average bug resolution time by 30% through proactive testing and edge case handling.
- Ensure 95% of pull requests pass CI checks on the first submission.
- Track trends over time using GitHub Insights or similar tools to identify improvement areas, such as recurring integration issues.

## Troubleshooting Common Issues
Document frequent problems this agent encounters and their solutions:

### Issue: [Common Problem]
**Symptoms:** Describe what indicates this problem
**Root Cause:** Why this happens
**Resolution:** Step-by-step fix
**Prevention:** How to avoid in the future

**Example:**
### Issue: Build Failures Due to Outdated Dependencies
**Symptoms:** Tests fail with module resolution errors
**Root Cause:** Package versions incompatible with codebase
**Resolution:**
1. Review package.json for version ranges
2. Run `npm update` to get compatible versions
3. Test locally before committing
**Prevention:** Keep dependencies updated regularly, use lockfiles

### Issue: Supabase Integration Errors During Feature Deployment
**Symptoms:** Database queries fail or auth tokens are invalid in staging/production
**Root Cause:** Mismatched schema between local Supabase instance and remote, or unapplied migrations
**Resolution:**
1. Run `supabase db diff` to identify schema differences
2. Apply migrations with `supabase db push`
3. Verify environment variables in `.env` match the Supabase project settings
4. Test auth flows end-to-end locally
**Prevention:** Sync local Supabase with remote before starting feature work and include migration steps in PR checklists

## Hand-off Notes
After completing feature implementation, summarize outcomes in the PR description: include what was built, any deviations from specs, performance benchmarks (e.g., query times), remaining risks (e.g., scalability under load), and suggested follow-ups like UX review or monitoring setup. Tag relevant docs for updates and notify maintainers for review.

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates.
- Command output or logs that informed recommendations.
- Follow-up items for maintainers or future agent runs.
- Performance metrics and benchmarks where applicable.
<!-- agent-update:end -->
