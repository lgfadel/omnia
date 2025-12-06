<!-- agent-update:start:agent-test-writer -->
# Test Writer Agent Playbook

## Mission
The Test Writer Agent supports the team by creating comprehensive unit, integration, and end-to-end tests that ensure code quality and prevent regressions. Engage this agent when implementing new features that need test coverage, improving coverage for existing modules, fixing flaky tests, or establishing testing patterns for new areas of the codebase. It ensures the test suite remains reliable, maintainable, and aligned with the project's testing strategy.

## Responsibilities
- Write comprehensive unit and integration tests
- Ensure good test coverage across the codebase
- Create test utilities and fixtures
- Maintain and update existing tests

## Best Practices
- Write tests that are clear and maintainable
- Test both happy path and edge cases
- Use descriptive test names

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Shared packages and utilities scoped for internal use in the monorepo, including common libraries and type definitions.
- `apps/` — Houses the primary applications, such as the web frontend built with modern frameworks like React or Next.js.
- `docs/` — Contains all project documentation, guides, and API references to onboard developers and maintain knowledge.
- `public/` — Static assets and files served directly by the web server, including images, fonts, and index.html.
- `scripts/` — Utility scripts for automation, such as build processes, deployments, linting, and database seeding.
- `src/` — Core source code directory for application logic, components, services, and business rules.
- `supabase/` — Supabase-specific configurations, including database migrations, seed data, and edge function deployments.
- `tests/` — Dedicated directory for integration, end-to-end, and snapshot tests, separate from unit tests colocated in src/.

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
- Achieve at least 80% code coverage for new features and maintain overall coverage above 75%.
- Ensure 100% of pull requests pass all test suites in CI before merging.
- Track trends over time to identify improvement areas, such as reducing flaky test incidents by 50% quarterly.

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

### Issue: Flaky Tests in CI
**Symptoms:** Tests pass locally but fail intermittently in CI pipelines
**Root Cause:** Non-deterministic behavior from timing issues, network dependencies, or shared test state
**Resolution:**
1. Reproduce the flakiness locally with repeated runs (e.g., `npm test -- --watch`).
2. Isolate the test and add explicit waits, mocks for external services, or retries for unstable APIs.
3. Update test setup to use fixed seeds for random data or isolated database instances via Supabase fixtures.
4. Commit and re-run CI to verify stability.
**Prevention:** Adopt test isolation patterns, use tools like MSW for API mocking, and run CI on consistent environments; review test reports regularly for flakiness patterns.

## Hand-off Notes
Summarize outcomes, remaining risks, and suggested follow-up actions after the agent completes its work.

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates.
- Command output or logs that informed recommendations.
- Follow-up items for maintainers or future agent runs.
- Performance metrics and benchmarks where applicable.
<!-- agent-update:end -->
