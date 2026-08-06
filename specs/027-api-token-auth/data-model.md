# Phase 1 Data Model: REST API Token Authentication

This feature introduces no new persisted data and no new storage records — it extends how three already-existing entities are *used* on a new set of routes. All three already have their full data model defined by prior specs; only their relationship to the file API is new here.

## Owner Session Cookie (existing — spec 009, 021)

Unchanged. Continues to be the first-checked credential on every guarded request. See `lib/oauth/session.ts` for its existing shape (`generation`, `issuedAt`, `expiresAt`, HMAC-signed).

## OAuth Access Token (existing — spec 008)

Unchanged record shape and verification (`verifyAccessToken` in `lib/oauth/tokens.ts`). **New**: now also accepted, via the `Authorization: Bearer <token>` header, as a fallback credential on `/api/file`, `/api/tree`, `/api/directory`, `/api/upload`, and `/api/download-zip` — previously only accepted on `/mcp`.

## Personal Access Token (existing — spec 013)

Unchanged record shape and verification (`verifyPersonalAccessToken` in `lib/oauth/personalAccessTokens.ts`), including its `lastUsedAt` update on successful verification. **New**: same extension as above — now also accepted as a fallback credential on the file API routes, not only `/mcp`.

## Request Authentication Outcome (conceptual — not persisted)

Represents which credential (if any) satisfied `requireOwnerSession()` for a given request. Not a stored entity; described here only to make the guard's decision logic unambiguous.

| Cookie valid? | Bearer token present & valid? | Outcome |
|---|---|---|
| Yes | (not checked) | Authenticated via session cookie; renewal logic runs as before |
| No | Yes (OAuth access token or PAT) | Authenticated via bearer token; no cookie is issued or renewed |
| No | No / absent / invalid / expired / revoked | 401 `{ code: "unauthorized", message: "Sign in required" }` |

### Validation rules

- The cookie is always checked first; the `Authorization` header is only inspected when the cookie check fails (research.md §3).
- A bearer token is accepted if `verifyAccessToken(token)` returns a result, else if `verifyPersonalAccessToken(token)` returns a result; otherwise it is treated as invalid.
- No new validation rule is added to either token type's own lifecycle (expiry, revocation) — both are enforced exactly as they already are today.

### Relationships

None new. This feature adds no foreign keys, no new record types, and no schema change to `lib/oauth/store.ts`.
