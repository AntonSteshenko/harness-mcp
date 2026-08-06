# Contract: File API authentication guard — extended, not replaced

Applies identically to every route currently gated by `requireOwnerSession()`: `GET/PUT/POST/DELETE /api/file`, `GET /api/tree`, `GET /api/directory`, `POST /api/upload`, `GET /api/download-zip`. None of these routes change their request/response shape for the operation itself — only the authentication check that runs before the handler body executes is extended.

## `requireOwnerSession()` (`lib/oauth/session.ts`) — extended, not replaced

| Aspect | Behavior |
|---|---|
| Request | Unchanged shape. Callers may now additionally send `Authorization: Bearer <token>` where they previously could only send the `oauth_owner_session` cookie. |
| Authentication check, step 1 | Session cookie checked first (unchanged from spec 009/021) — if valid, request proceeds, renewal logic runs exactly as before. Bearer header is not even read in this case. |
| Authentication check, step 2 | Only when no valid session cookie: read the `Authorization` header. If it is `Bearer <token>`, try an OAuth access token (`verifyAccessToken`, spec 008) first, then a personal access token (`verifyPersonalAccessToken`, spec 013) — same fallback order already used by `/mcp` (spec 013's contract, item 1). Either succeeding lets the request proceed. |
| No cookie, no header / malformed header | `401`, unchanged response shape: `{ "code": "unauthorized", "message": "Sign in required" }`. |
| No cookie, invalid/expired/revoked bearer token | Same `401`, same shape — the response never reveals which credential was attempted or why it failed, matching spec 013's existing guarantee for `/mcp`. |
| Response (success) | Unchanged — the route handler's own logic (file read/write/list/upload/zip) runs identically regardless of which credential authenticated the request; no capability differs by auth method (FR-008). |

**Guarantee**: A browser using the existing owner session cookie sees no behavior change (FR-003, SC-003) — this is a strictly additive check, mirroring the guarantee spec 013 already made for `/mcp` when it added Personal Access Tokens alongside OAuth tokens.

## Unaffected routes

`/mcp` (already supports both token types — unchanged), `/oauth/*`, `/.well-known/*`, `/settings/*`, `/init`, and any page route (`/files`, `/tools`, `/editor`) are untouched — this feature only extends the API-route guard function, not page-level session checks (`hasActiveOwnerSession`).
