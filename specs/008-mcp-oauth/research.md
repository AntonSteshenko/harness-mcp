# Research: OAuth Authorization for the MCP Server

**Input**: [spec.md](spec.md)

This feature's spec left the *how* open by design. This document resolves the technical unknowns before design (data-model.md, contracts/) proceeds, grounded in what the repo's existing dependencies actually provide (inspected directly in `frontend/node_modules`, not assumed).

## 1. Split between Resource Server and Authorization Server

**Decision**: The MCP server (`frontend/app/mcp/route.ts`) becomes an OAuth **Protected Resource** using `mcp-handler`'s `withMcpAuth` + `protectedResourceHandler` (already a dependency, `mcp-handler@1.1.0`). A separate, first-party **Authorization Server** is implemented in this app as plain Next.js Route Handlers (Web-standard `Request`/`Response`) — hand-rolled against `@modelcontextprotocol/sdk`'s exported *types* (`OAuthClientInformationFull`, `OAuthTokens`, `AuthInfo`, `OAuthMetadata`, etc.), not against its Express-based router/handlers.

**Rationale**: Inspecting `@modelcontextprotocol/sdk`'s `server/auth/` module shows it ships two layers:
- Framework-agnostic **types** (`provider.d.ts`, `clients.d.ts`, `types.d.ts`) describing what an `OAuthServerProvider` must do (authorize, exchange code, exchange refresh token, verify token, revoke).
- A framework-**coupled** implementation of the actual HTTP endpoints (`server/auth/router.ts`, `handlers/{register,authorize,token,revoke}.ts`) built entirely on Express (`RequestHandler`, `express-rate-limit`), using Node-style `req`/`res` rather than Web `Request`/`Response`.

`mcp-handler`'s own docs (`docs/AUTHORIZATION.md` — fetched from the `vercel/mcp-handler` repo since it's not published in the npm tarball) confirm the adapter deliberately only plays Resource Server: `withMcpAuth` verifies a bearer token via a caller-supplied `verifyToken` callback and returns 401/403; it explicitly expects `authServerUrls` to point at a separate Authorization Server it does not implement.

This app is a Next.js 16 App Router project with zero Express dependency today, deployed to Vercel (README, spec 006) where App Router route handlers run against Web-standard `Request`/`Response` on both the Node and Edge runtimes. Pulling in Express (plus `express-rate-limit`) just to reuse the SDK's four handlers would fight the framework rather than fit it, and the actual protocol surface needed is small: Dynamic Client Registration (RFC 7591), Authorization Code + PKCE (RFC 6749 + RFC 7636), refresh tokens, and revocation (RFC 7009) — each straightforward to implement directly against Web APIs (`crypto.subtle.digest` for PKCE's S256 challenge is available in both Node.js and Edge runtimes).

**Alternatives considered**:
- *Bridge the SDK's Express router via a Node-compat shim (e.g. a Pages Router `pages/api/[...oauth].ts` with a req/res polyfill)*. Rejected — adds a new Express + `express-rate-limit` dependency pair for a codebase that has none, adds an incompatible second routing paradigm (Pages Router) next to the existing App Router, and doesn't clearly work with the Edge runtime.
- *Delegate the entire Authorization Server role to a managed identity provider (WorkOS AuthKit, Auth0, Clerk, etc.)*. Rejected for this version — introduces a new third-party account/service dependency and cost for what's a small, self-hosted, single-owner tool with no existing external auth infrastructure; spec.md's FR-009 already committed to a single dedicated owner credential rather than a hosted IdP. Worth reconsidering only if the project ever grows beyond a single owner.

## 2. Persistence for connected clients, tokens, and audit records (FR-012)

**Decision**: Persist all OAuth state — registered clients, issued access/refresh tokens, revocation status, and the audit log — as JSON records in the *same* S3-compatible bucket the app already requires to run (`lib/storage/client.ts`, spec 007), under a reserved key prefix (`.oauth/…`) kept out of the file-explorer's own directory listing.

**Rationale**: `frontend/instrumentation.ts` already fails the process at startup if the configured bucket isn't reachable — a working S3-compatible connection is a hard precondition for this app to run at all, on every deployment target it supports (local MinIO or Vercel + any S3-compatible provider). Reusing it for OAuth persistence means FR-012 ("survives an application restart") is satisfied for free on Vercel, where the filesystem is ephemeral between serverless invocations and a local file or in-memory store would not survive a restart or even a second invocation. It also avoids adding a brand-new stateful dependency (a database) purely for this one feature, keeping intact the project's existing story of "point `frontend/.env.local` at any S3-compatible provider, no code changes."

**Alternatives considered**:
- *Vercel KV / Redis*. Rejected — a new managed dependency the project doesn't otherwise need; `mcp-handler`'s own optional Redis integration is scoped narrowly to SSE resumability, not general persistence.
- *SQLite or a local JSON file*. Rejected — doesn't survive restarts on Vercel's ephemeral filesystem, directly contradicting FR-012 for the project's stated deployment target.
- *A new relational database (Postgres, etc.)*. Rejected as disproportionate — the data involved is a handful of small, independent record types (clients, tokens, one login-attempt counter) with low write volume (single owner, a handful of connected clients), not relational data needing joins or transactions.

## 3. Rate limiting the owner sign-in (FR-013)

**Decision**: Track failed sign-in attempts and a lockout-until timestamp in one small JSON record in the same S3-backed `.oauth/` store (read-check-then-write on each attempt), rather than an in-memory counter.

**Rationale**: An in-memory counter would not survive across serverless invocations (each may land on a different, short-lived instance), so it would not actually rate-limit anything on Vercel. The S3-backed record is read-then-written per attempt without strict atomicity guarantees; that's an acceptable trade-off here because there is exactly one legitimate user of this login screen and attempt volume is inherently low — the goal is to blunt naive automated guessing, not to provide distributed-systems-grade exactness for a multi-tenant service.

**Alternatives considered**: A dedicated rate-limiting service (e.g. Vercel Firewall / Upstash rate-limit). Rejected for this version as another new dependency disproportionate to a single-owner login form; can be layered on later without changing the data model.

## 4. Owner credential storage and verification (FR-009)

**Decision**: The dedicated owner credential is a username + password configured via new environment variables (`OAUTH_OWNER_USERNAME`, `OAUTH_OWNER_PASSWORD_HASH`), following the same `readXConfig()` / `validateXConfig()` / fail-fast-at-startup pattern already used for storage config (`lib/storage/config.ts`, `instrumentation.ts`). Only a salted hash of the password (Node's built-in `crypto.scrypt`, no new dependency) is ever stored/configured — never the plaintext password.

**Rationale**: Matches the existing project convention exactly (env-var configuration, validated once at startup, fails fast per spec 007's established pattern) and keeps this credential fully independent from the S3/MinIO storage credentials per the Clarifications session, without introducing a user-accounts system for what is, per spec.md's Assumptions, a single-owner tool.

**Alternatives considered**: Storing the plaintext password in an env var and comparing directly. Rejected — unnecessary exposure of a long-lived secret in process environment/logs when a one-way hash comparison costs nothing extra.

## 5. Token format

**Decision**: Opaque random tokens (not self-contained JWTs), looked up by ID against the S3-backed store on every request.

**Rationale**: Since every access-token verification already has to consult the durable store anyway (to honor FR-007's "revocation takes effect no later than the next request"), a self-contained JWT would add complexity (signing keys, claim design) without removing the store lookup — a stateless JWT would still need a revocation-list check to meet FR-007, which is exactly what the opaque-token lookup already gives for free.

**Alternatives considered**: JWT access tokens with a short TTL and a separate revocation list. Rejected — strictly more moving parts for the same guarantee, given the store lookup is unavoidable anyway.

## 6. Where the owner-facing screens live

**Decision**: Sign-in, consent, and the connected-clients management view are new pages/routes inside the existing `frontend/app/` tree (e.g. `app/oauth/login`, `app/oauth/authorize`, `app/settings/connected-apps`), reusing the app's existing UI conventions rather than a separate admin tool — consistent with spec.md's Assumptions section.

**Rationale**: No separate admin surface exists in the project today, and introducing one would be a new deployable/routable surface for no added value over adding a few routes to the app that's already deployed.
