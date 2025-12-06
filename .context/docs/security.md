<!-- agent-update:start:security -->
# Security & Compliance Notes

Capture the policies and guardrails that keep this project secure and compliant.

## Authentication & Authorization
This project leverages Supabase for authentication and authorization. Supabase Auth supports multiple identity providers including email/password, magic links, and OAuth providers (e.g., Google, GitHub). Tokens are issued as JWTs with configurable expiration times. Sessions are managed client-side using Supabase's JavaScript client library, which handles token refresh automatically.

Authorization is enforced via Supabase's Row Level Security (RLS) policies on the PostgreSQL database. Roles include anonymous users, authenticated users, and custom roles defined in the Supabase dashboard. Permissions are granular, allowing policies based on user ID, roles, or custom attributes. For example, RLS policies restrict data access to authenticated users only, with admin roles granting broader access. Client-side enforcement is supplemented by server-side checks in API routes (e.g., in `src/` or `apps/`).

Cross-reference: See `supabase/config.toml` for configuration details and `src/stores/authStore.ts` for auth implementation.

## Secrets & Sensitive Data
Secrets are managed through environment variables and Supabase's built-in secret storage. Key secrets include:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` for database and auth connections.
- API keys for third-party services (e.g., if integrated in `scripts/` or `tests/`).
- No secrets are committed to the repository; they are loaded via `.env` files (gitignored) or deployment platform secrets (e.g., Vercel, Netlify).

Rotation cadence: Secrets should be rotated quarterly or immediately upon suspected compromise. Encryption is handled at rest by Supabase's PostgreSQL (AES-256) and in transit via TLS 1.3. Data classification follows a simple model: public (e.g., `public/` assets), internal (app data in `src/`), and sensitive (user PII in Supabase tables, requiring RLS).

Access to secrets is restricted to project maintainers via CI/CD pipelines (e.g., GitHub Actions if configured). For local development, use `scripts/setup-env.sh` to generate placeholder env files.

Cross-reference: See `.env.example` in the project root for required environment variables.

## Compliance & Policies
This project adheres to basic web application standards but does not target specific certifications like GDPR, SOC2, or HIPAA unless required by deployments. Internal policies include:
- Data minimization: Collect only necessary user data via Supabase Auth.
- Privacy: User consent for OAuth logins; no tracking cookies in `public/` assets.
- Vulnerability scanning: Run `npm audit` in CI for dependencies in `package.json`.

Evidence: Regular scans via GitHub Dependabot (if enabled) and Supabase's built-in audit logs. For compliance updates, monitor Supabase's security advisories. If GDPR applies (e.g., EU users), implement data export/deletion endpoints in `apps/`.

No current audit findings; future obligations would be tracked in repository issues labeled "compliance".

Cross-reference: Review Supabase RLS policies in `supabase/migrations/` for data access controls.

## Incident Response
- **Detection**: Monitor Supabase dashboard for anomalies (e.g., failed logins, unusual queries). Use browser console logs and server-side error reporting (e.g., Sentry if integrated).
- **On-Call Contacts**: Primary: Project maintainers via GitHub issues or Slack/Discord (if set up). Escalate to Supabase support for infrastructure issues.
- **Escalation Steps**:
  1. Triage: Isolate affected services (e.g., pause `apps/` deployments).
  2. Contain: Revoke compromised tokens via Supabase Auth API.
  3. Eradicate/Recover: Rotate secrets, restore from backups (Supabase point-in-time recovery).
  4. Post-Incident: Document in a new issue with labels "security" and "incident"; conduct root cause analysis.
- **Tooling**: Supabase logs, GitHub Actions for alerts, and local `tests/` for replaying incidents.

Last updated: Based on Supabase v2.x defaults as of latest repo state.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Confirm security libraries and infrastructure match current deployments.
2. Update secrets management details when storage or naming changes.
3. Reflect new compliance obligations or audit findings.
4. Ensure incident response procedures include current contacts and tooling.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Security architecture docs, runbooks, policy handbooks.
- IAM/authorization configuration (code or infrastructure).
- Compliance updates from security or legal teams.

<!-- agent-update:end -->
