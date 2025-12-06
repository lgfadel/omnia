<!-- agent-update:start:glossary -->
# Glossary & Domain Concepts

List project-specific terminology, acronyms, domain entities, and user personas.

## Core Terms
- **Supabase Client** — A JavaScript library for interacting with Supabase's PostgreSQL database, authentication, storage, and real-time features. It is initialized in `src/lib/supabase.ts` and used extensively in `apps/` for data fetching, user management, and edge functions.
- **AI Scaffolding** — The process of using AI agents to generate and maintain project documentation, playbooks, and configurations based on repository state. Implemented via the `ai-context` tool, with playbooks in `agents/` and updates triggered in `docs/`.

## Acronyms & Abbreviations
- **API** — Application Programming Interface; refers to RESTful endpoints exposed by Supabase and custom routes in `src/app/api/`. Used for client-server communication, with authentication handled via Supabase Auth.

## Personas / Actors
- **Developer/Maintainer** — Software engineers or AI operators who use this repository to scaffold and update documentation. Goals: Automate doc maintenance, ensure consistency across guides; key workflows: Run AI updates on PR merges, review agent outputs; pain points: Outdated docs leading to onboarding issues, addressed by automated refreshes and cross-links.

## Domain Rules & Invariants
- **Data Privacy Compliance**: All user data stored in Supabase must adhere to GDPR and CCPA regulations, enforced through Row Level Security (RLS) policies in the Supabase dashboard and database schemas in `supabase/migrations/`.
- **Authentication Flow**: Users must authenticate via Supabase Auth before accessing protected routes; invariant: JWT tokens expire after 1 hour, with refresh handled automatically in `src/hooks/useAuth.ts`.
- **Localization**: The app is primarily in Portuguese (pt-BR), matching the target audience at Loovus Comunicação; no region-specific regulatory nuances beyond standard data protection.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Harvest terminology from recent PRs, issues, and discussions.
2. Confirm definitions with product or domain experts when uncertain.
3. Link terms to relevant docs or modules for deeper context.
4. Remove or archive outdated concepts; flag unknown terms for follow-up.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Product requirement docs, RFCs, user research, or support tickets.
- Service contracts, API schemas, data dictionaries.
- Conversations with domain experts (summarize outcomes if applicable).

<!-- agent-update:end -->
