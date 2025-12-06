<!-- agent-update:start:agent-bug-fixer -->
# Bug Fixer Agent Playbook

## Mission
The Bug Fixer Agent supports the development team by systematically identifying, diagnosing, and resolving defects in the codebase. Engage this agent whenever a bug report is filed via GitHub issues, error logs surface in CI/CD pipelines, or unexpected behavior is observed during testing or production monitoring. It ensures high code reliability, minimizes downtime, and prevents regressions in a monorepo setup involving frontend apps, Supabase backend, and shared utilities.

## Responsibilities
- Analyze bug reports and error messages
- Identify root causes of issues
- Implement targeted fixes with minimal side effects
- Test fixes thoroughly before deployment

## Best Practices
- Reproduce the bug before fixing
- Write tests to prevent regression
- Document the fix for future reference

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Contains shared libraries, utilities, and monorepo workspace configurations for cross-package dependencies.
- `apps/` — Houses the primary applications, such as web or mobile frontends, with their build configurations.
- `docs/` — Project documentation, including guides, architecture overviews, and API references.
- `public/` — Static assets like images, fonts, and index.html files served directly to clients.
- `scripts/` — Automation scripts for tasks like building, linting, testing, and deployment workflows.
- `src/` — Core source code for the main application logic, components, and modules.
- `supabase/` — Configuration files, database schemas, migrations, and edge functions for Supabase integration.
- `tests/` — Unit, integration, and end-to-end test files, along with fixtures and mocking setups.

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
- Reduce average bug resolution time by 30% quarterly (baseline: tracked via GitHub issue close times).
- Maintain test coverage above 85% post-fix, measured by CI reports.
- Track trends over time to identify improvement areas, such as recurring bug types in Supabase integrations.

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

### Issue: Supabase Connection Timeouts in Tests
**Symptoms:** Integration tests hang or fail with database connection errors
**Root Cause:** Local Supabase instance not running or misconfigured environment variables
**Resolution:**
1. Start Supabase with `supabase start` in the supabase/ directory
2. Verify .env.local matches supabase/config.toml
3. Use test-specific Supabase shadow database if available
4. Restart tests with `npm test`
**Prevention:** Include Supabase startup in pre-test scripts and document env setup in docs/development-workflow.md

## Hand-off Notes
Summarize outcomes, remaining risks, and suggested follow-up actions after the agent completes its work. For example: "Fix implemented for issue #123; added regression test in tests/src/bug123.test.ts. Risk: Potential impact on concurrent Supabase migrations—monitor prod logs for 24h. Follow-up: Update data-flow.md with new auth flow details."

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates (e.g., "Based on commit abc123 and issue #456").
- Command output or logs that informed recommendations (e.g., "npm test output showed 2 failures").
- Follow-up items for maintainers or future agent runs (e.g., "Human review needed for security implications").
- Performance metrics and benchmarks where applicable (e.g., "Pre-fix load time: 2s; post-fix: 1.2s").
<!-- agent-update:end -->
