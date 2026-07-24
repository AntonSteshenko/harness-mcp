# Research: MCP Personal Access Token Authentication

## 1. Where personal access tokens live in the codebase

**Decision**: Add this feature entirely inside the existing `frontend/lib/oauth/` module (a new `frontend/lib/oauth/personalAccessTokens.ts`), reusing `lib/oauth/store.ts`'s existing S3-backed KV helpers (`getRecord`/`putRecord`/`listRecords`) under the same reserved `.oauth/` prefix, and reusing `lib/oauth/session.ts`'s `hasActiveOwnerSession()` gate for management routes.

**Rationale**:
- This feature is, functionally, a second way to authenticate to the same `/mcp` endpoint spec 008 already protects — it belongs next to `tokens.ts`, not in a new top-level module.
- `lib/oauth/store.ts` already provides exactly the durable, restart-safe persistence this feature's clarified requirement (FR-011) needs — no new storage mechanism to build or justify.
- The owner-only gate (`hasActiveOwnerSession`/`requireOwnerSession`) is already exactly the right check for "signed-in owner" (FR-008); the settings page for personal access tokens can mirror `app/settings/connected-apps/page.tsx` almost line for line.

**Alternatives considered**: A separate top-level `lib/pat/` module — rejected; it would duplicate `store.ts`'s KV helpers or import across an artificial boundary for no benefit, since this is conceptually still "how requests to `/mcp` get authenticated," spec 008's domain.

## 2. Secret vs. non-secret identifier (avoiding ever re-exposing the token value)

**Decision**: Every `PersonalAccessToken` record has two distinct identifiers:
- A non-secret `id` (short random hex) — used as the record's storage key, in the settings UI, in the revoke URL, and in audit log lines.
- A one-time secret `value` (long random hex, same generation approach as OAuth's opaque tokens) — shown to the owner exactly once at creation, and used only as the lookup key for a separate pointer record (`pat-values/{value}` → `{ id }`) consulted during MCP authentication.

**Rationale**:
- FR-002 requires the raw value is never retrievable again after creation. If the *only* identifier were the secret value itself, it would inevitably end up in a revoke-button URL and in the audit log (both non-sensitive-by-design places in this codebase) — a durable, second exposure of the same secret.
- This exactly mirrors a distinction this codebase already makes for OAuth: `AuthorizationGrant.grantId` (used in the connected-apps UI, revoke route, and audit log) is a *different* value from the actual bearer token string (`Token.tokenId`, spec 008's `tokens.ts`) that a client presents on each request. Personal access tokens get the same treatment for the same reason.
- The pointer record (`pat-values/{value}`) keeps the hot lookup path (verifying a bearer token on every `/mcp` request) a single direct key read, exactly like `tokens.ts`'s `getRecord<Token>(\`tokens/${token}\`)` today — no scan, no hashing/comparison loop.

**Alternatives considered**:
- A single identifier that *is* the secret, never displayed after creation, and the settings/revoke UI keyed by array index or creation timestamp instead — rejected as fragile (index/timestamp collisions, awkward revoke UX) compared to a dedicated non-secret `id`.
- Hashing the secret at rest and comparing hashes on verification — out of scope per spec.md's Assumptions ("does not mandate a specific storage or hashing approach"); this project already stores OAuth access/refresh tokens as plain opaque strings in the same KV store (`tokens.ts`), so matching that existing bar keeps this feature consistent rather than introducing a stricter (and inconsistent) posture for only one credential type.

## 3. Wiring into the existing MCP auth check

**Decision**: In `frontend/app/mcp/route.ts`, change the `withMcpAuth` callback from calling only `verifyAccessToken(bearerToken)` to:
```
(await verifyAccessToken(bearerToken)) ?? (await verifyPersonalAccessToken(bearerToken))
```
`verifyPersonalAccessToken` returns the same `AuthInfo` shape (`{ token, clientId, scopes: ["full_access"] }`) the SDK expects, with `expiresAt` simply omitted (the SDK's `AuthInfo.expiresAt` is optional) to reflect FR-010's non-expiring tokens.

**Rationale**:
- Satisfies FR-003/FR-004 (both methods coexist, full access, no change to existing OAuth behavior) with a minimal, additive change to the one place bearer tokens are already checked — no duplicated auth-gate logic anywhere else in the app.
- `clientId` in the returned `AuthInfo` is set to `` `pat:${id}` `` (the non-secret id from research.md §2) purely for readability if this value is ever logged/inspected — nothing downstream (`lib/mcp-tools/`) currently branches on `clientId` (confirmed by inspection), so this choice carries no behavioral risk.

**Alternatives considered**: A second, separate `withMcpAuth`-style wrapper or a different endpoint for token-authenticated clients — rejected; `/mcp` is already the single endpoint for every MCP client, and splitting it would contradict FR-004's "additional, independent way to authenticate" framing (same endpoint, same tools, same access level).

## 4. Token creation UX (never putting the secret in a URL or log)

**Decision**: Creating a token is a plain HTML `<form method="POST">` on the personal-access-tokens settings page (mirroring the existing revoke `<form>` pattern in `connected-apps/page.tsx`) submitting to a new route handler that, on success, renders the secret value directly in its HTML response body — never via a redirect (which would otherwise have to carry the secret in a query string, landing it in browser history and potentially server access logs).

**Rationale**: Directly serves FR-002 or it doesn't count for anything — a technically-once-shown value that then gets echoed into a URL isn't actually "shown once, never retrievable again" in practice. Keeping it strictly in the POST response body means the secret only ever exists in: the create request/response pair, and the owner's clipboard/notes afterward.

**Alternatives considered**: Redirect-with-flash-cookie (set a short-lived, httpOnly cookie carrying the secret, then redirect and read/clear it) — considered, but adds a second secret-bearing storage location (the cookie jar) for no real benefit over directly rendering the response, given this is a simple owner-only, single-request flow with no client-side navigation requirement.

## 5. Testing / validation approach

**Decision**: No automated test suite exists in this project (confirmed for spec 012; still true — no `test` script in `frontend/package.json`, no Jest/Vitest/Playwright config). Validation is manual, via `quickstart.md`, consistent with specs 001-012.

**Rationale**: Matches established project convention; introducing a test framework is out of scope for this feature.
