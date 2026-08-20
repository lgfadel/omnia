---
name: omnia-local-test
description: Prepare an isolated local Supabase environment with dummy data for testing Omnia features, especially Malotes Digitais. Use when local UI/database testing is requested; do not use for shared or production data.
---

# Omnia local test environment

Use `npm run local:test:up` from the repository root. It creates or reuses an isolated Supabase stack, applies the minimal schema required for Malotes Digitais, seeds two condominiums and an ADMIN user, configures the Next.js app, and sends local SMTP messages to Mailpit.

Credentials are intentionally local-only: `admin@omnia.local` / `senha-local-omnia`.

The script stores Docker/Supabase runtime files in `.context/local-test-env` and writes `apps/web-next/.env.local`; neither belongs in commits. Start the app with `npm run dev`, then use `http://localhost:3000/auth` to sign in and open `/malotes`.

Use `npm run local:test:status` to inspect services and `npm run local:test:down` to stop only this isolated stack.

This fixture is deliberately scoped to the core tables needed by Malotes. The repository has no base migration for the historical production schema, so do not claim that it reproduces all Omnia modules. A full-system local environment requires an approved sanitized schema dump or a new baseline migration.
