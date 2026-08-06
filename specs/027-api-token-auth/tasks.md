---

description: "Task list template for feature implementation"
---

# Tasks: REST API Token Authentication

**Input**: Design documents from `/specs/027-api-token-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/file-api-auth.md, quickstart.md (all present)

**Tests**: Not requested in spec.md and no automated test suite exists in this repo (plan.md Technical Context). Each story instead carries a manual verification task against `quickstart.md`.

**Organization**: Tasks are grouped by user story (spec.md: US1 P1, US2 P2, US3 P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to the repository root (`/develop/harness-mcp`)

## Phase 1: Setup

Not applicable — this feature extends one existing function in an already-configured Next.js project (no new dependencies, tooling, or scaffolding required). Proceeding directly to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared file-API auth guard so every user story below (read via token, write via token, unchanged cookie behavior) has something to verify against. Because all three user stories exercise the *same* guard function on the *same* set of routes, the code change itself is a shared prerequisite rather than something owned by a single story (plan.md Structure Decision; research.md §1–5; contracts/file-api-auth.md).

**⚠️ CRITICAL**: No user story verification can begin until T001 is complete.

- [X] T001 In `frontend/lib/oauth/session.ts`, extend `requireOwnerSession()` so that when `readSessionPayload()` finds no valid session cookie, it reads the `Authorization` header via `headers()` from `next/headers` and, if it is `Bearer <token>`, tries `verifyAccessToken(token)` (from `frontend/lib/oauth/tokens.ts`) and falls back to `verifyPersonalAccessToken(token)` (from `frontend/lib/oauth/personalAccessTokens.ts`) — the same `verifyAccessToken(...) ?? verifyPersonalAccessToken(...)` chain already used in `frontend/app/mcp/route.ts`. If either succeeds, return `null` (request proceeds) without touching cookie-renewal logic. If neither succeeds (or the header is absent/malformed), return the existing `NextResponse.json({ code: "unauthorized", message: "Sign in required" }, { status: 401 })` unchanged. Keep the function's signature as `(): Promise<NextResponse | null>` — no call site changes. Update the function's doc comment to describe the new fallback (research.md §1–4; contracts/file-api-auth.md).

**Checkpoint**: `frontend/lib/oauth/session.ts` type-checks; all five existing callers (`app/api/file/route.ts`, `app/api/tree/route.ts`, `app/api/directory/route.ts`, `app/api/upload/route.ts`, `app/api/download-zip/route.ts`) automatically gain bearer-token support with zero edits to those files (plan.md Structure Decision). User story verification can now begin.

---

## Phase 3: User Story 1 - Read a file from an external server-side application (Priority: P1) 🎯 MVP

**Goal**: An external, server-side application can read a file's contents through the API using only a bearer token (Personal Access Token or OAuth access token), with no browser session.

**Independent Test**: Send a cookie-less HTTP request to the file API with a valid bearer token and confirm the file contents are returned (spec.md US1 Acceptance Scenarios; quickstart.md steps 1–4).

### Implementation for User Story 1

- [ ] T002 [US1] Manually verify quickstart.md steps 1–4 against a running dev server: create a Personal Access Token via `/settings/personal-access-tokens`, create/upload a test file (e.g. `test.csv`) via the existing browser editor, then send a cookie-less `curl GET /api/file?path=test.csv` with `Authorization: Bearer <PAT>` and confirm `200` with the file's content returned; repeat with a valid OAuth access token instead of a PAT and confirm the same result. Depends on: T001.

**Checkpoint**: User Story 1 is fully functional and independently testable — an external app can read a file through the API using only a token.

---

## Phase 4: User Story 2 - Write/update a file from an external server-side application (Priority: P2)

**Goal**: The same external application can also save edits back to a file using bearer-token authentication, and a revoked token is rejected.

**Independent Test**: Send a cookie-less write request to the file API with a valid Personal Access Token and confirm the change persists; then revoke the token and confirm a repeat request is rejected (spec.md US2 Acceptance Scenarios; quickstart.md steps 5–6).

### Implementation for User Story 2

- [ ] T003 [US2] Manually verify quickstart.md steps 5–6 against a running dev server: send a cookie-less `curl PUT /api/file?path=test.csv` (reusing the file from T002) with `Authorization: Bearer <PAT>` and a JSON body, confirm success and that the change is visible when reopening the file in the browser editor; then revoke that PAT via `/settings/personal-access-tokens` and repeat the same `PUT` request, confirming `401 { "code": "unauthorized", "message": "Sign in required" }` and that the file content is unchanged. Depends on: T001; reuses the file created in T002.

**Checkpoint**: User Stories 1 AND 2 both work — an external app can read and write files through the API using only a token, and revocation takes effect immediately.

---

## Phase 5: User Story 3 - Existing browser-based access keeps working unchanged (Priority: P3)

**Goal**: The owner's existing browser-based session (cookie only, no bearer token) continues to work exactly as it did before this feature.

**Independent Test**: Use the existing web editor with only a session cookie present and confirm every file operation succeeds exactly as before, with no `Authorization` header sent (spec.md US3 Acceptance Scenarios; quickstart.md steps 7–8).

### Implementation for User Story 3

No new code: T001 checks the session cookie first and only inspects the `Authorization` header when the cookie check fails (research.md §3), so cookie-authenticated requests are untouched by construction. This story is verification-only.

- [ ] T004 [US3] Manually verify quickstart.md steps 7–8 against a running dev server: with a normal signed-in browser session, open, edit, and save a file at `/files` and confirm it behaves exactly as before this feature; inspect the request in the browser's network tab and confirm it carries the `oauth_owner_session` cookie and no `Authorization` header, and still succeeds. Depends on: T001.

**Checkpoint**: All three user stories are independently verified — external token-based access works (US1, US2) and existing browser-session access is unchanged (US3).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T005 Manually verify the edge cases in quickstart.md steps 9–10 against a running dev server: a request with neither a session cookie nor an `Authorization` header returns `401` with the unchanged response shape; a request with a syntactically invalid bearer value (`Authorization: Bearer not-a-real-token`) also returns `401` with the same shape (spec.md Edge Cases; SC-004). Depends on: T001.
- [ ] T006 Run the full `quickstart.md` walkthrough (all 10 steps) end-to-end as a final sign-off, after T002–T005 are individually complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Not applicable — no tasks.
- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories (T001 is the only code change any story verifies against).
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion.
  - US1 (T002) has no dependency on US2 or US3.
  - US2 (T003) depends on T001; reuses (but does not require) the test file from T002.
  - US3 (T004) depends only on T001; independent of US1/US2.
- **Polish (Phase 6)**: T005 depends on T001; T006 depends on T002–T005 all being complete.

### Within Each User Story

- US1: T002 is the sole task (verification only, since T001 already implements the behavior).
- US2: T003 (verification only) — after T001, informally after T002 for a ready-made test file.
- US3: T004 (verification only) — after T001.

### Parallel Opportunities

- T001 has no parallel counterpart — it is a single, cohesive edit to one function in one file.
- Once T001 lands, T002, T003, and T004 exercise independent scenarios (read-via-token, write-via-token, cookie-session-unchanged) against the same running dev server and could be performed in any order; T003 is listed after T002 only because it reuses the same test file for convenience, not because of a hard technical dependency.

---

## Parallel Example: Post-Foundational Verification

```bash
# After T001 is committed, the three story verifications are independent scenarios
# (though each is a manual quickstart.md walkthrough, not a background job):
Task: "Verify read-via-token (quickstart.md steps 1-4)"
Task: "Verify write-via-token and revocation (quickstart.md steps 5-6)"
Task: "Verify unchanged cookie-session behavior (quickstart.md steps 7-8)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001) — this alone implements the entire feature's behavior.
2. Complete Phase 3: User Story 1 (T002).
3. **STOP and VALIDATE**: confirm an external app can read a file via a bearer token with no session cookie.
4. This alone satisfies the core request (read access for an external app).

### Incremental Delivery

1. Foundational (T001) → the guard now accepts bearer tokens; all five routes gain the capability at once.
2. Add User Story 1 (T002) → confirm read access via token (MVP).
3. Add User Story 2 (T003) → confirm write access and revocation via token.
4. Add User Story 3 (T004) → confirm existing browser-session behavior is unbroken.
5. Polish (T005–T006) → edge cases and one final full quickstart pass.

## Notes

- [P] tasks = different files, no dependencies. This feature's single code change (T001) has no parallel counterpart, and the verification tasks are manual walkthroughs rather than independently-runnable background jobs, so no task here is marked `[P]`.
- [Story] label maps task to specific user story for traceability.
- This is a small, single-file-change feature — nearly all of the delivered value comes from T001; the user-story phases exist to keep verification traceable to spec.md's acceptance scenarios, not because the implementation itself splits across stories.
- Commit after each task or logical group.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
