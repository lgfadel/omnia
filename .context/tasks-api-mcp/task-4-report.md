# Task 4 — independent MCP HTTP workspace

Status: DONE on `feat/tasks-api-mcp` at base `458e2ba`. No production database, deployment, real key, or external account was contacted.

## Implementation

- Added npm workspace `apps/mcp-server`, using the current official MCP TypeScript SDK v2 (`@modelcontextprotocol/server` 2.3.0, `@modelcontextprotocol/client` 2.3.0 for tests, `@modelcontextprotocol/node` 2.1.1). The official `createMcpHandler` factory creates a fresh server per HTTP request. The Node adapter serves local tests; a Web Handler export serves the Vercel function.
- Public fixed endpoint: `POST https://<MCP-host>/mcp`. `GET /mcp` returns 405 in stateless 2025-era mode. Vercel project Root Directory is `apps/mcp-server`; `vercel.json` rewrites `/mcp` to its `api/mcp.ts` function. Node 22+ required. The internal `/api/mcp` function route has the same authentication and protections.
- Exactly six tools: `list_tasks`, `get_task`, `create_task`, `update_task`, `list_task_statuses`, `search_task_assignees`. Schemas are strict Zod v4 objects. Create and update exclude recurrence; create requires `title` and caller `idempotencyKey`; update requires UUID `id`, exact canonical strong-ETag `version`, caller `idempotencyKey`, and nonempty patch. Task write DTOs allow only the official resource fields. Read tools are marked read-only; update has `destructiveHint: true` because fields can be cleared or replaced. Writes are not marked idempotent because their idempotency depends on the supplied key and API replay logic.
- The gateway accepts only `omnia_mcp_` bearer keys. Every inbound MCP request, including initialize and tool listing, makes a fresh `POST /api/v1/mcp/exchange` call using the separate service-secret bearer and `{mcpKey}` JSON body. The API returns flat capability metadata plus `token` in `{data,requestId}`. The capability is used only for resource calls during that request; there is no global user session or capability cache. A revoked key fails on the next request. Resource calls never receive the raw MCP key.
- Resource routes are fixed: `GET/POST /api/v1/tasks`, `GET/PATCH /api/v1/tasks/{uuid}`, `GET /api/v1/task-statuses`, `GET /api/v1/task-assignees`. The upstream API handles identity, scopes, private visibility, recurrence and idempotency. This workspace has no Supabase or database dependency and offers no generic HTTP/proxy tool.
- Task detail/create/update returns `version` from the API ETag only when it exactly matches the task's original `updatedAt` string, including microseconds. Update passes the caller's version as `If-Match` and caller key as `Idempotency-Key` without regeneration. API 400/409/412/429 errors become safe MCP tool `isError` content with code, status, message and `requestId`; 429 includes `retryAfterSeconds:60` when the API provides `Retry-After:60`. Exchange 429 remains HTTP 429 with `Retry-After:60`.

## Configuration and controls

| Variable | Contract |
| --- | --- |
| `OMNIA_API_BASE_URL` | One fixed HTTPS origin, no path, query, fragment or embedded credentials. |
| `OMNIA_MCP_EXCHANGE_SECRET` | Shared with the Omnia API service-secret setting; high entropy; required. |
| `OMNIA_MCP_ALLOWED_HOSTS` | Required comma-separated exact hostname list without ports; inbound Host's port is stripped before checking. |
| `OMNIA_MCP_ALLOWED_ORIGINS` | Optional comma-separated exact Origin allowlist; any Origin is rejected when empty. |
| `NODE_ENV=development` and `OMNIA_MCP_ALLOW_INSECURE_LOCALHOST=true` | Together allow an HTTP API origin only on localhost/127.0.0.1 for local development. |
| `HOST`, `PORT` | Local standalone listener, defaults `127.0.0.1:3001`. |

Inbound unknown paths return 404 before key exchange. Host and Origin are checked before exchange. Authorization requires exactly one syntactically valid MCP bearer. Outbound fetch uses `redirect:'error'`, a five-second abort covering response-body reads, a 512 KiB API JSON body bound, and safe error handling that never returns HTML. Inbound MCP request bodies are limited to 64 KiB by both the Node adapter and SDK. Rendered tool output is limited to 256 KiB; a legitimate large list receives actionable `OUTPUT_TOO_LARGE` to narrow filters or lower `limit`. Logs contain no keys, capabilities, headers, or task bodies.

The companion [README](../../apps/mcp-server/README.md) gives local commands, exact environment values, Vercel root-directory setup and Grok connection guidance. A shared Grok Team Bot connector using one key grants its owner's Omnia access to every bot user; personal identity requires a personal bot or per-user connector/key setup. The target Grok account's custom MCP Authorization-header behavior remains a deployment gate. This server does not claim OAuth, issue real keys, or deploy.

## Verification

- TDD RED: initial official-client test failed because `src/server.js` did not exist. A later regression test failed when a noncanonical quoted version reached PATCH; another failed when API ETag did not match task `updatedAt`. Both passed after implementation.
- `npm run test:mcp`: **16/16 passing**. Tests run real official MCP clients over an actual local HTTP MCP server against an actual controlled HTTP API server. Covered modern 2026 negotiation, 2025-era stateless client, six-tool listing, list/create/get/update/status/assignee routes, exact version and idempotency forwarding, concurrent caller isolation, revocation, invalid audience/auth/origin/Host, strict malformed parameters, 412 tool error, 429 exchange backoff, redirect rejection, response size limit, body-read timeout, unknown path and GET 405.
- `npm run type-check:mcp`: exit 0. `npm run build:mcp`: exit 0. `git diff --check`: exit 0. `npm audit --omit=dev --workspace apps/mcp-server --audit-level=high`: 0 vulnerabilities. Root `dev`, `build`, `test`, and `type-check` scripts retain their web behavior; explicit MCP scripts and CI steps were added.
- Built `dist/` and `node_modules/` are ignored and uncommitted. Changes are confined to the assigned workspace, root package manifests, CI and this report.

References: [MCP SDK v2 serving guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md), [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Grok Team Bots](https://docs.x.ai/grok-bot/team-bots).
