# Data Model: MCP Personal Access Token Authentication

**Input**: [spec.md](spec.md) Key Entities, [research.md](research.md)

New records are persisted in the same reserved `.oauth/` key prefix spec 008 already established (durable, S3-backed, excluded from the file explorer/MCP directory listings) — this feature adds records under that prefix, it does not introduce a new storage location.

## PersonalAccessToken

The owner-generated credential from spec.md's Key Entities, extended with the secret/non-secret split from research.md §2.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Non-secret identifier. Primary key; record stored at `.oauth/pats/{id}.json`. Used in the settings UI, the revoke route, and audit log entries — safe to display/log (FR-005). |
| `name` | string | Owner-supplied label (FR-001) to tell tokens apart in the list view. Not required to be unique — it's a display label, not a key. |
| `createdAt` | timestamp | Shown in the personal access tokens list (FR-005). |
| `lastUsedAt` | timestamp \| null | Updated on each successful MCP request authenticated with this token (FR-005, mirrors `AuthorizationGrant.lastUsedAt`). |
| `revoked` | boolean | `false` until the owner revokes it (FR-006). |
| `revokedAt` | timestamp \| null | Set when the owner revokes (FR-006). |

**Validation rules**: `name` must be non-empty (a blank label defeats the purpose of telling tokens apart) — no other constraint. No maximum count is enforced (spec.md Assumptions).

**State transitions**: *(none)* → active (`revoked: false`, on creation, FR-001) → revoked (`revoked: true`, owner-initiated, FR-006; terminal — the owner must create a new token to replace it, there is no un-revoke).

**Persistence (FR-011, clarified 2026-07-24)**: Durable, alongside every other `.oauth/` record — an application restart must not lose or alter any `PersonalAccessToken` record.

## PersonalAccessTokenValue (pointer record, not part of spec.md's Key Entities)

An implementation-level record separating the one-time secret from the `PersonalAccessToken` metadata above (research.md §2) — exists purely so the hot verification path (every `/mcp` request) is a single direct key lookup by the secret, without ever storing that secret inside the record the settings UI reads.

| Field | Type | Notes |
|---|---|---|
| *(key)* | string | The actual bearer-token secret value itself, generated the same way as OAuth's opaque tokens (`lib/oauth/tokens.ts`'s `generateOpaqueToken()`). Record stored at `.oauth/pat-values/{value}.json`. Shown to the owner exactly once, at creation (FR-002) — never read back or displayed by any page after that. |
| `id` | string | References `PersonalAccessToken.id`. |

**Validation rules**: Created once, alongside its `PersonalAccessToken`, and never updated. Revoking a token updates only the `PersonalAccessToken` record (`revoked: true`); the pointer record is left as-is — verification always re-checks the `PersonalAccessToken.revoked` flag after following the pointer, so a revoked token's pointer becomes inert rather than needing cleanup (mirrors how an OAuth `Token` stays revocable purely via its parent `AuthorizationGrant.status`, spec 008 `data-model.md`).

## AuditLogEntry (extended — `lib/oauth/types.ts`)

Existing entity from spec 008, extended by this feature:

| Field | Before | After this feature |
|---|---|---|
| `event` | `"grant_approved" \| "grant_denied" \| "grant_revoked"` | adds `"pat_created" \| "pat_revoked"` |
| `clientId` | OAuth `RegisteredClient.clientId` | for PAT events, holds `PersonalAccessToken.id` (never the secret value — research.md §2) |
| `clientName` | OAuth `RegisteredClient.clientName` | for PAT events, holds `PersonalAccessToken.name` |

No new fields — the existing flat shape already generalizes to "an identifying id + a display name" for either entity kind (FR-009).
