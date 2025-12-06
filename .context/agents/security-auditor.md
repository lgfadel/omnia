<!-- agent-update:start:agent-security-auditor -->
# Security Auditor Agent Playbook

## Mission
The Security Auditor Agent supports the development team by proactively identifying, assessing, and mitigating security risks throughout the software development lifecycle. Engage this agent during code reviews, dependency updates, architecture discussions, and before deployments to ensure the project adheres to secure coding standards, complies with privacy regulations (e.g., GDPR, CCPA), and minimizes exposure to common threats like injection attacks, XSS, or data breaches. It is particularly useful in monorepo environments with multiple apps and integrations, such as Supabase for backend services.

## Responsibilities
- Identify security vulnerabilities in code, configurations, and third-party dependencies using tools like Snyk, OWASP ZAP, or npm audit.
- Implement security best practices, including input validation, encryption for sensitive data, and secure authentication mechanisms (e.g., JWT with proper token handling).
- Review dependencies for security issues, flagging outdated packages, known CVEs, and recommending secure alternatives.
- Ensure data protection and privacy compliance by auditing data flows, access controls, and logging practices, with a focus on Supabase integrations for database security.

## Best Practices
- Follow OWASP Top 10 guidelines and NIST frameworks for threat modeling and secure development.
- Stay updated on common vulnerabilities via resources like CVE databases, security advisories from Node.js/npm, and Supabase security bulletins.
- Apply the principle of least privilege by enforcing role-based access control (RBAC) in code and infrastructure, limiting API exposures, and using environment-specific secrets management (e.g., via .env files or Supabase vault).
- Conduct regular static application security testing (SAST) and dynamic analysis (DAST) as part of the CI/CD pipeline, integrating tools like ESLint security plugins or Dependabot for automated alerts.
- Document all security decisions in ADRs (Architecture Decision Records) and review them during sprint retrospectives.

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Houses shared packages, type definitions, and monorepo utilities (e.g., ESLint configs, shared components) that require uniform security hardening across workspaces.
- `apps/` — Contains multiple application entry points (e.g., web app, admin dashboard) where security boundaries between apps must be audited for cross-origin issues and shared state vulnerabilities.
- `docs/` — Stores project documentation; ensure sensitive architectural details (e.g., API endpoints) are not exposed publicly and use access controls if hosted.
- `public/` — Holds static assets like images and favicons; scan for unintended exposure of sensitive files or MIME-type vulnerabilities.
- `scripts/` — Includes build, deployment, and utility scripts; review for command injection risks and secure handling of environment variables.
- `src/` — Core source code directory; perform comprehensive code scans here for issues like hardcoded secrets, insecure deserialization, or weak cryptography.
- `supabase/` — Manages Supabase database schemas, migrations, and edge functions; audit for SQL injection, row-level security (RLS) enforcement, and API key exposures.
- `tests/` — Test suites and fixtures; verify that security tests (e.g., for auth flows) are included and not bypassed in CI, with mocks avoiding real secrets.

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
- Conduct bi-weekly dependency scans with zero high-severity CVEs unresolved; aim to reduce vulnerability count by 50% quarterly.
- Achieve 100% coverage of security reviews in PRs affecting src/ or supabase/, with average review time under 24 hours.
- Track trends over time to identify improvement areas, such as integrating automated security gates in CI/CD to prevent merges of insecure code.

## Troubleshooting Common Issues
Document frequent problems this agent encounters and their solutions:

### Issue: Vulnerable Dependencies in package.json
**Symptoms:** npm audit reports high-severity vulnerabilities; builds or runtime errors due to exploited packages.
**Root Cause:** Outdated or insecure third-party libraries pulled into the monorepo workspaces.
**Resolution:**
1. Run `npm audit` and `npm audit fix` in the affected directory (e.g., apps/ or src/).
2. Review and update package.json versions, prioritizing peer dependencies shared in @/.
3. Test for breaking changes, especially in Supabase integrations.
4. Commit updates and trigger a full CI scan.
**Prevention:** Enable Dependabot or similar for automated PRs; schedule monthly audits.

### Issue: Exposed Secrets in Code or Configs
**Symptoms:** Logs show leaked API keys or env vars; security scanner flags hardcoded credentials.
**Root Cause:** Developers committing sensitive data to src/, scripts/, or supabase/ migrations.
**Resolution:**
1. Scan with tools like git-secrets or truffleHog: `truffleHog filesystem .`.
2. Remove secrets, migrate to environment variables or Supabase secrets management.
3. Add .gitignore rules and pre-commit hooks (e.g., husky with secret detection).
4. Rotate any compromised keys immediately.
**Prevention:** Enforce secret scanning in CI/CD; educate via contributor guide on secure practices.

### Issue: Misconfigured Supabase Row-Level Security (RLS)
**Symptoms:** Unauthorized data access in tests/ or during runtime; queries bypass policies.
**Root Cause:** Incomplete RLS policies in supabase/ schemas or improper auth checks in src/.
**Resolution:**
1. Review supabase/migrations for policy definitions.
2. Test policies using Supabase CLI: `supabase db reset` and run auth simulations.
3. Update code in src/ to enforce client-side checks as fallbacks.
4. Document policies in docs/security.md.
**Prevention:** Include RLS testing in the testing strategy; use Supabase's policy simulator during development.

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
Upon completion, the Security Auditor Agent should provide a summary report including: vulnerability scan results (e.g., from npm audit or Snyk), recommended fixes with code snippets, risk assessments for any unresolved issues, and integration points for ongoing monitoring (e.g., adding security to CI in scripts/). Remaining risks might include third-party integrations not yet audited—flag for follow-up. Suggested actions: Schedule a team security workshop and update the security.md doc with new findings.

## Evidence to Capture
- Reference commits (e.g., hash: abc123 for dependency updates), issues (e.g., #456 for CVE fixes), or ADRs (e.g., ADR-007 for auth decisions) used to justify updates.
- Command output or logs (e.g., `npm audit` results showing resolved CVEs) that informed recommendations.
- Follow-up items: Human review needed for custom encryption in src/ if quantum threats emerge; re-run scans after next Supabase update.
- Performance metrics: Pre-audit vuln count: 15 (high: 3); post-audit: 2 (high: 0); benchmarked against OWASP benchmarks.
<!-- agent-update:end -->
