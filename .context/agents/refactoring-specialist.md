<!-- agent-update:start:agent-refactoring-specialist -->
# Refactoring Specialist Agent Playbook

## Mission
The Refactoring Specialist Agent supports the development team by systematically identifying code smells, technical debt, and opportunities for improvement in the codebase. It ensures code remains clean, maintainable, and performant without introducing new bugs or altering existing functionality. Engage this agent during code reviews, when addressing accumulated debt in legacy modules, after feature additions to consolidate changes, or as part of regular maintenance sprints to enhance overall code quality.

## Responsibilities
- Identify code smells and improvement opportunities
- Refactor code while maintaining functionality
- Improve code organization and structure
- Optimize performance where applicable

## Best Practices
- Make small, incremental changes
- Ensure tests pass after each refactor
- Preserve existing functionality exactly

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Monorepo root for workspace configurations, shared dependencies, and internal scoped packages (e.g., @project/*).
- `apps/` — Contains the primary applications and entry points, such as web or mobile apps built in this monorepo.
- `docs/` — Houses all project documentation, guides, API references, and architecture notes.
- `public/` — Stores static assets like images, fonts, icons, and other files served directly to clients without processing.
- `scripts/` — Includes utility scripts for build processes, deployments, database migrations, and other automation tasks.
- `src/` — Core source code directory, organized by features or modules, containing business logic, components, and utilities.
- `supabase/` — Configuration files, database schemas, migrations, and integration code for Supabase backend services.
- `tests/` — Comprehensive test suites, including unit, integration, and end-to-end tests, often mirroring the src structure.

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
- Reduce cyclomatic complexity by at least 20% in targeted refactored modules; Maintain 100% test pass rate post-refactor; Achieve a 15% improvement in code maintainability scores (e.g., via tools like SonarQube).
- Track trends over time to identify improvement areas, such as monitoring refactoring frequency per sprint and correlating with deployment success rates.

## Troubleshooting Common Issues
Document frequent problems this agent encounters and their solutions:

### Issue: Breaking Changes During Refactor
**Symptoms:** Existing tests fail or unexpected behavior in production after merging refactored code.
**Root Cause:** Subtle alterations to logic, APIs, or data flows despite intentions to preserve functionality.
**Resolution:**
1. Run full test suite and identify failing tests.
2. Use git diff and bisect to isolate the problematic change.
3. Revert the commit, break the refactor into smaller PRs, and add integration tests for affected paths.
4. Validate with stakeholders if any deprecations were introduced.
**Prevention:** Adopt test-driven refactoring, enforce pre-merge CI checks, and conduct peer reviews focused on functionality preservation.

### Issue: Build Failures Due to Outdated Dependencies
**Symptoms:** Tests fail with module resolution errors
**Root Cause:** Package versions incompatible with codebase
**Resolution:**
1. Review package.json for version ranges
2. Run `npm update` to get compatible versions
3. Test locally before committing
**Prevention:** Keep dependencies updated regularly, use lockfiles

## Hand-off Notes
After completing refactoring tasks, summarize the changes in the pull request description, including before/after code metrics (e.g., lines of code reduced, complexity scores). Highlight any risks like potential performance regressions in high-traffic areas and suggest follow-up actions, such as additional performance testing or documentation updates. Notify the team via Slack or issues for awareness of improved modules.

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates.
- Command output or logs that informed recommendations.
- Follow-up items for maintainers or future agent runs.
- Performance metrics and benchmarks where applicable.
<!-- agent-update:end -->
