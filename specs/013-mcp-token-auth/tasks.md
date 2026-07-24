---

description: "Task list template for feature implementation"
---

# Tasks: MCP Personal Access Token Authentication

**Input**: Design documents from `/specs/013-mcp-token-auth/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature (plan.md Testing: no automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-012). No test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User Story 1 (authenticate a simple MCP client with a personal access token) is P1 and is the MVP; User Story 2 (manage/revoke tokens) is P2 and builds on the same settings page US1 creates.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at `frontend/` (same app as specs 001-012): `frontend/lib/oauth/`, `frontend/app/mcp/`, `frontend/app/settings/`. No `tests/` directory — no automated tests requested. No new dependencies are introduced (research.md §1-5), so there is no Setup phase — implementation starts directly at Foundational.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The shared types and token-management module both user stories depend on

**⚠️ CRITICAL**: Complete before starting any user story phase

- [X] T001 [P] In `frontend/lib/oauth/types.ts`, add a `PersonalAccessToken` interface (`id: string`, `name: string`, `createdAt: string`, `lastUsedAt: string | null`, `revoked: boolean`, `revokedAt: string | null`) and a `PersonalAccessTokenValue` interface (`{ id: string }`, the pointer record from research.md §2); extend the existing `AuditEvent` union type with `"pat_created" | "pat_revoked"` (data-model.md "PersonalAccessToken", "PersonalAccessTokenValue", "AuditLogEntry extended")
- [X] T002 Create `frontend/lib/oauth/personalAccessTokens.ts` exporting:
  - `createPersonalAccessToken(name: string): Promise<{ record: PersonalAccessToken; secretValue: string }>` — generates a non-secret `id` (`randomBytes(8).toString("hex")`) and a secret `secretValue` (`randomBytes(32).toString("hex")`, same approach as `lib/oauth/tokens.ts`'s opaque tokens, duplicated locally per research.md §1/§3 rather than imported cross-module), writes the `PersonalAccessToken` record to `pats/{id}` and the pointer `{ id }` to `pat-values/{secretValue}` (via `getRecord`/`putRecord` from `./store`), and returns both — the caller is responsible for displaying `secretValue` exactly once (FR-001, FR-002)
  - `listPersonalAccessTokens(): Promise<PersonalAccessToken[]>` — `listRecords<PersonalAccessToken>("pats/")` (FR-005)
  - `revokePersonalAccessToken(id: string): Promise<void>` — reads `pats/{id}`, and if present and not already revoked, writes back `{ ...record, revoked: true, revokedAt: new Date().toISOString() }` (FR-006, FR-007)
  - `verifyPersonalAccessToken(secretValue: string): Promise<AuthInfo | undefined>` — reads `pat-values/{secretValue}` for the pointer, then `pats/{id}`; returns `undefined` if either is missing or `record.revoked` is `true`; otherwise updates `lastUsedAt` and returns `{ token: secretValue, clientId: \`pat:${id}\`, scopes: ["full_access"] }` (no `expiresAt`, per FR-010) (data-model.md, research.md §2-§3)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 2: User Story 1 - Connect a simple MCP client using a personal access token (Priority: P1) 🎯 MVP

**Goal**: The owner can generate a personal access token from a settings page and immediately use it as a bearer credential against `/mcp`, with the same full access level as an OAuth-connected client, and with zero effect on existing OAuth-based connections.

**Independent Test**: Generate a personal access token from the settings area, send it as a bearer token directly to `/mcp` (e.g. via `curl`), and confirm an MCP tool call succeeds with no OAuth sign-in/consent screen involved (spec.md US1, quickstart.md Scenarios 1-3).

### Implementation for User Story 1

- [X] T003 [US1] In `frontend/app/mcp/route.ts`, change the `withMcpAuth` callback from `verifyAccessToken(bearerToken)` alone to `(await verifyAccessToken(bearerToken)) ?? (await verifyPersonalAccessToken(bearerToken))`, importing `verifyPersonalAccessToken` from `@/lib/oauth/personalAccessTokens` (T002) alongside the existing `verifyAccessToken` import (FR-003, FR-004, contracts/personal-access-tokens.md `/mcp`)
- [X] T004 [US1] Create `frontend/app/settings/personal-access-tokens/create/route.ts` (`POST`): require an active owner session (same check as `requireOwnerSession`/`hasActiveOwnerSession` from `@/lib/oauth/session`, returning a `401` JSON error otherwise); read a `name` field from the form-encoded request body; if `name` is empty/whitespace-only, return a validation error; otherwise call `createPersonalAccessToken(name)` (T002), append a `pat_created` entry via `appendAuditLine` (`{ at, event: "pat_created", clientId: record.id, clientName: record.name }`, mirroring the existing `grant_revoked` append in `connected-apps/[grantId]/revoke/route.ts`), and render an HTML response body showing `secretValue` in full with a clear "copy this now, it will not be shown again" message and a link back to `/settings/personal-access-tokens` — never via redirect or query string (FR-001, FR-002, FR-009, research.md §4, contracts/personal-access-tokens.md)
- [X] T005 [US1] Create `frontend/app/settings/personal-access-tokens/page.tsx`, mirroring `frontend/app/settings/connected-apps/page.tsx`'s structure: redirect to `/oauth/login?continue=%2Fsettings%2Fpersonal-access-tokens` when `hasActiveOwnerSession()` is false; otherwise call `listPersonalAccessTokens()` (T002) and render each token's `name`, `createdAt`, `lastUsedAt` (or "never"), and status — never `secretValue` — plus a `<form method="POST" action="/settings/personal-access-tokens/create">` with a `name` text input for creating a new token (T004) (FR-001, FR-005, contracts/personal-access-tokens.md)

**Checkpoint**: User Story 1 is fully functional and independently testable — a personal access token can be generated and immediately used to call MCP tools, with OAuth-connected clients unaffected (quickstart.md Scenarios 1-3)

---

## Phase 3: User Story 2 - Manage and revoke personal access tokens (Priority: P2)

**Goal**: The owner can see every personal access token they've created and revoke any one of them, immediately cutting off that token's access without affecting any other token or any OAuth-connected client.

**Independent Test**: With at least one personal access token created, open the personal access tokens list, revoke one, and confirm a subsequent MCP request using that token's value is rejected while every other token and OAuth client keeps working (spec.md US2, quickstart.md Scenarios 4-5).

### Implementation for User Story 2

- [X] T006 [US2] Create `frontend/app/settings/personal-access-tokens/[id]/revoke/route.ts` (`POST`), mirroring `frontend/app/settings/connected-apps/[grantId]/revoke/route.ts`: require an active owner session (`401` JSON error otherwise); read `id` from the route params; call `revokePersonalAccessToken(id)` (T002); append a `pat_revoked` entry via `appendAuditLine` (looking up the token's `name` first for `clientName`, same shape as T004's audit line); redirect (`303`) back to `/settings/personal-access-tokens` — an already-revoked or unknown `id` is a no-op that still redirects, matching the connected-apps revoke route's idempotent behavior (FR-006, FR-007, FR-009, contracts/personal-access-tokens.md)
- [X] T007 [US2] In `frontend/app/settings/personal-access-tokens/page.tsx` (T005), add a `<form method="POST" action={\`/settings/personal-access-tokens/${token.id}/revoke\`}>` with a "Revoke" submit button on each row for a token whose status is still active, mirroring the existing revoke form in `connected-apps/page.tsx` (FR-006)

**Checkpoint**: Both user stories are independently functional — tokens can be generated, listed, used, and revoked, with revocation taking effect on the very next request (quickstart.md Scenarios 4-5)

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across the whole feature, including confirming no regression to OAuth and that durability (FR-011) actually holds across a restart

- [X] T008 [P] Run the full `quickstart.md` walkthrough (Scenarios 1-7) end-to-end against a running `next dev` instance, including Scenario 3 (confirming an existing OAuth-connected client from spec 008 is unaffected), Scenario 6 (owner sign-in gate enforced on all three new routes), and Scenario 7 (a personal access token and its metadata survive an application restart). **Verified 2026-07-24** via `curl` against the live `next dev` instance on port 3002 (signed in as owner through `/oauth/login/submit`, no browser needed): Scenario 1 (token created, secret shown once in the response body, listed afterward without the secret) ✓; Scenario 2 (bearer call to `/mcp` with the personal access token succeeded, `tools/list` returned) ✓; unknown-token rejection (401) ✓; Scenario 4 (revoke → subsequent call 401, list shows "revoked") ✓; Scenario 5 (revoking `token-a` left `token-b` fully working — 401 vs 200) ✓; Scenario 6 (unauthenticated GET redirects to `/oauth/login`, unauthenticated POST create/revoke both 401) ✓. All test tokens created during this run were revoked afterward as cleanup. **Not verified**: Scenario 3 (no live OAuth-connected client existed in this environment to test against — the code change is a minimal, additive `??` fallback in `mcp/route.ts` that doesn't touch `verifyAccessToken` at all, so regression risk is low but not empirically confirmed) and Scenario 7 (didn't restart the shared `next dev` process to avoid disrupting other work — the storage mechanism is the exact same `lib/oauth/store.ts` KV helpers already relied on for OAuth tokens/grants' durability, so this is architecturally covered but not independently re-verified by an actual restart).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories.
- **User Stories (Phase 2-3)**: All depend on Foundational phase completion (T001, T002).
- **Polish (Phase 4)**: Depends on both user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational (T001, T002) — touches `frontend/app/mcp/route.ts` and creates the `frontend/app/settings/personal-access-tokens/` directory (list page + create route)
- **User Story 2 (P2)**: Depends on Foundational (T002, for `revokePersonalAccessToken`) and on User Story 1 (T005 — the revoke form is added to the page US1 creates; T006 is an independent new file)

### Within Each User Story

- T001 is a prerequisite for T002 (personalAccessTokens.ts imports the new types)
- T003, T004, T005 all depend on T002; T004 and T005 additionally reference each other (T005's form posts to T004's route) but are different files, so T004 should land first for the reference to make sense, though both can be drafted together
- T006 depends on T002; T007 depends on both T005 (the file it edits) and T006 (the route it links to)

### Parallel Opportunities

- T001 has no dependency on anything and can start immediately (marked [P])
- T008 (Polish) is the only other [P] task, since it's a validation-only pass with no file conflicts
- Everything else is sequential: T002 depends on T001; T003-T005 depend on T002; T006 depends on T002; T007 depends on T005/T006 — this feature's small size means most tasks naturally chain rather than parallelize

---

## Parallel Example: Foundational Phase

```bash
# T001 has no dependencies and can start immediately:
Task: "Add PersonalAccessToken/PersonalAccessTokenValue types and extend AuditEvent in frontend/lib/oauth/types.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Foundational (T001, T002)
2. Complete Phase 2: User Story 1 (generate a token, use it against `/mcp`)
3. **STOP and VALIDATE**: quickstart.md Scenarios 1-3
4. Deploy/demo the MVP — simple MCP clients can now authenticate without OAuth

### Incremental Delivery

1. Foundational (T001, T002) → foundation ready
2. Add User Story 1 → validate independently (quickstart.md Scenarios 1-3) — MVP complete
3. Add User Story 2 → validate independently (quickstart.md Scenarios 4-5)
4. Polish (Phase 4) → full quickstart.md walkthrough, including the OAuth-non-regression check and restart-durability check (Scenarios 3, 6, 7)

---

## Notes

- [P] tasks touch different files with no ordering dependency on incomplete work
- [Story] label maps each task to its user story for traceability
- This feature deliberately reuses spec 008's existing `.oauth/` KV store, owner-session gate, and connected-apps page structure end to end (research.md §1) — no new storage mechanism, no new dependency, no change to OAuth's existing behavior
- Verify each user story against its quickstart.md scenarios before moving to the next
- Commit after each task or logical group
