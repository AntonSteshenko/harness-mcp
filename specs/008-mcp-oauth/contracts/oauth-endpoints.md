# Contract: OAuth Authorization Server & Protected Resource Endpoints

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

This is the HTTP surface this feature adds to `frontend/`, split between the Authorization Server role (this app issues tokens) and the Protected Resource role (the existing MCP server now requires them) — research.md §1.

## Common error shape

Authorization Server endpoints return OAuth-standard error responses: HTTP 400/401 with a JSON body `{ error: string, error_description?: string }` using the standard `error` codes from RFC 6749 (`invalid_request`, `invalid_client`, `invalid_grant`, `unauthorized_client`, `invalid_scope`) — no project-specific error codes, since these responses are read by third-party OAuth client libraries (ChatGPT's, Claude's, etc.) that expect exactly this shape.

## Discovery

### `GET /.well-known/oauth-authorization-server`

Authorization Server Metadata (RFC 8414). Advertises `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `code_challenge_methods_supported: ["S256"]`, `grant_types_supported: ["authorization_code", "refresh_token"]`. This is what lets a client discover the flow without manual configuration (FR-002).

### `GET /.well-known/oauth-protected-resource`

Protected Resource Metadata (RFC 9728), served via `mcp-handler`'s `protectedResourceHandler` (research.md §1) pointing `authorization_servers` at this app's own issuer URL.

## Authorization Server endpoints

### `POST /oauth/register`

Dynamic Client Registration (RFC 7591). Public — no owner sign-in required (a client must be able to register before anyone has approved it).

- **Input**: `{ client_name: string, redirect_uris: string[], token_endpoint_auth_method?: string }`
- **Output**: `201` with `{ client_id: string, client_name: string, redirect_uris: string[] }` (`client_secret` omitted for public/PKCE-only clients — the expected case, research.md §1).
- **Errors**: `invalid_request` if `redirect_uris` is missing/empty or contains a non-URL entry (data-model.md `RegisteredClient` validation rules).
- **Satisfies**: FR-002.

### `GET /oauth/authorize`

Starts the flow. If the owner has no active sign-in session, redirects to `/oauth/login` first (data-model.md `OwnerCredential`), then renders the consent screen naming the requesting `RegisteredClient.clientName` (FR-003).

- **Input** (query string, RFC 6749 §4.1.1 + PKCE): `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256`, `scope` (ignored beyond validation — this version has exactly one scope, data-model.md `AuthorizationGrant.scope`).
- **Errors**: `invalid_request` if `client_id` doesn't match a `RegisteredClient` or `redirect_uri` isn't in that client's registered list (data-model.md).
- **Satisfies**: FR-003.

### `POST /oauth/authorize/decision`

The owner's approve/deny action from the consent screen. Requires an active owner sign-in session (data-model.md `OwnerCredential`); a request without one is rejected the same as any other unauthenticated management action.

- **Input**: `{ requestId: string, decision: "approve" | "deny" }` (`requestId` correlates back to the in-flight `GET /oauth/authorize` request).
- **Behavior — approve**: creates an `AuthorizationGrant` (status `active`) and an `AuthorizationCode`, then redirects to the client's `redirect_uri` with `?code=...&state=...` (FR-003). Records an `AuditLogEntry` (`grant_approved`, FR-011).
- **Behavior — deny**: issues no code or token; redirects to `redirect_uri` with `?error=access_denied&state=...` (FR-004, spec.md Edge Cases: "no token should exist to revoke later"). Records an `AuditLogEntry` (`grant_denied`, FR-011).
- **Satisfies**: FR-003, FR-004, FR-011.

### `POST /oauth/token`

Token exchange, both grant types (RFC 6749 §4.1.3 and §6). Public — authenticated via the client's own credentials/PKCE proof in the body, not an owner session.

- **Input (`grant_type=authorization_code`)**: `{ grant_type: "authorization_code", code: string, redirect_uri: string, client_id: string, code_verifier: string }`.
  - Validates `code_verifier` against the `AuthorizationCode.codeChallenge` (S256), that `redirect_uri` matches, that the code hasn't expired or already been consumed (data-model.md `AuthorizationCode.consumedAt` — reuse invalidates the tokens already issued from it, spec.md Edge Cases).
  - **Output**: `200` with `{ access_token, refresh_token, token_type: "Bearer", expires_in }` (a new access/refresh `Token` pair, data-model.md).
- **Input (`grant_type=refresh_token`)**: `{ grant_type: "refresh_token", refresh_token: string, client_id: string }`.
  - Validates the refresh `Token` is unrevoked, unexpired, and its `AuthorizationGrant.status === "active"` (data-model.md validation rules; spec.md Edge Cases: revoked-then-reused refresh token is rejected).
  - **Output**: `200` with a newly issued access token (and, per standard refresh rotation, a new refresh token) — the owner is not re-prompted (FR-005).
- **Errors**: `invalid_grant` for any of the rejection cases above.
- **Satisfies**: FR-005, spec.md Edge Cases (code reuse, expired/revoked refresh token).

### `POST /oauth/revoke`

Token revocation (RFC 7009), callable by a client to revoke its own token.

- **Input**: `{ token: string, client_id: string }`.
- **Behavior**: marks the matching `Token` (and its paired token via `pairId`) revoked. Per RFC 7009, an already-invalid token is treated as successfully revoked (no error).
- **Satisfies**: Supports FR-005's "revoked outright."

## Owner-facing management endpoints

Require an active owner sign-in session (data-model.md `OwnerCredential`); any request without one gets the same authorization error as an unauthenticated MCP tool call.

### `POST /oauth/login`

- **Input**: `{ username: string, password: string }`.
- **Behavior**: rejects immediately without checking the password if `LoginAttemptState.lockedUntil` is in the future (FR-013). Otherwise verifies against `OwnerCredential.passwordHash`; on failure increments `LoginAttemptState.failedAttempts` and sets `lockedUntil` past a threshold (research.md §3); on success resets `failedAttempts` to `0` and establishes the owner sign-in session.
- **Satisfies**: FR-009, FR-013, spec.md Edge Cases (repeated failed sign-ins).

### `GET /settings/connected-apps`

- **Output**: every `RegisteredClient` with an `AuthorizationGrant`, each with `clientName`, `status`, `authorizedAt`, `lastUsedAt` (FR-006).
- **Satisfies**: FR-006.

### `POST /settings/connected-apps/{grantId}/revoke`

- **Behavior**: sets the target `AuthorizationGrant.status = "revoked"`, `revokedAt = now`; every `Token` issued under it is rejected on its next use via the grant-status check (data-model.md), without needing to enumerate and individually mark each token (FR-007 — takes effect no later than the client's next request). Records an `AuditLogEntry` (`grant_revoked`, FR-011). Does not affect any other `RegisteredClient`'s grant (FR-008).
- **Satisfies**: FR-007, FR-008, FR-011.

## MCP tool endpoint (Protected Resource)

### `GET/POST /mcp` (existing route, modified)

Wrapped with `mcp-handler`'s `withMcpAuth` (research.md §1). Every request's `Authorization: Bearer <token>` is verified against the `Token`/`AuthorizationGrant` records (data-model.md validation rules) before any MCP tool runs.

- **Errors**: `401` with `WWW-Authenticate` pointing at `/.well-known/oauth-protected-resource` if the token is missing, unknown, expired, or revoked (FR-001).
- **Satisfies**: FR-001, User Story 2's acceptance scenarios.
