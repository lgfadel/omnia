# MCP compression ETag regression fix

Branch: `feat/tasks-api-mcp`; baseline: `fa94147`.

## Change

`createApiClient` sends `Accept-Encoding: identity` on its upstream HTTP calls. This requests the unencoded API representation so a compression layer does not weaken the strong task ETag needed for compare-and-set updates. The exact strong-version checks, timestamp precision, `If-Match` forwarding, response-size bounds, and timeouts remain unchanged. No SQL, API, or UI source changed; no deployment or live production access was performed by this task.

The existing actual-HTTP fixture now emits `W/` task ETags unless the request uses identity encoding. Its get/update test verifies that `get_task` succeeds with the exact literal strong ETag for `2026-10-04T12:00:00.123456+00:00`, then passes that returned version to `update_task` and verifies the upstream `If-Match` is unchanged. The existing create test also verifies successful creation and the same exact strong version.

## Red/green evidence

Before any production change, ran `npm run test:mcp` with the modified HTTP regression fixture. Exit code: **1**. Output: **16 tests; 14 pass; 2 fail**. The failed cases were:

- `legacy client can list, create, and query status and assignee routes`
- `get preserves the strong version through a compression layer for a subsequent update`

Both failed with `AssertionError [ERR_ASSERTION]`: `isError` was `true`, expected `undefined`. This reproduces the rejected weak-validator response rather than a harness error. Full output: `.context/tasks-api-mcp/etag-red.log`.

After adding only the upstream request header, ran `npm run test:mcp` again. Exit code: **0**. Output: **16 tests; 16 pass; 0 fail**. Full output: `.context/tasks-api-mcp/etag-green.log`.

Additional checks:

| Command | Result |
| --- | --- |
| `npm run type-check:mcp` | Exit 0; `tsc --noEmit -p tsconfig.json` |
| `npm run build:mcp` | Exit 0; `tsc -p tsconfig.build.json` |
| `git diff --check` | Exit 0; no whitespace errors |

The generated, ignored `apps/mcp-server/dist/src/api.js` contains the identity header after the build. Build/type-check output is retained in `.context/tasks-api-mcp/etag-build.log` and `.context/tasks-api-mcp/etag-type-check.log`.

## Exact changed files

- `apps/mcp-server/src/api.ts`
- `apps/mcp-server/test/integration.test.ts`
- `apps/mcp-server/README.md`
- `.context/tasks-api-mcp/etag-fix-report.md`

Evidence log files are local artifacts, excluded from the scoped commit. Existing unrelated user scratch files were left untouched.
