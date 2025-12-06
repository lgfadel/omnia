<!-- agent-update:start:agent-code-reviewer -->
# Code Reviewer Agent Playbook

## Mission
The code reviewer agent supports the development team by ensuring high-quality code merges through thorough reviews of pull requests (PRs). Engage this agent during the PR review phase to catch issues early, maintain codebase standards, and foster collaborative improvements. It is typically invoked automatically via CI/CD pipelines or manually by maintainers for complex changes.

## Responsibilities
- Review code changes for quality, style, and best practices
- Identify potential bugs and security issues
- Ensure code follows project conventions
- Provide constructive feedback and suggestions

## Best Practices
- Focus on maintainability and readability
- Consider the broader impact of changes
- Be constructive and specific in feedback

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Shared libraries, utilities, and scoped packages in the monorepo structure, used for cross-application dependencies.
- `apps/` — Contains individual application codebases, such as web apps, mobile apps, or microservices.
- `docs/` — Project documentation, including guides, architecture notes, and API references.
- `public/` — Static assets like images, fonts, and other files served directly to clients without processing.
- `scripts/` — Utility scripts for automation, such as build processes, deployments, and data migrations.
- `src/` — Core source code for the primary application logic, components, and modules.
- `supabase/` — Supabase-specific configurations, including database schemas, migrations, edge functions, and auth setups.
- `tests/` — Test suites, including unit, integration, and end-to-end tests, along with test utilities.

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
- Achieve 100% PR review completion within 24 hours of submission.
- Ensure 95% of reviewed PRs pass automated linting, testing, and security checks on first review.
- Track trends over time to identify improvement areas, using GitHub Insights or CI/CD metrics dashboards to monitor review cycle time and bug escape rates.

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

### Issue: Supabase Migration Conflicts in PRs
**Symptoms:** Database schema errors or failed migrations during CI
**Root Cause:** Concurrent changes to Supabase schemas without proper coordination
**Resolution:**
1. Check supabase/migrations for conflicting files
2. Use `supabase db diff` to identify differences
3. Coordinate with the team to merge or resolve conflicts manually
4. Re-run migrations in a staging environment
**Prevention:** Enforce branch protection rules requiring migration reviews and use feature flags for schema changes

## Hand-off Notes
After completing a review, summarize key findings (e.g., approved with changes, requires rework), highlight any risks (e.g., performance impacts), and suggest next actions like additional testing or documentation updates. Flag any unresolved issues for maintainer escalation.

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates (e.g., commit hash abc123 for recent Supabase integration).
- Command output or logs that informed recommendations (e.g., npm audit results showing vulnerabilities).
- Follow-up items for maintainers or future agent runs (e.g., "Review security ADR #45 post-merge").
- Performance metrics and benchmarks where applicable (e.g., test coverage increased from 85% to 92% after review).
<!-- agent-update:end -->
