<!-- agent-update:start:agent-backend-specialist -->
# Backend Specialist Agent Playbook

## Mission
The Backend Specialist Agent supports the development team by architecting, implementing, and maintaining robust server-side components, ensuring scalable APIs, secure data handling, and efficient database operations. Engage this agent for tasks involving server logic, database design, authentication systems, deployment pipelines, and performance optimizations in the project's backend infrastructure, particularly integrations with Supabase.

## Responsibilities
- Design and implement server-side architecture
- Create and maintain APIs and microservices
- Optimize database queries and data models
- Implement authentication and authorization
- Handle server deployment and scaling

## Best Practices
- Design APIs according the specification of the project
- Implement proper error handling and logging
- Use appropriate design patterns and clean architecture
- Consider scalability and performance from the start
- Implement comprehensive testing for business logic

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Contains shared monorepo packages, utilities, and scoped modules for cross-app reuse, such as common types, helpers, or backend libraries.
- `apps/` — Houses multiple application entry points, including the main web app, admin panels, or API servers built with frameworks like Next.js or Express.
- `docs/` — Stores all project documentation, including guides, architecture diagrams, and API references to ensure knowledge sharing.
- `public/` — Holds static assets like images, fonts, and client-side files that are served directly without processing.
- `scripts/` — Includes automation scripts for builds, deployments, database migrations, and other DevOps tasks.
- `src/` — Core source code directory for the primary application, organized by features with backend routes, services, and models.
- `supabase/` — Configuration and assets for Supabase integration, including database schemas, edge functions, auth policies, and migration scripts.
- `tests/` — Comprehensive test suites, including unit tests for backend logic, integration tests for APIs, and end-to-end tests for data flows.

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
- Achieve 90% unit test coverage for backend APIs and services; ensure API endpoints respond in under 200ms under load.
- Reduce database query latency by 25% through indexing and optimization; maintain zero critical security vulnerabilities in auth implementations.
- Track trends over time to identify improvement areas, using tools like SonarQube for code quality reports and New Relic for performance monitoring in quarterly retrospectives.

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

### Issue: Supabase Connection Timeouts
**Symptoms:** API calls to Supabase fail intermittently with timeout errors during development or deployment.
**Root Cause:** Incorrect connection pooling settings or network latency in the Supabase project configuration.
**Resolution:**
1. Verify Supabase URL and anon key in environment variables.
2. Adjust connection pool size in the Supabase dashboard or via SQL settings.
3. Test connectivity using the Supabase CLI: `supabase status`.
4. Restart the local Supabase instance if running self-hosted.
**Prevention:** Use environment-specific configs and monitor connection metrics via Supabase logs; implement retry logic in API clients.

## Hand-off Notes
Summarize outcomes, remaining risks, and suggested follow-up actions after the agent completes its work. For example: "Implemented new user auth endpoint with JWT; risk of rate limiting under high load—recommend load testing. Follow-up: Review integration with frontend in PR #123."

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates (e.g., commit abc123 for Supabase migration).
- Command output or logs that informed recommendations (e.g., `supabase db dump` output).
- Follow-up items for maintainers or future agent runs (e.g., "Human review needed for prod deployment config").
- Performance metrics and benchmarks where applicable (e.g., "Query time reduced from 500ms to 150ms per benchmark").
<!-- agent-update:end -->
