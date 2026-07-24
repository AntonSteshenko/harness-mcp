# Quickstart: Validate MCP Personal Access Token Authentication

Manual validation guide (this project has no automated test suite — see `research.md` §5). Run these scenarios against a running `next dev` instance after implementation.

## Prerequisites

- MinIO/S3-compatible storage stack running and configured (spec 001).
- `frontend`: `npm install && npm run dev`.
- Owner credentials configured (`OAUTH_OWNER_USERNAME`/`OAUTH_OWNER_PASSWORD`, spec 008) and an active owner session (sign in at `/oauth/login` or via the editor's login gate, spec 009).
- A way to send a raw HTTP request with a custom `Authorization` header (e.g. `curl`) to exercise `/mcp` directly, independent of any full MCP client.

## Scenario 1 — Generate a personal access token (US1, FR-001, FR-002)

1. Sign in as the owner, then go to `/settings/personal-access-tokens`.
2. Create a token named `quickstart-test`.
3. **Expect**: the response shows the full secret value once, with a clear "won't be shown again" message. Copy it.
4. Reload `/settings/personal-access-tokens`.
5. **Expect**: `quickstart-test` appears in the list with a creation time and "never" for last used — the secret value itself is nowhere on this page.

## Scenario 2 — Use the token to call an MCP tool (US1, FR-003)

1. Using the secret from Scenario 1, call the MCP server directly, e.g.:
   ```sh
   curl -X POST http://localhost:3000/mcp \
     -H "Authorization: Bearer <secret-from-scenario-1>" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```
2. **Expect**: a successful JSON-RPC response listing the MCP tools — no OAuth sign-in/consent step involved at any point (SC-001).
3. Reload `/settings/personal-access-tokens`.
4. **Expect**: `quickstart-test`'s "last used" now shows a recent timestamp.

## Scenario 3 — OAuth clients are unaffected (US1, FR-004, SC-004)

1. With an existing OAuth-connected client from spec 008 (or by completing that flow fresh), call an MCP tool as before.
2. **Expect**: behaves exactly as it did before this feature — no change in success, response shape, or timing.

## Scenario 4 — Revoke a personal access token (US2, FR-006, SC-003)

1. On `/settings/personal-access-tokens`, revoke `quickstart-test`.
2. **Expect**: redirected back to the list; `quickstart-test` now shows as revoked.
3. Repeat the `curl` call from Scenario 2 with the same secret.
4. **Expect**: `401`, same error shape as an invalid/expired OAuth token (spec 008 FR-001) — no data returned.

## Scenario 5 — Multiple tokens are independent (US2, FR-007)

1. Create two more tokens, `token-a` and `token-b`.
2. Revoke only `token-a`.
3. **Expect**: `token-a` is rejected on next use; `token-b` still authenticates successfully; any still-active OAuth client (Scenario 3) is unaffected.

## Scenario 6 — Owner sign-in is required to manage tokens (Edge Case, FR-008)

1. In a fresh/incognito session (no owner cookie), navigate directly to `/settings/personal-access-tokens`.
2. **Expect**: redirected to `/oauth/login?continue=%2Fsettings%2Fpersonal-access-tokens`, exactly like `/settings/connected-apps` today.

## Scenario 7 — Restart durability (FR-011, clarified 2026-07-24)

1. With at least one active personal access token, restart the `next dev` process (or redeploy).
2. Repeat the `curl` call from Scenario 2 with that token's secret.
3. **Expect**: still authenticates successfully — the token and its metadata survived the restart.
4. Reload `/settings/personal-access-tokens`.
5. **Expect**: the token still appears in the list with its original name and creation time.
