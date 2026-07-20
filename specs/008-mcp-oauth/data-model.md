# Data Model: OAuth Authorization for the MCP Server

**Input**: [spec.md](spec.md) Key Entities, [research.md](research.md)

All entities below are persisted as JSON records in the app's existing configured S3-compatible bucket, under a reserved `.oauth/` key prefix (research.md §2). This prefix MUST be excluded from the web file explorer's directory listing and from any MCP storage tool's view of the bucket (`lib/mcp-tools`, `lib/storage`) — it is server-internal state, not user content.

## RegisteredClient

An OAuth client that has completed Dynamic Client Registration (spec.md FR-002). Maps to spec.md's **Connected Client** once it has an associated grant.

| Field | Type | Notes |
|---|---|---|
| `clientId` | string | Server-generated on registration. Primary key; record stored at `.oauth/clients/{clientId}.json`. |
| `clientName` | string | Client-supplied display name (e.g. `"ChatGPT"`, `"Claude"`) shown on the consent screen and connected-clients view (FR-003, FR-006). |
| `redirectUris` | string[] | Registered per RFC 7591; the authorize endpoint MUST reject any request whose `redirect_uri` isn't in this list. |
| `clientSecretHash` | string \| null | Hash of the client secret, if the client is confidential; `null` for public clients (PKCE-only, the expected case for ChatGPT/Claude-style connectors). |
| `registeredAt` | timestamp | When Dynamic Client Registration completed. |

**Validation rules**: `redirectUris` must be non-empty and every entry a valid absolute URL, per RFC 7591 §2 — a request missing this fails Dynamic Client Registration with an error rather than registering a client with no usable redirect target.

## AuthorizationGrant

The outcome of the owner approving or denying one client's request (spec.md's **Access Grant**, FR-003–FR-005, FR-008). One `RegisteredClient` has at most one active `AuthorizationGrant` at a time; re-approving after a revocation creates a new grant against the same `clientId` rather than a second `RegisteredClient` record (research.md's opaque-token design keeps this simple — a grant is state, not the client's identity).

| Field | Type | Notes |
|---|---|---|
| `grantId` | string | Primary key; record stored at `.oauth/grants/{grantId}.json`. |
| `clientId` | string | References `RegisteredClient.clientId`. |
| `status` | `"active"` \| `"revoked"` | FR-007, FR-008 — independent per client. |
| `scope` | `"full_access"` | Single all-or-nothing scope (spec.md FR-010) — no other value exists in this version. |
| `authorizedAt` | timestamp | Shown on the connected-clients view (FR-006). |
| `lastUsedAt` | timestamp \| null | Updated on each successful MCP tool call authenticated with a token issued under this grant (FR-006). |
| `revokedAt` | timestamp \| null | Set when the owner revokes (FR-007). |

**State transitions**: *(none)* → `active` (owner approves, FR-003) → `revoked` (owner revokes, FR-007; terminal — re-approving the same client creates a new `AuthorizationGrant`, not a transition back to `active`).

## AuthorizationCode

A short-lived, single-use code issued mid-flow, before token exchange (RFC 6749 §4.1.2, PKCE per RFC 7636). Not part of spec.md's Key Entities — it's an implementation-level intermediate that exists only between the owner's consent and the client's token exchange.

| Field | Type | Notes |
|---|---|---|
| `code` | string | Primary key; record stored at `.oauth/codes/{code}.json`. Server-generated, high-entropy. |
| `clientId` | string | References `RegisteredClient.clientId`. |
| `grantId` | string | References the `AuthorizationGrant` created on approval. |
| `codeChallenge` | string | PKCE `code_challenge` (S256) supplied at `/oauth/authorize`; verified against the client's `code_verifier` at token exchange (research.md §1). |
| `redirectUri` | string | Must match the redirect URI used at token exchange (RFC 6749 §4.1.3). |
| `expiresAt` | timestamp | Short TTL (minutes); checked and rejected at exchange time if elapsed. |
| `consumedAt` | timestamp \| null | Set on first exchange; a second exchange attempt against a `consumedAt`-set code MUST be rejected and, per RFC 6749 §10.5, revoke any tokens already issued from it (spec.md Edge Cases). |

## Token

Represents both access and refresh tokens issued under a grant (spec.md's **Access Grant** tokens, FR-005, FR-007). Access and refresh tokens are two `Token` records linked by `pairId`, so revoking one revokes both.

| Field | Type | Notes |
|---|---|---|
| `tokenId` | string | Primary key (the opaque token value itself, research.md §5); record stored at `.oauth/tokens/{tokenId}.json`. |
| `pairId` | string | Shared between an access token and its paired refresh token, so both can be revoked together. |
| `kind` | `"access"` \| `"refresh"` | |
| `grantId` | string | References the `AuthorizationGrant` this token was issued under. |
| `clientId` | string | Denormalized from the grant for fast lookup during verification without a second read. |
| `issuedAt` | timestamp | |
| `expiresAt` | timestamp | Access tokens: short TTL. Refresh tokens: longer TTL (research.md §5). |
| `revoked` | boolean | Set directly (explicit revoke, FR-007) or implicitly true whenever the parent `AuthorizationGrant.status` is `"revoked"` — token verification MUST check both. |

**Validation rules**: A token is valid for use only if `revoked === false`, `expiresAt` is in the future, and its `AuthorizationGrant.status === "active"` (FR-001, FR-007, spec.md Edge Cases on refresh-token reuse after revocation).

## OwnerCredential

The single dedicated sign-in identity (spec.md's **Owner Credential**, FR-009). Configuration, not a stored record — analogous to spec 007's Storage Connection Configuration: read from environment variables once at process startup, never written by the application.

| Field | Type | Notes |
|---|---|---|
| `username` | string | From `OAUTH_OWNER_USERNAME`. |
| `password` | string | From `OAUTH_OWNER_PASSWORD` — stored and compared as plain text, verified with a timing-safe comparison (research.md §4). |

## LoginAttemptState

Tracks brute-force protection for the owner sign-in screen (FR-013). A single record, since there is exactly one credential to protect.

| Field | Type | Notes |
|---|---|---|
| `failedAttempts` | integer | Reset to `0` on a successful sign-in. |
| `lockedUntil` | timestamp \| null | While in the future, sign-in attempts are rejected outright without checking the password (research.md §3). |
| `lastAttemptAt` | timestamp | |

Record stored at `.oauth/login-attempts.json`.

## AuditLogEntry

An append-only record of grants, denials, and revocations (FR-011). Stored as newline-delimited JSON appended to `.oauth/audit-log.jsonl`.

| Field | Type | Notes |
|---|---|---|
| `at` | timestamp | |
| `event` | `"grant_approved"` \| `"grant_denied"` \| `"grant_revoked"` | |
| `clientId` | string | |
| `clientName` | string | Denormalized so the log stays human-readable even if the client is later deleted. |

## Relationships

```text
RegisteredClient (1) ──< AuthorizationGrant (0..N, at most one "active")
AuthorizationGrant (1) ──< AuthorizationCode (0..N, each single-use)
AuthorizationGrant (1) ──< Token (0..N, paired access+refresh via pairId)
OwnerCredential — standalone; gates access to the /oauth/authorize approve/deny action and the connected-clients view
LoginAttemptState — standalone; one record for the one OwnerCredential
AuditLogEntry — standalone append log; references clientId/clientName by value, not by foreign key
```

- Revoking an `AuthorizationGrant` (FR-007) is the single source of truth for cutting off a client: it does not delete the `RegisteredClient` (FR-008 — other clients, and a future re-approval of the same client, are unaffected) and does not need to individually touch every issued `Token` record, since `Token` validation already checks the parent grant's status.
