---

description: "Task list for OAuth Authorization for the MCP Server"
---

# Tasks: OAuth Authorization for the MCP Server

**Input**: Design documents from `/specs/008-mcp-oauth/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/oauth-endpoints.md](contracts/oauth-endpoints.md), [quickstart.md](quickstart.md)

**Tests**: No test tasks are included — spec.md did not request tests, this project has no automated test suite (specs 001–007 validate via `quickstart.md` instead), and per project instruction tests are not to be executed as part of this workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

Single Next.js project at `frontend/` (plan.md Structure Decision) — all paths below are relative to the repository root, inside `frontend/`.

---

## Phase 1: Setup

**Purpose**: Files needed before any OAuth code exists

- [X] T001 [P] Add `OAUTH_OWNER_USERNAME` and `OAUTH_OWNER_PASSWORD_HASH` to `frontend/.env.example`, documenting that the value is a `scrypt` hash (never the plaintext password) and pointing at the generator script from T002 (data-model.md OwnerCredential, research.md §4)
- [X] T002 [P] Create `frontend/scripts/hash-owner-password.mjs`: a small Node script (`node scripts/hash-owner-password.mjs <password>`) that prints a `scrypt` hash suitable for `OAUTH_OWNER_PASSWORD_HASH`, using Node's built-in `crypto` module (research.md §4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared OAuth primitives (persistence, credentials, tokens, PKCE, sessions, discovery, registration, and the auth-gated `/mcp` route) that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Define TypeScript types for every data-model.md entity (`RegisteredClient`, `AuthorizationGrant`, `AuthorizationCode`, `Token`, `LoginAttemptState`, `AuditLogEntry`) in `frontend/lib/oauth/types.ts`
- [X] T004 Implement `frontend/lib/oauth/store.ts`: generic `getRecord<T>(key)` / `putRecord<T>(key, value)` / `listRecords<T>(prefix)` against the existing `s3Client`/`BUCKET` (`frontend/lib/storage/client.ts`), reading/writing JSON under the reserved `.oauth/` key prefix (depends on T003; data-model.md)
- [X] T005 [P] Exclude the `.oauth/` key prefix from the web file explorer's directory listing (`frontend/lib/storage/directories.ts`) and from the MCP tools' directory/tree listing (`frontend/lib/mcp-tools`) — it is server-internal OAuth state, not user content (data-model.md)
- [X] T006 [P] Implement `frontend/lib/oauth/config.ts`: `readOwnerCredentialConfig()` / `validateOwnerCredentialConfig()` reading `OAUTH_OWNER_USERNAME` / `OAUTH_OWNER_PASSWORD_HASH` from `process.env`, following the same never-throw-at-import / throw-on-validate pattern as `frontend/lib/storage/config.ts` (data-model.md OwnerCredential)
- [X] T007 Extend `frontend/instrumentation.ts` to also call a new `verifyOwnerCredentialConfig()` at startup, exiting the process with a clear error if `OAUTH_OWNER_USERNAME` / `OAUTH_OWNER_PASSWORD_HASH` are missing or malformed, alongside the existing storage check (depends on T006; FR-009)
- [X] T008 [P] Implement `frontend/lib/oauth/pkce.ts`: `verifyPkce(codeVerifier, codeChallenge)` computing the S256 challenge via Web Crypto `subtle.digest("SHA-256", ...)` (research.md §1)
- [X] T009 [P] Implement `frontend/lib/oauth/session.ts`: issue/verify a signed, httpOnly cookie representing an active owner sign-in session, used to gate the consent-approval action and the connected-clients management pages
- [X] T010 Implement `frontend/lib/oauth/rateLimit.ts`: read/update `LoginAttemptState` via T004's store — reject immediately while locked out, increment `failedAttempts` on failure, reset on success (depends on T004; FR-013)
- [X] T011 Implement `frontend/lib/oauth/tokens.ts`: `issueTokenPair(grantId, clientId)` and `verifyAccessToken(token)` (returning the SDK's `AuthInfo` shape, or `undefined`), checking `Token.revoked`, `Token.expiresAt`, and the parent `AuthorizationGrant.status === "active"`; on successful verification, also updates that grant's `lastUsedAt` (depends on T004; data-model.md validation rules)
- [X] T012 [P] Implement `frontend/app/.well-known/oauth-authorization-server/route.ts`: RFC 8414 Authorization Server Metadata (`issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `code_challenge_methods_supported: ["S256"]`, `grant_types_supported`) per contracts/oauth-endpoints.md
- [X] T013 [P] Implement `frontend/app/.well-known/oauth-protected-resource/route.ts` using `mcp-handler`'s `protectedResourceHandler` + `metadataCorsOptionsRequestHandler` (research.md §1, contracts/oauth-endpoints.md)
- [X] T014 Implement `frontend/app/oauth/register/route.ts`: Dynamic Client Registration (RFC 7591) — validates `redirect_uris` is non-empty with valid URL entries, creates a `RegisteredClient` via T004's store (depends on T003, T004; FR-002, contracts/oauth-endpoints.md)
- [X] T015 Wrap `frontend/app/mcp/route.ts` with `mcp-handler`'s `withMcpAuth`, using T011's `verifyAccessToken` as the `verifyToken` callback (`required: true`, `resourceMetadataPath: "/.well-known/oauth-protected-resource"`) — every MCP tool request now requires a valid token before any storage operation runs (depends on T011, T013; FR-001)

**Checkpoint**: Foundation ready — client registration, discovery, and auth-gated `/mcp` all work; user story implementation can now begin

---

## Phase 3: User Story 1 - Connect an AI assistant to the MCP server (Priority: P1) 🎯 MVP

**Goal**: An owner can sign in, approve a connecting AI assistant, and that assistant can immediately call MCP tools

**Independent Test**: From an AI assistant's "add connector" flow (or a manual walkthrough per quickstart.md §1), register, sign in, approve, exchange the code for tokens, and successfully call an MCP tool

### Implementation for User Story 1

- [X] T016 [US1] Implement `frontend/app/oauth/login/page.tsx`: owner sign-in form (username/password) posting to the login route
- [X] T017 [US1] Implement `frontend/app/oauth/login/submit/route.ts` (moved from the originally planned `login/route.ts` — Next.js forbids a `route.ts` and `page.tsx` at the same path as `login/page.tsx` from T016): `POST` handler — checks T010's rate limiter first, verifies the password against T006's config, and on success issues a session via T009 (depends on T006, T009, T010; FR-009, FR-013)
- [X] T018 [US1] ~~Implement `frontend/app/oauth/authorize/route.ts`~~ — merged into T019: Next.js forbids a `route.ts` and `page.tsx` at the same path, so GET validation + consent rendering both live in the Server Component page instead (depends on T009, T014; contracts/oauth-endpoints.md)
- [X] T019 [US1] Implement `frontend/app/oauth/authorize/page.tsx`: Server Component — validates `client_id`/`redirect_uri` against the `RegisteredClient` from T014's store, redirects to `/oauth/login` if there's no owner session (T009), otherwise renders the consent screen showing `RegisteredClient.clientName` with Approve/Deny actions posting to the decision route (FR-003)
- [X] T020 [US1] Implement `frontend/app/oauth/authorize/decision/route.ts`: `POST` — on approve, creates an `AuthorizationGrant` (status `active`) and an `AuthorizationCode`, records an `AuditLogEntry` (`grant_approved`), and redirects to the client's `redirect_uri` with `code`/`state`; on deny, redirects with `error=access_denied` and records `grant_denied` — no grant, code, or token is created (depends on T004, T009; FR-003, FR-004, FR-011, spec.md Edge Cases)
- [X] T021 [US1] Implement `frontend/app/oauth/token/route.ts`: `POST` — for `grant_type=authorization_code`, validates PKCE (T008), redirect URI match, and the code's `expiresAt`/`consumedAt` (rejecting reuse and invalidating any tokens already issued from a reused code, per spec.md Edge Cases), then issues a `Token` pair via T011; for `grant_type=refresh_token`, validates the refresh token (unrevoked, unexpired, parent grant active) and issues a new pair without re-prompting the owner (depends on T004, T008, T011; FR-005, contracts/oauth-endpoints.md)
- [X] T022 [US1] Update root `README.md`'s MCP server section to document the new `OAUTH_OWNER_USERNAME`/`OAUTH_OWNER_PASSWORD_HASH` setup step (linking T002's generator script) and how to add the server as a connector in ChatGPT/Claude (depends on T002)

**Checkpoint**: User Story 1 fully functional and testable independently — quickstart.md §1, §2, §5

---

## Phase 4: User Story 2 - Unauthorized requests are rejected (Priority: P2)

**Goal**: Requests without a valid, unexpired, unrevoked token never reach a storage operation

**Independent Test**: Call `/mcp` with no token, then with a token revoked via T023, and confirm both are rejected (quickstart.md §3)

### Implementation for User Story 2

- [X] T023 [US2] Implement `frontend/app/oauth/revoke/route.ts`: `POST` RFC 7009 token revocation — marks the matching `Token` and its `pairId`-linked pair revoked; treats an already-invalid token as successfully revoked per RFC 7009 (depends on T004, T011; contracts/oauth-endpoints.md)
- [X] T024 [US2] Verify (and adjust if needed) `frontend/app/mcp/route.ts`'s `withMcpAuth` configuration so a request with no token, an expired token, and a token revoked via T023 all produce a `401` with `WWW-Authenticate` pointing at `/.well-known/oauth-protected-resource`, with no MCP tool ever running first (depends on T015, T023; FR-001, SC-002, quickstart.md §3) — verified against `mcp-handler`'s source: `withMcpAuth` already sets `WWW-Authenticate: Bearer error="...", resource_metadata="..."` on every 401 once `resourceMetadataPath` is set (T015), so no code change was needed

**Checkpoint**: User Stories 1 AND 2 both work independently — quickstart.md §1–§3, §5, §6

---

## Phase 5: User Story 3 - Review and revoke connected assistants (Priority: P3)

**Goal**: The owner can see every connected client and revoke any one of them without affecting the others

**Independent Test**: With two clients connected, revoke one via the connected-apps view and confirm only that one stops working (quickstart.md §4)

### Implementation for User Story 3

- [X] T025 [US3] Implement `frontend/app/settings/connected-apps/page.tsx`: lists every `RegisteredClient` with an `AuthorizationGrant` — `clientName`, `status`, `authorizedAt`, `lastUsedAt` — behind the owner session gate (depends on T004, T009; FR-006)
- [X] T026 [US3] Implement `frontend/app/settings/connected-apps/[grantId]/revoke/route.ts`: `POST` — sets the target `AuthorizationGrant.status = "revoked"` / `revokedAt`, records an `AuditLogEntry` (`grant_revoked`); does not touch any other client's grant (depends on T004, T009; FR-007, FR-008, FR-011)

**Checkpoint**: All user stories independently functional — quickstart.md §4, §7, §8

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] Update root `README.md`'s "S3 Storage MCP Server" section to describe the end-to-end OAuth flow (register → sign in → consent → connected) and link to `specs/008-mcp-oauth/quickstart.md` — done together with T022, which already added this section
- [X] T028 Run `specs/008-mcp-oauth/quickstart.md` end-to-end (all 9 scenarios), confirming every acceptance scenario and success criterion in spec.md passes (depends on T001–T026) — verified live via `npx next build && npx next start -p 3100` against local MinIO (never against the real S3/R2 backend in `frontend/.env.local`) using curl to drive the full OAuth dance: §1 register→login→consent→token→tool call succeeded; §2 deny produced no code/token; §3 no-token and revoked-token calls both 401'd; §4 the connected-apps UI listed and revoked a grant, taking effect immediately; §5 refresh issued a new pair without re-consent; §6 replaying a consumed authorization code was rejected and retroactively invalidated the tokens already issued from it; §7 five failed sign-ins triggered lockout, blocking even the correct password until it expired; §8 all OAuth state (grants, the owner session) survived a full process restart; §9 create_file/read_file/delete_file worked unchanged through the now-gated `/mcp` route

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001 feeds T006's env docs; T002 is standalone) — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational (T003–T015) completion
  - User stories can then proceed in priority order (P1 → P2 → P3), or in parallel if staffed
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational only — delivers the full connect flow standalone
- **User Story 2 (P2)**: Depends on Foundational's `withMcpAuth` wiring (T015); adds the revoke endpoint (T023) needed to demonstrate the "revoked token" half of its independent test
- **User Story 3 (P3)**: Depends on Foundational's store (T004) and session (T009); independent of US1/US2's own tasks, though it's only meaningful to demo after US1 has produced at least one connected client

### Within Each User Story

- Shared lib code before routes; routes before pages that call them
- Story complete and independently testable before moving to the next priority

### Parallel Opportunities

- T001, T002 (Setup) can run in parallel
- T003, T005, T006, T008, T009 (Foundational, no shared dependency) can run in parallel
- T012, T013 (Foundational discovery endpoints, different files) can run in parallel
- Once Foundational completes, US1, US2, and US3 can be staffed in parallel (US2 and US3 mostly reuse Foundational primitives rather than blocking on US1's routes)

---

## Parallel Example: Foundational Phase

```bash
# Launch independent Foundational tasks together:
Task: "Define TypeScript types for OAuth entities in frontend/lib/oauth/types.ts"
Task: "Exclude .oauth/ prefix from directory listings in frontend/lib/storage/directories.ts and frontend/lib/mcp-tools"
Task: "Implement owner credential config in frontend/lib/oauth/config.ts"
Task: "Implement PKCE verification in frontend/lib/oauth/pkce.ts"
Task: "Implement owner session cookie in frontend/lib/oauth/session.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003–T015) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T016–T022)
4. **STOP and VALIDATE**: Run quickstart.md §1, §2, §5 — confirm a client can register, connect, and call a tool
5. Demo if ready — note that without US2's explicit revoke endpoint, an owner still can't yet un-approve a client, and without US3 there's no UI to see what's connected

### Incremental Delivery

1. Setup + Foundational → foundation ready (client registration, discovery, and 401-on-no-token already work)
2. Add User Story 1 → validate (quickstart.md §1, §2, §5) → MVP demo-able
3. Add User Story 2 → validate (quickstart.md §3, §6) → revocation and rejection paths fully demonstrable
4. Add User Story 3 → validate (quickstart.md §4, §7, §8) → owner can see and manage connected clients
5. Polish (T027, T028) → README updated, full quickstart re-run end-to-end

---

## Notes

- No test tasks are included — spec.md did not request tests, this project has no automated test suite, and per project instruction tests are not to be executed as part of this workflow.
- [P] tasks touch different files with no dependency between them.
- Every task names an exact file path so it is directly actionable.
- Commit after each task or logical group, consistent with prior features in this repo.
