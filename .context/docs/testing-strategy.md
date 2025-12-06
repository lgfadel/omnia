<!-- agent-update:start:testing-strategy -->
# Testing Strategy

Document how quality is maintained across the codebase.

## Test Types
- **Unit**: Vitest is used for unit tests, focusing on isolated component and function testing. Files follow naming conventions like `*.test.ts` or `*.spec.ts`, typically placed in a `__tests__` folder alongside the source or in `tests/`.
- **Integration**: Integration tests cover interactions between modules, such as API calls with Supabase and database operations. These use Vitest with mocking for external services where needed, and scenarios include authentication flows, data persistence, and service layer integrations. Tooling includes `@supabase/supabase-js` for client-side simulations.
- **End-to-end**: Playwright is employed for E2E testing, simulating user journeys across the full stack. Tests run in `tests/` directory, targeting browser environments. Configuration is in `playwright.config.ts` with visual regression support via `playwright.visual.config.ts`.

## Running Tests
- Execute all tests with `npm run test`.
- Use watch mode locally: `npm run test -- --watch`.
- Add coverage runs before releases: `npm run test -- --coverage`.

## Quality Gates
- Minimum coverage expectations: Target 80% line coverage across unit and integration tests.
- Linting requirements before merging: ESLint must pass (configured in `eslint.config.js`), and no TypeScript errors. GitHub Actions workflows in `.github/workflows/` run quality checks on PRs.

## Troubleshooting
- **Flaky suites**: Integration tests involving Supabase real-time subscriptions can flake due to network variability; mitigate by retrying failed tests in CI. Long-running E2E tests may timeout—adjust `timeout` in `playwright.config.ts` as needed.
- **Environment quirks**: Ensure local Supabase is running (`supabase start`) before integration runs; mismatches in env vars can cause auth failures—check `.env.example` for required variables.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Review test scripts and CI workflows to confirm command accuracy.
2. Update Quality Gates with current thresholds (coverage %, lint rules, required checks).
3. Document new test categories or suites introduced since the last update.
4. Record known flaky areas and link to open issues for visibility.
5. Confirm troubleshooting steps remain valid with current tooling.

<!-- agent-readonly:sources -->
## Acceptable Sources
- `package.json` scripts and testing configuration files.
- CI job definitions (GitHub Actions, CircleCI, etc.).
- Issue tracker items labelled “testing” or “flaky” with maintainer confirmation.

<!-- agent-update:end -->
