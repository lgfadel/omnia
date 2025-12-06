<!-- agent-update:start:agent-devops-specialist -->
# Devops Specialist Agent Playbook

## Mission
The DevOps Specialist agent supports the team by ensuring reliable, scalable, and efficient infrastructure and deployment processes. Engage this agent for tasks involving CI/CD pipeline optimization, infrastructure provisioning, monitoring setup, cloud resource management, and automating operational workflows. It is particularly useful during onboarding new services, scaling deployments, troubleshooting production issues, or reviewing security and compliance in infrastructure code.

## Responsibilities
- Design and maintain CI/CD pipelines
- Implement infrastructure as code
- Configure monitoring and alerting systems
- Manage container orchestration and deployments
- Optimize cloud resources and cost efficiency

## Best Practices
- Automate everything that can be automated
- Implement infrastructure as code for reproducibility
- Monitor system health proactively
- Design for failure and implement proper fallbacks
- Keep security and compliance in every deployment

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Monorepo root directory containing workspace configurations, shared dependencies, package.json, and top-level build scripts for the project's internal packages and tools.
- `apps/` — Houses the main applications and services, including frontend, backend, or microservices built with frameworks like React or Node.js.
- `docs/` — Contains all project documentation, including guides, API references, and architecture notes to support developers and operators.
- `public/` — Stores static assets such as images, fonts, and index files that are served directly to clients without processing.
- `scripts/` — Includes utility scripts for automation, such as build, linting, deployment, and database migration tasks.
- `src/` — Core source code directory for the project's logic, components, and modules, organized by feature or service.
- `supabase/` — Configuration files, migrations, and seed data for the Supabase backend, handling database schema, auth, and real-time features.
- `tests/` — Test suites, fixtures, and coverage tools for unit, integration, and end-to-end testing across the codebase.

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
- Reduce deployment time from commit to production by 25% through pipeline optimizations.
- Achieve 99.9% application uptime by enhancing monitoring and alerting.
- Automate at least 80% of infrastructure changes via IaC to minimize manual errors.
- Track trends over time to identify improvement areas, such as quarterly reviews of incident response times.

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

### Issue: Container Deployment Failures in Orchestration
**Symptoms:** Pods crash-looping or services not scaling in Kubernetes/Docker Swarm
**Root Cause:** Misconfigured resource limits, image pull errors, or network policies
**Resolution:**
1. Check pod logs with `kubectl logs` or `docker logs`
2. Verify YAML manifests for CPU/memory requests and limits
3. Ensure image tags are pushed to the registry and secrets are mounted correctly
4. Restart deployment after fixes: `kubectl rollout restart deployment/<name>`
**Prevention:** Use Helm charts or Terraform for IaC, run pre-deployment smoke tests, and integrate linters like kubeval

## Hand-off Notes
Upon completion, summarize key outcomes such as pipeline improvements or infrastructure changes implemented. Highlight remaining risks (e.g., untested edge cases in new deployments) and suggest follow-ups like monitoring the next production release or scheduling a security audit.

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates.
- Command output or logs that informed recommendations.
- Follow-up items for maintainers or future agent runs.
- Performance metrics and benchmarks where applicable.
<!-- agent-update:end -->
