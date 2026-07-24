# Contract: Personal access token management routes and `/mcp` auth

## `/mcp` (GET, POST) — extended, not replaced

| Aspect | Behavior |
|---|---|
| Request | Unchanged from spec 008 — a bearer token in the `Authorization` header. |
| Authentication check | Now tries an OAuth access token first (spec 008's `verifyAccessToken`); if that doesn't match, tries a personal access token (`verifyPersonalAccessToken`, this feature). Either one succeeding grants the same `full_access` scope (FR-003, FR-004). |
| No match / revoked / unknown | `401`, same shape as today (spec 008 FR-001) — the response never reveals which auth method was attempted or why it failed (SC-002). |
| Response (success) | Unchanged — tool results are identical regardless of which auth method was used. |

**Guarantee**: An AI assistant connected via the spec 008 OAuth flow sees no behavior change (SC-004) — this is a strictly additive check.

## `GET /settings/personal-access-tokens`

| Session state | Behavior |
|---|---|
| No active owner session | `302` redirect to `/oauth/login?continue=%2Fsettings%2Fpersonal-access-tokens` (mirrors `/settings/connected-apps`, spec 009). |
| Active owner session | Renders the list of personal access tokens (name, created time, last-used time, status) and a "create new token" form. **Never renders a token's secret value** — only `PersonalAccessToken.id`/`name`/timestamps/`revoked`, never `PersonalAccessTokenValue`'s key (FR-005). |

## `POST /settings/personal-access-tokens` (create)

| Aspect | Behavior |
|---|---|
| Auth | Requires an active owner session (`requireOwnerSession`-equivalent check) — `401` JSON error otherwise, same shape as spec 009's protected API routes. |
| Request body | A `name` field (owner-supplied label, form-encoded from the page's `<form>`). Empty/whitespace-only `name` is rejected with a validation error, re-rendering the form (data-model.md validation rule). |
| Response (success) | Renders an HTML page showing the newly generated secret value **directly in the response body** — never via redirect/query string (research.md §4) — with a clear "copy this now, it will not be shown again" message and a link back to the list. |
| Side effects | Creates one `PersonalAccessToken` record (`revoked: false`) and one `PersonalAccessTokenValue` pointer record; appends a `pat_created` `AuditLogEntry` (FR-009). |

## `POST /settings/personal-access-tokens/{id}/revoke`

| Aspect | Behavior |
|---|---|
| Auth | Same owner-session requirement as the create route. |
| Request | `id` is the non-secret `PersonalAccessToken.id` from the list view's revoke button — never the secret value (mirrors `/settings/connected-apps/{grantId}/revoke`). |
| Response (success) | `303` redirect back to `/settings/personal-access-tokens` (identical pattern to the existing connected-apps revoke route). |
| Effect | Sets `revoked: true`/`revokedAt` on the `PersonalAccessToken` record (FR-006) — takes effect on that token's very next `/mcp` request (SC-003). Appends a `pat_revoked` `AuditLogEntry`. Already-revoked or unknown `id` is a no-op that still redirects (idempotent, matching the connected-apps revoke route's behavior for an already-revoked grant). |

## Unaffected routes

`/oauth/*`, `/.well-known/*`, `/settings/connected-apps` and its revoke route, `/editor`, and every `/api/*` file-editor route are untouched by this feature.
