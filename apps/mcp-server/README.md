# Omnia Tasks MCP server

This is an independent, stateless Streamable HTTP server at `POST /mcp`. It uses the [official MCP TypeScript SDK v2](https://github.com/modelcontextprotocol/typescript-sdk) and supports the SDK's 2026-07-28 protocol negotiation and stateless 2025-era clients. `GET /mcp` returns 405 for the 2025 session path; this server does not maintain SSE sessions.

The server exposes exactly ten tools: `list_tasks`, `get_task`, `create_task`, `update_task`, `list_task_statuses`, `search_task_assignees`, `list_task_comments`, `create_task_comment`, `update_task_comment`, and `delete_task_comment`. `get_task` returns `version`, the strong HTTP ETag. `update_task` requires that exact version and a caller-selected `idempotencyKey`. `create_task` also requires a caller-selected key. Retain the same key when retrying the same write. Task creation is standalone: recurring schedules and derived fields are outside these tool schemas. Errors include an API `requestId` and safe code; a 412 means fetch the task again before retrying. Exchange and tool rate limits carry a 60-second backoff when the API supplies `Retry-After: 60`.

The comment tools act as the key owner and need the `tasks:comment` scope (listing needs `tasks:read`). `list_task_comments` returns newest first with a cursor and is how you find a `commentId`. `create_task_comment` and `update_task_comment` take a caller-selected `idempotencyKey`; comment edits have no version precondition (last write wins). Only the comment author may edit, administrators included; the author or an administrator may delete. `delete_task_comment` returns the deleted comment, and repeating it returns `NOT_FOUND`. Creating or deleting a comment updates the task's `commentCount` but not its version, so a comment never forces a `get_task` before the next `update_task`. Mentions written as `@[userId]` are stored but do not send notifications. Keys issued before this scope existed cannot comment; issue a new key with `tasks:comment`.

Each inbound HTTP request must carry `Authorization: Bearer omnia_mcp_…`. The server exchanges that key at the fixed Omnia API `/api/v1/mcp/exchange` route using `OMNIA_MCP_EXCHANGE_SECRET`, then uses the returned short-lived `omnia_cap_…` token for resource requests. The capability stays in request memory. Neither key appears in a URL or log. The API owns identity, scopes, private visibility, revocation, idempotency, and task rules. This workspace has no database or Supabase dependency.

## Environment

| Variable | Meaning |
| --- | --- |
| `OMNIA_API_BASE_URL` | Fixed Omnia API origin, HTTPS only, with no path, credentials, query, or fragment. |
| `OMNIA_MCP_EXCHANGE_SECRET` | High-entropy shared service secret configured identically in the Omnia API deployment. |
| `OMNIA_MCP_ALLOWED_HOSTS` | Comma-separated exact public DNS hostnames, **without ports**; used for Host/DNS-rebinding checks. |
| `OMNIA_MCP_ALLOWED_ORIGINS` | Comma-separated exact browser origins allowed to send `Origin`; omit or leave empty to reject all Origin-bearing requests. Non-browser clients may omit Origin. |
| `PORT`, `HOST` | Standalone server only; defaults `3001`, `127.0.0.1`. |
| `NODE_ENV=development` plus `OMNIA_MCP_ALLOW_INSECURE_LOCALHOST=true` | Enables an HTTP Omnia API origin only on `localhost` or `127.0.0.1` for local development. Never use this in deployment. |

`OMNIA_MCP_ALLOWED_HOSTS` lists hostnames; the incoming Host header's port is stripped before comparison. Use the deployment hostname (for example `tasks-mcp.example.com`), not the Omnia API hostname unless they are the same host. There is no wildcard Host or Origin matching.

## Local build and deployment

From the repository root:

```sh
npm install
npm run type-check:mcp
npm run test:mcp
npm run build:mcp
```

For a local server, set the variables above, then run `npm --workspace apps/mcp-server run dev`. The API origin may point only at a controlled local API while the development-only HTTP switch is enabled. `GET /mcp` is not a health check; it needs a bearer key and returns 405 by protocol design.

For an independent Vercel project, set **Root Directory** to `apps/mcp-server`, use Node 22 or newer, configure the production environment variables, and deploy that project. `vercel.json` rewrites public `/mcp` to the `api/mcp.ts` Web Handler. Set `OMNIA_MCP_ALLOWED_HOSTS` to the project's stable custom domain or assigned Vercel hostname. This repository does not deploy it or issue a real key.

The public endpoint for a Grok Team Bot custom MCP connection is `https://<your-mcp-host>/mcp`. Configure the bearer key in the connector's Authorization header, never in the URL or chat. The [Grok Bot documentation](https://docs.x.ai/grok-bot/team-bots) describes remote HTTPS custom MCP connections. A shared Team Bot connector configured with one person's key acts with that key owner's permissions for every user of the bot. For personal identity, use a personal bot or per-user connector/key configuration supported by the target account; verify its authorization-header behavior before production use. This server does not implement OAuth or map a bot user to an Omnia user.

## Network and size limits

Only the fixed API origin and its fixed task, comment, status, and assignee resource routes can be called; redirects are rejected. Outbound requests time out after 5 seconds, including response-body reads. MCP request bodies are limited to 64 KiB, API JSON response bodies to 512 KiB, and rendered tool output to 256 KiB. A legitimate wide list can hit either response limit; lower `limit` or narrow filters and retry. HTTP exchange occurs for initialize, tool discovery, and every tool call, so a revoked key is rejected on the next request. Public unknown paths return 404 before authentication or exchange.

Upstream requests send `Accept-Encoding: identity` to preserve the API's strong task ETags through compression layers. The returned version retains the exact `updatedAt` precision and is forwarded unchanged in `X-Omnia-If-Match` for updates, without a standard `If-Match` header. The API applies the same strict compare-and-swap to either header outside Vercel; if both are supplied they must be equal. On Vercel (`VERCEL=1`), any standard `If-Match` on any official API operation is rejected before dispatch or persistence with JSON `400 UNSUPPORTED_PRECONDITION_HEADER`, even alongside an equal alias, so clients must send only the alias. This prevents an ambiguous write followed by a platform conditional error. GET/POST/PATCH responses retain their strong ETags.
