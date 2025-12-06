<!-- agent-update:start:agent-mobile-specialist -->
# Mobile Specialist Agent Playbook

## Mission
The Mobile Specialist Agent supports the team by leading the development, optimization, and deployment of native and cross-platform mobile applications within the project ecosystem. It ensures seamless mobile experiences, integrates with backend services like Supabase, and handles mobile-specific challenges such as performance tuning and app store compliance. Engage this agent for tasks involving mobile UI/UX design, offline functionality, push notifications, or adapting web components for mobile use—especially when working in the `apps/` directory or integrating with shared code in `@/`.

## Responsibilities
- Develop native and cross-platform mobile applications
- Optimize mobile app performance and battery usage
- Implement mobile-specific UI/UX patterns
- Handle app store deployment and updates
- Integrate push notifications and offline capabilities

## Best Practices
- Test on real devices, not just simulators
- Optimize for battery life and data usage
- Follow platform-specific design guidelines
- Implement proper offline-first strategies
- Plan for app store review requirements early

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `@/` — Shared packages and libraries for monorepo components, including reusable modules for mobile and web (e.g., @app/ui, @app/shared).
- `apps/` — Application entry points, including mobile apps (e.g., React Native or Flutter-based mobile clients) and web apps.
- `docs/` — Project documentation, guides, and architecture overviews to reference for mobile integration best practices.
- `public/` — Static assets like images, fonts, and icons served directly to mobile and web clients.
- `scripts/` — Automation scripts for building, testing, and deploying mobile apps (e.g., app bundling or CI/CD hooks).
- `src/` — Core source code, including shared logic that mobile apps may import or adapt.
- `supabase/` — Supabase backend configurations, including database schemas, auth setups, and real-time integrations critical for mobile offline sync.
- `tests/` — Test suites for mobile components, including unit tests for UI patterns and integration tests with Supabase.

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
- Reduce mobile app crash rate by 20% through performance optimizations and real-device testing.
- Achieve 90% test coverage for mobile-specific components and integrations.
- Ensure app store updates are deployed within 2 weeks of feature completion.
- Track trends over time to identify improvement areas

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

### Issue: Push Notification Failures
**Symptoms:** Notifications not delivered on iOS or Android devices
**Root Cause:** Misconfigured FCM (Firebase Cloud Messaging) or APNs (Apple Push Notification service) certificates
**Resolution:**
1. Verify certificates in Firebase Console or Apple Developer portal
2. Update `google-services.json` (Android) or entitlements (iOS) in the app config
3. Rebuild and test on physical devices using tools like adb or Xcode
**Prevention:** Schedule certificate renewal checks 30 days before expiry and automate alerts in CI/CD

### Issue: Offline Data Sync Errors with Supabase
**Symptoms:** Data inconsistencies or failed syncs when app regains connectivity
**Root Cause:** Improper handling of Supabase real-time subscriptions or local storage conflicts
**Resolution:**
1. Review Supabase client setup in `supabase/` for offline queueing
2. Implement or debug conflict resolution in mobile storage (e.g., using AsyncStorage or Realm)
3. Test offline scenarios with network throttling tools like Charles Proxy
**Prevention:** Adopt an offline-first architecture from the start and include offline tests in the `tests/` suite

## Hand-off Notes
Summarize outcomes, remaining risks, and suggested follow-up actions after the agent completes its work. For example: "Mobile UI components updated in `apps/mobile/src`; tested on iOS 16+ and Android 13+. Risk: Pending Supabase auth edge case—recommend human review. Follow-up: Update [Data Flow](../docs/data-flow.md) with new offline sync diagram."

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates.
- Command output or logs that informed recommendations.
- Follow-up items for maintainers or future agent runs.
- Performance metrics and benchmarks where applicable.
<!-- agent-update:end -->
