# Task 2 — official task API and shared wire contracts

Status: DONE on `feat/tasks-api-mcp`. The API uses the existing Task 1 dispatcher and does not read or write task tables directly. No production database or configured Supabase project was contacted.

## Routes and wire response

All handlers run with `runtime = 'nodejs'`, require explicit `Authorization: Bearer …`, and emit `Cache-Control: no-store` plus `X-Request-Id`. A valid caller `X-Request-Id` UUID is retained; otherwise the server generates one. Success is `{data,requestId}` and failure is `{error:{code,message},requestId}`. Unexpected persistence/config/output errors return a generic 500 with no database detail. Task detail/create/update return a strong `ETag` derived from the exact `updatedAt` string. PATCH requires that ETag as `If-Match`; raw database microseconds survive the browser-safe `btoa`/`atob` base64url round trip. Task POST/PATCH require a caller-supplied printable `Idempotency-Key` of 1–200 characters. The server never synthesizes one.

| HTTP route | RPC operation | Request contract | Success |
| --- | --- | --- | --- |
| `GET /api/v1/tasks` | `tasks.list` | optional `limit` (1–100, default 50), opaque `cursor`, `query`, `statusId`, `assignedToId`, `mine`, `priority`, `isPrivate`, `oportunidadeId`, JSON-array `tags`, `dueDateFrom`, `dueDateTo` | 200 `{items:TaskDTO[],nextCursor:string\|null}` |
| `POST /api/v1/tasks` | `tasks.create` | strict `TaskCreateDTO`; required `title` | 201 `TaskDTO` |
| `GET /api/v1/tasks/[id]` | `tasks.get` | UUID path ID | 200 `TaskDTO` |
| `PATCH /api/v1/tasks/[id]` | `tasks.update` | UUID path ID, strong `If-Match`, strict nonempty `TaskPatchDTO` | 200 `TaskDTO` |
| `GET /api/v1/task-statuses` | `statuses.list` | no query/body | 200 `TaskStatusDTO[]` |
| `GET /api/v1/task-assignees` | `assignees.list` | optional `query`, `limit` (1–100, default 50) | 200 `TaskUserRefDTO[]` |
| `GET /api/v1/integration-keys` | `credentials.list` | verified browser bearer only | 200 `IntegrationCredentialDTO[]` |
| `POST /api/v1/integration-keys` | `credentials.create` | `{name,audience:'api'\|'mcp',scopes,expiresAt?}` | 201 credential metadata plus one-time `token` |
| `DELETE /api/v1/integration-keys/[id]` | `credentials.revoke` | verified browser bearer and UUID path ID | 200 revoked credential metadata |
| `POST /api/v1/mcp/exchange` | `mcp.exchange` | service-secret bearer and JSON `{mcpKey}` | 201 capability metadata plus one-time `token` |

`TaskCreateDTO` and `TaskPatchDTO` accept only `title,description,priority,dueDate,ticketOcta,statusId,assignedToId,tags,isPrivate,oportunidadeId,recurrence`; patch requires at least one field. `title` is required on create. Nullable clears are supported for description, dueDate, ticketOcta, assignedToId and oportunidadeId, plus `recurrence:null` for browser updates. Recurrence input is `{frequency:'DAILY'|'WEEKLY'|'MONTHLY',interval?,startDate,endType?,endDate?,occurrenceLimit?,isActive?}` with real `YYYY-MM-DD` validation. Integrations cannot submit `recurrence` even as null. Priority supports `URGENTE,ALTA,NORMAL,BAIXA`.

`TaskDTO` contains `id,ticketId,ticketOcta,title,description,priority,dueDate,statusId,assignedToId,createdById,tags,isPrivate,oportunidadeId,commentCount,attachmentCount,recurrenceId,recurrenceOccurrence,createdAt,updatedAt,assignedTo,createdBy,recurrence`. User refs contain `id,name,email,roles,avatarUrl,color`; legacy null roles normalize to `[]`. Legacy task `createdById` and recurrence `templateTicketId` may be null. Statuses contain `id,name,color,order,isDefault,isFinal`; legacy null `isDefault` normalizes to false. Credentials contain `id,name,audience,scopes,createdAt,expiresAt,revokedAt,lastUsedAt` and never a digest. Capability metadata contains `id,audience:'api',scopes,expiresAt`. All output is validated against these schemas before returning.

## Authentication and persistence

Browser JWTs are checked with `supabase.auth.getUser(token)` using the anon client; the resulting verified auth UUID is the only user identity sent to SQL. Opaque secrets are 32 random bytes encoded as base64url with identifiable prefixes `omnia_api_`, `omnia_mcp_`, and `omnia_cap_`. Only lowercase SHA-256 digests cross the RPC boundary. API keys and capabilities can call resource routes; raw MCP keys cannot. Only verified browser users can manage their own keys. Exchange requires the separate `OMNIA_MCP_EXCHANGE_SECRET` as a bearer value (use an unpadded base64url or hex secret), compared in fixed time, plus an MCP key in the JSON body. The service secret is never a user selector and an API key cannot exchange.

The sole persistence call is service-role `rpc('tasks_api_dispatch', {p_operation,p_payload,p_auth_user_id,p_token_digest,p_idempotency_key,p_request_id})`. Task permissions, credential expiry/revocation, audience and scopes, private visibility, idempotency replay, reference validation, recurring generation and the persistent 120/minute budget stay in Task 1 SQL. Request DTOs reject caller actor IDs, generated IDs, counters and unknown fields. `mine=true` is passed as a boolean and resolved against the verified actor inside SQL. Pagination cursors encode the SQL `{createdAt,id}` tuple without date reconstruction.

`OMNIA_INTEGRATIONS_READ_ENABLED` enables integration GET resources only when exactly `true`; `OMNIA_INTEGRATIONS_WRITE_ENABLED` does the same for task POST/PATCH. Both default closed. MCP exchange is available when either switch is true, after service-secret authentication; the resulting capability still faces the operation-specific switch. Browser routes continue independently. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are resolved lazily per request, so missing deployment configuration yields sanitized 500 instead of breaking module import.

Typed SQL codes map to stable HTTP errors: `INVALID_AUTH`/`INVALID_CREDENTIAL` 401; `ACTOR_DISABLED`/`INVALID_AUDIENCE`/`FORBIDDEN`/`INSUFFICIENT_SCOPE` 403; `VALIDATION_ERROR`/`INVALID_OPERATION` 400; `NOT_FOUND` 404; `CONFLICT`/`IDEMPOTENCY_CONFLICT` 409; `PRECONDITION_FAILED` 412; `PRECONDITION_REQUIRED` 428; `RATE_LIMITED` 429 with `Retry-After: 60`. HTTP-only codes are `PAYLOAD_TOO_LARGE` 413, `UNSUPPORTED_MEDIA_TYPE` 415, `METHOD_NOT_ALLOWED` 405 and `INTEGRATIONS_DISABLED` 503. The JSON body limit is 64 KiB, checked against both declared and actual bytes. Duplicate/unknown query keys and malformed authorization or cursor values are rejected.

## Verification and scope

- RED: scoped Vitest identified the legacy null output mismatch (createdById, roles, templateTicketId and isDefault); tests failed on those exact fields. `.context/tasks-api-mcp/task-2-default-red.log` records the Docker daemon being unavailable before the SQL fix could be executed.
- GREEN: `npm run test:run -- src/server/__tests__/tasksApi.test.ts src/server/__tests__/tasksApiRuntime.test.ts` from `apps/web-next` passed 45/45 tests across two files. It covers DTO/date/null/cursor validation, browser verification, token audiences and hashing, independent switches, exchange, recurrence denial, ETag precision, idempotency/preconditions, errors/body bounds and route auth.
- `npm run type-check` from `apps/web-next` exited 0; `git diff --check` exited 0.
- Isolated `bash supabase/tests/tasks-api/run.sh` exited 0 after Docker became available. A transaction-scoped regression inserts a legacy null-default status with earlier order and verifies an omitted-status create still selects the true default. The transaction rolls back. The original SQL suite and two-connection concurrency checks also passed. Output: `.context/tasks-api-mcp/task-2-sql-green.log`.
- The only SQL change is the default-status ordering `coalesce(is_default,false) DESC`; the only SQL test change is the isolated regression. No UI or MCP workspace files were changed. Root owns whole-branch build/integration review and deployment.
