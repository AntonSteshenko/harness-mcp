# Phase 0 Research: REST API Token Authentication

All items below were resolved by reading the existing codebase (`frontend/lib/oauth/**`, `frontend/app/api/**`, `frontend/app/mcp/route.ts`) — no external research was needed. The feature reuses an authentication pattern this repo already ships in production for the MCP endpoint.

## 1. Where does bearer-token verification already exist, and can it be reused as-is?

- **Decision**: Reuse `verifyAccessToken` (`lib/oauth/tokens.ts`) and `verifyPersonalAccessToken` (`lib/oauth/personalAccessTokens.ts`) unchanged, called in the same fallback order already used by `app/mcp/route.ts`: `(await verifyAccessToken(bearerToken)) ?? (await verifyPersonalAccessToken(bearerToken))`.
- **Rationale**: Spec 013 (`013-mcp-token-auth`) already built and shipped exactly this fallback chain for the MCP endpoint. Both functions independently check expiry/revocation and return `undefined` on any failure, so the `??` chain is a correct "try OAuth token, then try PAT" check with no new logic needed.
- **Alternatives considered**: Writing a new, file-API-specific token verifier — rejected; it would duplicate validation rules (expiry, revocation, KV lookup) that already exist and are already exercised in production by the MCP endpoint.

## 2. How should the guard read the `Authorization` header without changing its call signature?

- **Decision**: Use `headers()` from `next/headers` inside `requireOwnerSession()`, the same way the function already uses `cookies()` from `next/headers` to read the session cookie.
- **Rationale**: `headers()` is available anywhere `cookies()` is (Route Handlers, Server Components) because both read from the same underlying request context Next.js threads through the App Router. Since `requireOwnerSession()` already calls `cookies()` with no arguments, adding a `headers()` call needs no new parameter — the function's public signature (`(): Promise<NextResponse | null>`) stays identical, so all five existing call sites (`/api/file`, `/api/tree`, `/api/directory`, `/api/upload`, `/api/download-zip`) require zero edits.
- **Alternatives considered**: Changing `requireOwnerSession(request: NextRequest)` to accept the request explicitly and reading `request.headers` — rejected; it would require editing all five call sites for no behavioral benefit, purely to thread a value `headers()` already exposes ambiently.

## 3. What is the fallback order between the session cookie and the bearer token?

- **Decision**: Check the session cookie first (existing `readSessionPayload()`); only inspect the `Authorization` header if no valid session cookie is found. If a valid bearer token is found, treat the request as authenticated — skip cookie-renewal logic (FR-007-style renewal only applies to actual browser sessions, not tokens, matching how `app/mcp/route.ts` has no notion of "session renewal" either).
- **Rationale**: This ordering matches the spec's edge case ("session cookie takes effect" when both are present) and avoids the cost of a KV lookup on every browser request that already carries a valid cookie — the common case stays exactly as fast as it is today.
- **Alternatives considered**: Checking the bearer token first — rejected; it would add a KV round-trip to the hot path (every browser-authenticated file operation) for no benefit, since a present cookie is the overwhelmingly common case for the existing web editor.

## 4. What does an unauthorized bearer-token request return?

- **Decision**: The exact same response `requireOwnerSession()` already returns today: `NextResponse.json({ code: "unauthorized", message: "Sign in required" }, { status: 401 })`. No new error code or message is introduced.
- **Rationale**: FR-004/FR-005 only require a consistent "unauthorized" outcome; introducing a token-specific error shape would be a new, unrequested API surface and would force every caller (including the existing browser editor, indirectly) to handle an additional response shape.
- **Alternatives considered**: A distinct error code (e.g., `invalid_token`) to help API callers distinguish "no cookie" from "bad token" — rejected as unnecessary; both cases mean the same thing to the caller (retry with valid credentials), and the spec does not ask for this distinction.

## 5. Does anything else observably change for existing cookie-based requests?

- **Decision**: No. When a valid session cookie is present, behavior (including the halfway-to-expiry renewal) is untouched — the new bearer-token check only runs when `readSessionPayload()` returns `null`.
- **Rationale**: Directly satisfies FR-003 and User Story 3 (regression prevention) and keeps the change additive rather than restructuring existing logic.
- **Alternatives considered**: Refactoring `requireOwnerSession()` into two composable guards (session-only, token-only) invoked separately per route — rejected as disproportionate; a single function with an added fallback branch is the smaller change and preserves the "zero call-site edits" property from item 2.
