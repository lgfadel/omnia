# Local Test Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a deterministic, production-mode local Omnia environment whose synthetic data supports every current UI module and bug reproduction.

**Architecture:** A versioned SQL fixture defines the public schema and realistic seed data consumed by the current repositories. The existing isolated Supabase provisioner applies those files and a smoke script validates schema coverage, authentication, Dashboard data, permissions, Storage, and a local Mailpit message while the Next app runs with `next start`.

**Tech Stack:** Supabase CLI/Docker/Postgres, Next.js 16, Bash, curl, Node.js, Vitest, Mailpit.

## Global Constraints

- Use only `omnia-local-test` Docker resources and ports `55420–55429`; never connect to shared Supabase projects.
- All fixture data must be synthetic and deterministic; use only `.local` e-mails and fictitious personal/company identifiers.
- Browser testing includes normal enabled extensions; only body-level extension attributes may be suppressed.
- Apply RLS to every public fixture table, grant `authenticated` read access needed by current repositories, and grant `service_role` server-side access where required.
- A new UI repository dependency must add its table, relation, seed scenario, and smoke assertion to this baseline in the same change.

---

### Task 1: Core access-control and shared-domain fixture

**Files:**
- Create: `supabase/local-fixtures/app-core.sql`
- Modify: `supabase/local-fixtures/malotes-core.sql`
- Modify: `scripts/setup-local-test-env.sh`
- Test: `scripts/verify-local-test-env.sh`

**Interfaces:**
- Consumes: Docker container `supabase_db_omnia-local-test`, `auth.users`, and `public.update_updated_at_column()`.
- Produces: `public.omnia_users`, `omnia_menu_items`, `omnia_role_permissions`, `omnia_user_permissions`, `omnia_condominiums`, `omnia_administradoras`, `omnia_tags`, and `omnia_crm_origens` with selectable relations and RLS.

- [ ] **Step 1: Write the failing schema smoke assertion**

Create `scripts/verify-local-test-env.sh` with the initial required-table list and fail if any table is absent:

```bash
required_tables=(
  omnia_users omnia_menu_items omnia_role_permissions omnia_user_permissions
  omnia_condominiums omnia_administradoras omnia_tags omnia_crm_origens
)
for table in "${required_tables[@]}"; do
  present="$(docker exec "$container_name" psql -At -U postgres -d postgres -c "SELECT to_regclass('public.$table') IS NOT NULL")"
  [[ "$present" == t ]] || { echo "Tabela ausente: $table" >&2; exit 1; }
done
```

- [ ] **Step 2: Run the smoke script and verify it fails**

Run: `bash scripts/verify-local-test-env.sh`

Expected: FAIL naming `omnia_user_permissions` as absent.

- [ ] **Step 3: Create the minimal shared schema and policies**

Create `app-core.sql` with UUID primary keys, `created_at`/`updated_at`, real foreign keys, and these essential relation shapes:

```sql
CREATE TABLE IF NOT EXISTS public.omnia_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.omnia_users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.omnia_menu_items(id) ON DELETE CASCADE,
  can_access BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, menu_item_id)
);
```

Enable RLS and create select policies for `authenticated`; grant `SELECT` to `authenticated` and DML to `service_role`. Seed the complete navigation tree, then insert explicit ADMIN permissions for every active menu item.

- [ ] **Step 4: Apply the core fixture from the provisioner**

In `provision()`, replace the old direct `malotes-core.sql` call with:

```bash
run_sql_file "$repo_root/supabase/local-fixtures/app-core.sql"
run_sql_file "$repo_root/supabase/local-fixtures/malotes-core.sql"
```

Keep `malotes-core.sql` limited to `malote-attachments` and the four malote tables; remove duplicate creation of core users, menus, roles, and condominiums.

- [ ] **Step 5: Re-run the core smoke assertion**

Run: `npm run local:test:up && bash scripts/verify-local-test-env.sh`

Expected: all Task 1 tables exist and the ADMIN can read menu permissions through the REST API.

- [ ] **Step 6: Commit the core baseline**

```bash
git add supabase/local-fixtures/app-core.sql supabase/local-fixtures/malotes-core.sql scripts/setup-local-test-env.sh scripts/verify-local-test-env.sh
git commit -m "feat(test): adicionar fixture local de acesso"
```

### Task 2: Operational schema and deterministic Dashboard seed

**Files:**
- Create: `supabase/local-fixtures/app-operational.sql`
- Create: `supabase/local-fixtures/seed.sql`
- Modify: `scripts/verify-local-test-env.sh`
- Test: `scripts/verify-local-test-env.sh`

**Interfaces:**
- Consumes: core IDs for `Admin Local`, `Secretaria Local`, three condominiums, menus, and status records.
- Produces: all Dashboard query relations: `omnia_statuses`, `omnia_atas`, `omnia_attachments`, `omnia_comments`, `omnia_ticket_statuses`, `omnia_tickets`, `omnia_admissao_statuses`, `omnia_admissoes`, `omnia_rescisao_statuses`, `omnia_rescisoes`, and `omnia_balancetes`.

- [ ] **Step 1: Add failing data assertions to the smoke script**

Append assertions that require representative states rather than only table existence:

```bash
assert_positive_count 'public.omnia_atas' "SELECT count(*) FROM public.omnia_atas"
assert_positive_count 'public.omnia_tickets' "SELECT count(*) FROM public.omnia_tickets"
assert_positive_count 'public.omnia_admissoes' "SELECT count(*) FROM public.omnia_admissoes"
assert_positive_count 'public.omnia_rescisoes' "SELECT count(*) FROM public.omnia_rescisoes"
assert_positive_count 'public.omnia_balancetes' "SELECT count(*) FROM public.omnia_balancetes"
```

- [ ] **Step 2: Run the smoke script and verify it fails**

Run: `bash scripts/verify-local-test-env.sh`

Expected: FAIL naming the first missing operational table.

- [ ] **Step 3: Create operational tables from repository contracts**

Create tables with the exact relation names used in select expressions. Preserve the named foreign keys necessary for PostgREST joins, including `omnia_atas_secretary_id_fkey`, `omnia_atas_responsible_id_fkey`, `omnia_admissoes_assigned_to_fkey`, `omnia_admissoes_created_by_fkey`, `omnia_demissoes_assigned_to_fkey`, and `omnia_demissoes_created_by_fkey`.

Use these required dashboard columns:

```sql
-- Each status table: id, name, color, order_position, is_default, is_final where ticket status needs it.
-- omnia_atas: code, title, description, status_id, secretary_id, responsible_id, due_date, created_at, updated_at.
-- omnia_tickets: title, description, status_id, priority, due_date, assigned_to, created_by, is_private, created_at, updated_at.
-- omnia_admissoes/omnia_rescisoes: employee_name, status_id, priority, due_date, assigned_to, created_by, is_private, created_at, updated_at.
-- omnia_balancetes: condominium_id, competence, received_at, sent_at, status, observations, created_at, updated_at.
```

Enable RLS and select policies for every created public table. Grant DML to `service_role` and select to `authenticated`.

- [ ] **Step 4: Seed reproducible operational scenarios**

In `seed.sql`, use fixed UUID constants and insert:

```sql
-- One on-track, one overdue and one completed item in each operational module.
INSERT INTO public.omnia_ticket_statuses (id, name, color, order_position, is_default, is_final) VALUES
  ('00000000-0000-4000-8000-000000000101', 'Em andamento', '#2563EB', 1, true, false),
  ('00000000-0000-4000-8000-000000000102', 'Concluída', '#16A34A', 2, false, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

Use analogous states for atas, admissões and rescisões. Seed three condominiums with balancetes received, pending and overdue. Use `ON CONFLICT` for every deterministic ID so re-running does not duplicate data.

- [ ] **Step 5: Apply schema and seed through provisioning**

Extend `provision()` in this order:

```bash
run_sql_file "$repo_root/supabase/local-fixtures/app-core.sql"
run_sql_file "$repo_root/supabase/local-fixtures/app-operational.sql"
run_sql_file "$repo_root/supabase/local-fixtures/malotes-core.sql"
run_sql_file "$repo_root/supabase/local-fixtures/seed.sql"
```

- [ ] **Step 6: Verify Dashboard data**

Run: `npm run local:test:up && bash scripts/verify-local-test-env.sh`

Expected: all five operational counts are positive; at least one `due_date < CURRENT_DATE` and one completed status exist.

- [ ] **Step 7: Commit operational data**

```bash
git add supabase/local-fixtures/app-operational.sql supabase/local-fixtures/seed.sql scripts/setup-local-test-env.sh scripts/verify-local-test-env.sh
git commit -m "feat(test): semear dados operacionais locais"
```

### Task 3: Remaining current UI modules and schema-coverage contract

**Files:**
- Modify: `supabase/local-fixtures/app-operational.sql`
- Modify: `supabase/local-fixtures/seed.sql`
- Modify: `scripts/verify-local-test-env.sh`
- Test: `scripts/verify-local-test-env.sh`

**Interfaces:**
- Consumes: shared users, tags, condominiums and operational tables from Tasks 1–2.
- Produces: usable empty-or-seeded relations for current CRM, notifications, attachments, protocols, CSV imports, transcription, recurring task, and comment routes.

- [ ] **Step 1: Expand required-table coverage with a failing assertion**

Add this complete current repository contract to `required_tables`:

```bash
omnia_crm_statuses omnia_crm_leads omnia_crm_comments omnia_crm_attachments
omnia_notifications omnia_protocolos omnia_balancete_attachments
omnia_balancete_csv_import_batches omnia_balancete_protocol_import_batches
omnia_balancete_protocol_import_items omnia_ata_transcriptions
omnia_ata_transcription_jobs omnia_ata_transcription_segments
omnia_ticket_attachments omnia_ticket_comments omnia_admissao_attachments
omnia_admissao_comments omnia_ticket_recurrences
```

- [ ] **Step 2: Run it and capture the first absent table**

Run: `bash scripts/verify-local-test-env.sh`

Expected: FAIL naming a relation from the newly added list.

- [ ] **Step 3: Add current UI tables with all required foreign keys**

Add idempotent DDL for the relations above. Keep columns scoped to fields selected/inserted by their repository, provide `created_at`/`updated_at`, and use explicit foreign keys to the parent item and user. For each new table, add RLS and select policy for authenticated users.

- [ ] **Step 4: Seed one realistic relation per secondary module**

Use fixed IDs to seed one CRM lead with status/origin/comment, one notification for the ADMIN, one protocol linked to a balancete, one attachment for each item type, and one completed ata transcription. Do not seed binary files; store only metadata with fixture paths.

- [ ] **Step 5: Confirm full schema contract**

Run: `npm run local:test:up && bash scripts/verify-local-test-env.sh`

Expected: no missing-table output and all count assertions pass.

- [ ] **Step 6: Commit full UI coverage**

```bash
git add supabase/local-fixtures/app-operational.sql supabase/local-fixtures/seed.sql scripts/verify-local-test-env.sh
git commit -m "feat(test): cobrir modulos da interface local"
```

### Task 4: Production-runtime smoke flow and developer contract

**Files:**
- Modify: `scripts/verify-local-test-env.sh`
- Modify: `scripts/setup-local-test-env.sh`
- Modify: `package.json`
- Modify: `.agents/skills/omnia-local-test/SKILL.md`
- Modify: `docs/malotes-digitais.md`
- Test: `apps/web-next/src/lib/__tests__/routeAccess.test.ts`

**Interfaces:**
- Consumes: `npm run local:test:up`, `.env.local`, the deterministic ADMIN `admin@omnia.local`, and the app running at `http://127.0.0.1:3000` with `next start`.
- Produces: `npm run local:test:verify`, an exit-zero production smoke test and documented extension-aware manual verification.

- [ ] **Step 1: Add a failing runtime assertion**

Make the smoke script require the production server before doing API assertions:

```bash
ui_status="$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/auth)"
[[ "$ui_status" == 200 ]] || { echo "UI de produção local indisponível (HTTP $ui_status)" >&2; exit 1; }
```

- [ ] **Step 2: Run it without the server and verify it fails**

Run: `npm run local:test:down && bash scripts/verify-local-test-env.sh`

Expected: FAIL with `UI de produção local indisponível`.

- [ ] **Step 3: Implement authenticated API and Mailpit smoke checks**

Use the Auth token endpoint to obtain the local ADMIN bearer token, assert `GET /api/malotes/settings` returns `malotes@local.test`, prepare/upload/confirm/send a `%PDF-` fixture through signed upload, and assert the latest Mailpit subject includes `Smoke local`.

- [ ] **Step 4: Add package scripts**

Add:

```json
"local:test:verify": "bash scripts/verify-local-test-env.sh",
"local:test:reset": "npm run local:test:down && npm run local:test:up"
```

- [ ] **Step 5: Document the required sequence and extension behavior**

State in the skill and documentation:

```text
npm run local:test:up
npm run local:test:app
npm run local:test:verify
```

Require future database-backed features to expand fixture/seed/verify in the same PR. State that normal browser extensions are expected; only the body hydration boundary suppresses externally inserted body attributes.

- [ ] **Step 6: Run final verification**

Run: `npm run local:test:up && npm run local:test:app` in one terminal, then `npm run local:test:verify`, `npm run test`, `npm run build`, and `git diff --check` in another.

Expected: smoke exits 0, Mailpit contains the sent PDF mail, all unit tests pass, build passes, and diff check is empty.

- [ ] **Step 7: Commit the development standard**

```bash
git add scripts/verify-local-test-env.sh scripts/setup-local-test-env.sh package.json .agents/skills/omnia-local-test/SKILL.md docs/malotes-digitais.md
git commit -m "test: padronizar smoke local de producao"
```

## Self-review

- Spec coverage: Tasks 1–3 create and seed every table currently read through `from('omnia_*')`; Task 4 covers production execution, Mailpit, documentation and the required standard.
- Placeholder scan: no `TODO`, `TBD` or deferred implementation markers remain.
- Interface consistency: every task uses the same isolated container name, provisioner command, deterministic ADMIN credentials and `scripts/verify-local-test-env.sh` contract.
