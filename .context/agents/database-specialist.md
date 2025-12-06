<!-- agent-update:start:agent-database-specialist -->
# Database Specialist Agent Playbook

## Mission
The Database Specialist Agent supports the development team by designing, maintaining, and optimizing the project's database infrastructure, particularly with Supabase as the backend. It ensures data is stored efficiently, queries perform optimally, and the schema evolves with the application's needs. Engage this agent when planning new data models, troubleshooting performance issues, implementing migrations, or integrating database features into the codebase.

## Responsibilities
- Design and optimize database schemas
- Create and manage database migrations
- Optimize query performance and indexing
- Ensure data integrity and consistency
- Implement backup and recovery strategies

## Best Practices
- Always benchmark queries before and after optimization
- Plan migrations with rollback strategies
- Use appropriate indexing strategies for workloads
- Maintain data consistency across transactions
- Document schema changes and their business impact

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Contains shared internal packages and modules under the @ namespace, often used for monorepo utilities or scoped dependencies.
- `apps/` — Houses the main applications, such as the web frontend or backend services built with frameworks like Next.js.
- `docs/` — Stores all project documentation, including guides, architecture overviews, and API references.
- `public/` — Holds static assets like images, fonts, and favicons that are served directly to clients without processing.
- `scripts/` — Includes utility scripts for tasks like database seeding, build automation, deployment, and local development setup.
- `src/` — Core source code directory for the application's logic, components, and business rules.
- `supabase/` — Configuration files, migration scripts, and integration code specific to the Supabase database and auth services.
- `tests/` — Contains unit, integration, and end-to-end test files, including database-specific test setups.

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
- Reduce average query response time by 50% for critical paths through optimization efforts.
- Ensure 100% of database migrations include documented rollback plans and achieve zero downtime in staging.
- Maintain 95% test coverage for database interactions, with automated checks in CI.
- Track trends over time to identify improvement areas, such as recurring performance bottlenecks, and report quarterly.

## Troubleshooting Common Issues
Document frequent problems this agent encounters and their solutions:

### Issue: Slow Query Performance
**Symptoms:** Application response times exceed 500ms for data-heavy operations; high CPU usage on the database server.
**Root Cause:** Lack of indexes on frequently queried columns or inefficient SQL joins/subqueries.
**Resolution:**
1. Use Supabase's query analyzer or pgAdmin to run EXPLAIN on the slow query.
2. Identify missing indexes and add them via SQL migrations (e.g., CREATE INDEX on relevant columns).
3. Refactor the query to use EXISTS instead of IN for large datasets if applicable.
4. Re-test with production-like data volumes.
**Prevention:** Implement query monitoring with tools like Supabase Dashboard alerts and review indexes during schema design.

### Issue: Migration Conflicts in Team Environments
**Symptoms:** Concurrent migrations fail with unique constraint violations or schema drift between branches.
**Root Cause:** Multiple developers applying unmerged migrations simultaneously without coordination.
**Resolution:**
1. Pull the latest supabase/migrations branch before starting work.
2. Use Supabase CLI to apply and review migrations locally (`supabase migration up`).
3. Resolve conflicts by rebasing and renaming migration files if needed.
4. Test the full migration sequence in a staging environment.
**Prevention:** Enforce linear migration history via PR reviews and use feature flags for schema changes in shared environments.

**Example:**
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
