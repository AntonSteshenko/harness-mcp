---
description: "Task list template for feature implementation"
---

# Tasks: Fast Owner Session Validation

**Input**: Design documents from `/specs/021-fast-owner-session/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/session-contract.md, quickstart.md

**Tests**: Not requested for this feature (no test runner is configured in this repo, per plan.md's Technical Context) — verification is the manual `quickstart.md` walkthrough, included as explicit tasks below instead of automated tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All file paths are relative to the repository root, under `frontend/`

---

## Phase 1: Setup

**Purpose**: Create the one new module this feature introduces, ready for Foundational work to fill in

- [X] T001 Create `frontend/lib/oauth/sessionSecret.ts` with imports only (`randomBytes` from `node:crypto`, `getRecord`/`putRecord` from `./store`) — no exports yet

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The generation record and its cache — read by both P1 stories (signing needs the secret, verifying needs the secret + generation)

**⚠️ CRITICAL**: Both User Story 1 and User Story 2 depend on this phase

- [X] T002 Implement `getOrCreateGenerationRecord()` in `frontend/lib/oauth/sessionSecret.ts`: read `.oauth/session-generation.json` via `getRecord()`; if absent, create `{ secret: randomBytes(32).toString("hex"), generation: 0 }` via `putRecord()` and return it (data-model.md §Generation Record)
- [X] T003 Implement `getCurrentGeneration()` in `frontend/lib/oauth/sessionSecret.ts`: module-level `{ record, fetchedAt }` cache; return the cached record if `Date.now() - fetchedAt < 30_000`, otherwise call T002's function, update the cache, and return the fresh record (data-model.md §In-Memory Generation Cache; depends on T002)

**Checkpoint**: `sessionSecret.ts` can hand out the current `{ secret, generation }` cheaply — nothing in `session.ts` uses it yet

---

## Phase 3: User Story 1 - Files open without a session-check delay (Priority: P1) 🎯 MVP

**Goal**: Validate the owner's session on every request via local signature+expiry checks instead of a per-request S3 lookup, while keeping every existing protection guarantee (spec 009) and not disrupting an actively-working owner.

**Independent Test**: Sign in, open several not-yet-opened files in a row, and confirm no separate session-check delay is perceptible before each file's own content fetch (quickstart.md Scenario 1); confirm signed-out requests to every file API still get `401`/redirect (quickstart.md Scenario 5).

### Implementation for User Story 1

- [X] T004 [US1] In `frontend/lib/oauth/session.ts`, add the `OwnerSessionPayload` type (`{ generation, issuedAt, expiresAt }`, data-model.md) and two helpers: `signPayload(payload, secret)` → `` `${base64url}.${hmacHex}` `` and `verifyPayload(cookieValue, secret)` → parsed payload or `null` on any parse/signature failure, using `crypto.createHmac("sha256", secret)` and `crypto.timingSafeEqual` for the comparison (contracts/session-contract.md §Cookie format)
- [X] T005 [US1] Rewrite `createOwnerSession()` in `frontend/lib/oauth/session.ts` to: call `getCurrentGeneration()` (T003), build an `OwnerSessionPayload` with `expiresAt` = now + `SESSION_TTL_MS`, sign it with the current `secret` (T004), and `cookies().set(...)` the result — replacing the old `putRecord("owner-sessions/...")` call entirely (depends on T003, T004)
- [X] T006 [US1] Rewrite `hasActiveOwnerSession()` in `frontend/lib/oauth/session.ts` to: read the cookie, call `verifyPayload()` (T004) against the current secret from `getCurrentGeneration()` (T003), return `false` on any parse/signature failure (this is also what makes a pre-change opaque-`sessionId` cookie fail closed — research.md §4), then check `payload.generation === current.generation` and `payload.expiresAt > now` — with **no** `getRecord()` call scoped to the session itself (depends on T005)
- [X] T007 [US1] Add sliding renewal in `frontend/lib/oauth/session.ts`: when `hasActiveOwnerSession()` (or a route/page calling it) finds a valid session whose elapsed time exceeds half of `SESSION_TTL_MS`, re-sign and re-set the cookie with a fresh `issuedAt`/`expiresAt` on the current response (FR-007; depends on T006)
- [X] T008 [US1] Run quickstart.md Scenarios 1 and 5 by hand and confirm both pass (depends on T007) — verified via `curl` against the local dev server (real R2-backed storage): signed-in requests to `/api/tree` succeed with no `owner-sessions/*` S3 lookup in the code path (confirmed by code inspection — the removed call site is gone), unauthenticated requests get `401`

**Checkpoint**: User Story 1 is fully functional — sessions validate locally, fast, with existing protection intact and no mid-task sign-outs. This alone is deployable as the MVP fix for the reported 2-3s delay.

---

## Phase 4: User Story 2 - Signing out immediately invalidates every session (Priority: P1)

**Goal**: Give the owner a real sign-out action that invalidates every previously issued session everywhere, without tracking individual sessions.

**Independent Test**: Sign in from two browsers, sign out from one, and confirm the other is rejected on its next request within the documented cache-TTL bound, not only after its natural 12h expiry (quickstart.md Scenario 2).

### Implementation for User Story 2

- [X] T009 [US2] Implement `bumpGeneration()` in `frontend/lib/oauth/sessionSecret.ts`: read the current record (T002), write it back with `generation + 1` (same `secret`), and update the in-memory cache immediately so the same instance reflects the bump on its very next request (depends on T002, T003)
- [X] T010 [US2] Create `frontend/app/oauth/logout/route.ts` (`POST`): call `requireOwnerSession()` (no-op redirect to `/oauth/login` if absent), then `bumpGeneration()` (T009), clear the `oauth_owner_session` cookie, and redirect (`303`) to `/oauth/login` (contracts/session-contract.md §POST /oauth/logout; depends on T009, T006)
- [X] T011 [US2] Add a "Sign out" form/button to `frontend/app/settings/connected-apps/page.tsx` that posts to `/oauth/logout`, following the same pattern as the existing `[grantId]/revoke` action on that page (depends on T010)
- [X] T012 [US2] Run quickstart.md Scenario 2 by hand (two-browser sign-out-everywhere check) and confirm it passes within the 30s cache-TTL bound (depends on T011) — verified via `curl` with two simulated cookie jars against the real dev server: Browser A and B both work, A signs out, and B is rejected (`401`) on its very next request; a tampered cookie and a pre-migration-shaped opaque cookie are both rejected cleanly (no crash)

**Checkpoint**: Sign-out is a real, immediate (bounded) security boundary across every device — User Stories 1 and 2 together deliver both halves of the P1 scope.

---

## Phase 5: User Story 3 - Sessions expire on their own after a short period (Priority: P2)

**Goal**: Confirm the bounded auto-expiry behavior that falls out of US1's `expiresAt` check, and that it doesn't interrupt active use.

**Independent Test**: Leave a session idle past its expiry window and confirm it's rejected (quickstart.md Scenario 3); confirm continued activity before expiry keeps the session valid via renewal (T007).

### Implementation for User Story 3

- [X] T013 [US3] Confirm `SESSION_TTL_MS` in `frontend/lib/oauth/session.ts` is the single source of truth read by both the expiry check (T006) and the renewal threshold (T007) — adjust either to reference the same constant if they've drifted (depends on T007)
- [X] T014 [US3] Run quickstart.md Scenario 3 by hand (short-TTL idle expiry, plus continued-activity renewal) and confirm it passes (depends on T013) — verified by temporarily setting `SESSION_TTL_MS` to 6s: a request before half-TTL gets no `Set-Cookie`, a request after half-TTL gets a renewed `Set-Cookie`, and a request after the full 6s with no activity gets `401`; constant reverted to 12h afterward and re-typechecked

**Checkpoint**: All three user stories are independently verified; auto-expiry is confirmed bounded and non-disruptive.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup now that all three stories are in place

- [X] T015 [P] Update the stale module-level comment in `frontend/lib/oauth/session.ts` (currently describes "Opaque session ID looked up server-side, mirroring the OAuth Token design") to reflect the new self-contained signed-cookie design
- [X] T016 [P] Grep `frontend/lib/oauth/` and `frontend/app/` for any remaining reads of the old `owner-sessions/{id}` per-session records and remove or confirm none remain (data-model.md §Generation Record, "Replaces") — confirmed zero matches for `owner-sessions` anywhere in `frontend/`
- [X] T017 Run quickstart.md Scenario 4 by hand (a cookie issued before this change is treated as signed-out after deploy) as a final regression check — verified via `curl` with a raw opaque-hex cookie value (the pre-change format): rejected with `401`, no crash

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both User Story 1 and User Story 2
- **User Story 1 (Phase 3)**: Depends on Foundational; no dependency on US2 or US3
- **User Story 2 (Phase 4)**: Depends on Foundational and on `hasActiveOwnerSession()`/`requireOwnerSession()` existing (T006 from US1) — logout needs a working verifier to gate itself and to know what it's invalidating
- **User Story 3 (Phase 5)**: Depends on the renewal logic built in US1 (T007) — there is no independent code path for expiry, only independent verification of behavior that already exists
- **Polish (Phase 6)**: Depends on all three stories being complete

### Parallel Opportunities

- T001 has nothing to run in parallel with in Phase 1 (single task)
- T004–T007 are sequential edits to the same file (`session.ts`) — no parallelism within US1
- T009 (`sessionSecret.ts`) could be started in parallel with US1's T004 (`session.ts`) by a second person, since they're different files, even though T009 is listed under US2 — T010 still can't start until both T009 and US1's T006 land
- T015 and T016 (Phase 6) touch different concerns (a comment vs. a repo-wide grep) and can run in parallel; T017 is a read-only manual check compatible with either

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001) and Phase 2 (T002-T003)
2. Complete Phase 3 / User Story 1 (T004-T008)
3. **STOP and VALIDATE**: quickstart.md Scenarios 1 and 5 pass
4. This alone fixes the reported 2-3s file-open delay and is independently deployable — sign-out just won't yet have an "everywhere" effect beyond clearing the local cookie (matches today's behavior, since no sign-out flow exists yet either)

### Incremental Delivery

1. Setup + Foundational → ready
2. User Story 1 → validate → deploy (fixes the reported latency)
3. User Story 2 → validate → deploy (adds real sign-out-everywhere)
4. User Story 3 → validate (confirms auto-expiry bound, no new code)
5. Polish → cleanup pass

---

## Notes

- No automated tests are added (none exist in this repo today); every story's "test" is its `quickstart.md` scenario, run by hand
- T004-T007 and T013 are same-file edits within `session.ts` — commit as a logical group per task rather than one giant commit
- Avoid starting US2's T010 before US1's T006 lands — the logout route calls `requireOwnerSession()`, which depends on the rewritten verifier
