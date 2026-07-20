# Quickstart: OAuth Authorization for the MCP Server

**Input**: [spec.md](spec.md), [contracts/oauth-endpoints.md](contracts/oauth-endpoints.md), [data-model.md](data-model.md)

This guide validates the feature end-to-end against spec.md's acceptance scenarios. It assumes the Authorization Server endpoints, the `withMcpAuth`-wrapped `/mcp` route, and the owner-facing sign-in/consent/connected-apps pages have already been implemented per tasks.md.

## Prerequisites

1. The storage backend is running and configured per spec 007 (`docker compose up -d` from the repo root; `frontend/.env.local` set up).
2. Dependencies installed: `npm install` from `frontend/`.
3. New owner-credential env vars set in `frontend/.env.local` (data-model.md `OwnerCredential`): `OAUTH_OWNER_USERNAME` and `OAUTH_OWNER_PASSWORD_HASH` (generate the hash value using the helper script/command documented in tasks.md).
4. `npm run dev` from `frontend/`, so the app (including the new `/oauth/*` routes and `/mcp`) is reachable at `http://localhost:3000`.

## 1. Connect a client end-to-end (validates User Story 1, FR-002, FR-003, FR-005, SC-001)

Using any MCP client that supports OAuth discovery (or a manual walkthrough with `curl`/a browser following contracts/oauth-endpoints.md):

1. Point the client at `http://localhost:3000/mcp`. It fetches `/.well-known/oauth-protected-resource`, then the Authorization Server's `/.well-known/oauth-authorization-server`.
2. The client registers itself via `POST /oauth/register` and receives a `client_id`.
3. The client opens `GET /oauth/authorize` with PKCE parameters. Since there's no owner session yet, you're redirected to `/oauth/login`.
4. Sign in with `OAUTH_OWNER_USERNAME` / the password matching `OAUTH_OWNER_PASSWORD_HASH`. You land on the consent screen showing the client's name.
5. Approve. You're redirected back to the client with an authorization code; the client exchanges it at `POST /oauth/token` for an access + refresh token.
6. The client calls an MCP tool (e.g. list files).

Expected: step 6 succeeds and returns real data, all without ever copying an API key by hand — start to finish should comfortably fit under 3 minutes (SC-001).

## 2. Deny a connection request (validates User Story 1 Scenario 3, FR-004, spec.md Edge Cases)

Repeat steps 1–4 above with a second/test client, but click **Deny** on the consent screen instead of approving.

Expected: the client receives an `access_denied` redirect and no token; a subsequent MCP tool call from that client fails as unauthorized (there is nothing to revoke later, since no `AuthorizationGrant` or `Token` was ever created).

## 3. Unauthorized requests are rejected (validates User Story 2, FR-001, SC-002)

- Call `POST http://localhost:3000/mcp` with no `Authorization` header.
  Expected: `401`, no data returned, response points at `/.well-known/oauth-protected-resource`.
- Using a token obtained in §1, revoke it (§4 below), then call `/mcp` again with that same token.
  Expected: `401`, no data returned.

## 4. Review and revoke a connected client (validates User Story 3, FR-006, FR-007, FR-008, SC-003, SC-005)

1. With at least one client connected from §1, sign in as the owner and open `GET /settings/connected-apps`.
   Expected: the connected client is listed with its name, when it was authorized, and its last-used time.
2. Connect a *second* client the same way (§1).
3. Revoke the first client via `POST /settings/connected-apps/{grantId}/revoke`.
   Expected: the first client's very next MCP tool call fails as unauthorized (SC-003); the second client's MCP tool calls keep succeeding, unaffected (FR-008, SC-005).

## 5. Refresh without re-approval (validates FR-005, spec.md Edge Cases)

Using a still-active client from §1, call `POST /oauth/token` with `grant_type=refresh_token` and its refresh token.

Expected: a new access token is issued without the owner seeing the consent screen again.

## 6. Authorization code reuse is rejected (validates spec.md Edge Cases)

Replay the exact same `POST /oauth/token` request from step 5 of §1 (the same authorization `code`) a second time.

Expected: the second exchange is rejected (`invalid_grant`), and the tokens issued from the first (legitimate) exchange are no longer usable — confirm with an `/mcp` call using that access token, which should now also fail.

## 7. Sign-in brute-force protection (validates FR-013, spec.md Edge Cases)

Attempt `POST /oauth/login` with the wrong password repeatedly (past the threshold documented in tasks.md).

Expected: further attempts are rejected immediately (locked out) even with the *correct* password, until the lockout window passes.

## 8. Persistence across a restart (validates FR-012, spec.md Edge Cases)

With a client still connected from §1, restart the dev server (`Ctrl+C`, then `npm run dev` again).

Expected: the previously connected client's existing access/refresh tokens keep working, and it still appears in `GET /settings/connected-apps` — no re-authorization required.

## 9. Existing MCP tool behavior is unaffected (validates non-goals)

With a valid token, run through `specs/002-s3-mcp-server/quickstart.md`'s tool walkthrough using that token as the `Authorization: Bearer` header.

Expected: every tool behaves exactly as before this feature — this feature only gates *access* to the tools, it does not change what they do.
