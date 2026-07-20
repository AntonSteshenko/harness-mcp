---

description: "Task list for Require Owner Login for the File Editor Page"
---

# Tasks: Require Owner Login for the File Editor Page

**Input**: Design documents from `/specs/009-editor-login-gate/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/protected-routes.md](contracts/protected-routes.md), [quickstart.md](quickstart.md)

**Tests**: No test tasks are included — spec.md did not request tests, this project has no automated test suite (specs 001–008 validate via `quickstart.md` instead), and per project instruction tests are not to be executed as part of this workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

Single Next.js project at `frontend/` (plan.md Structure Decision) — all paths below are relative to the repository root, inside `frontend/`.

No new dependencies are introduced (research.md), and there is no shared prerequisite between User Story 1 and User Story 2 — they touch entirely disjoint files (the editor page vs. the API route handlers) — so there is no Setup or Foundational phase; implementation starts directly at User Story 1.

---

## Phase 1: User Story 1 - Editor page requires sign-in (Priority: P1) 🎯 MVP

**Goal**: A signed-out visitor who requests `/editor` is redirected to the existing owner sign-in screen and sees no editor UI, file tree, or file content; after signing in with the owner credential, they land on a fully working editor.

**Independent Test**: In a signed-out browser session, visit `/editor` directly and confirm the sign-in screen appears with no file data ever rendered; sign in with the owner credential and confirm the editor loads normally (quickstart.md §1).

### Implementation for User Story 1

- [X] T001 [US1] Create `frontend/app/editor/EditorApp.tsx`: move the entire current body of `frontend/app/editor/page.tsx` here unchanged (the `"use client"` directive, all imports, state, handlers, and JSX), renamed from `EditorPage` to `EditorApp` as the default export (plan.md Project Structure)
- [X] T002 [US1] Rewrite `frontend/app/editor/page.tsx` as an async server component (drop `"use client"`): call `hasActiveOwnerSession()` from `frontend/lib/oauth/session.ts`; if `false`, call `redirect(`/oauth/login?continue=${encodeURIComponent("/editor")}`)` from `next/navigation`; otherwise render `<EditorApp />` from T001 — mirrors the exact pattern already used in `frontend/app/settings/connected-apps/page.tsx` (research.md §1, FR-001, FR-002, FR-003, FR-007) (depends on T001)
- [ ] T003 [US1] Execute quickstart.md §1 against the local dev server; confirm SC-001, SC-002 (depends on T002) — **not run**: per standing user instruction not to execute tests, and this project treats quickstart.md as its test equivalent; needs manual verification

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md §1) — the editor page itself is now gated, regardless of whether its API routes are guarded yet

---

## Phase 2: User Story 2 - Underlying file APIs are also protected (Priority: P2)

**Goal**: Every one of the editor's data endpoints rejects requests when there's no active owner session, so the page-level gate from User Story 1 can't be bypassed by calling the endpoints directly; a session that expires mid-use sends the browser back to sign-in instead of failing silently.

**Independent Test**: While signed out, call each of `GET /api/tree`, `POST`/`DELETE /api/directory`, `GET`/`PUT`/`POST`/`DELETE /api/file`, `POST /api/upload`, and `GET /api/download-zip` directly and confirm each returns `401` with no file/folder data; repeat while signed in and confirm each succeeds (quickstart.md §2).

### Implementation for User Story 2

- [X] T004 [US2] Add `requireOwnerSession(): Promise<NextResponse | null>` to `frontend/lib/oauth/session.ts`: calls the existing `hasActiveOwnerSession()`; returns `NextResponse.json({ code: "unauthorized", message: "Sign in required" }, { status: 401 })` when it's `false`, or `null` when the caller may proceed (research.md §2, contracts/protected-routes.md)
- [X] T005 [P] [US2] Guard `GET` in `frontend/app/api/tree/route.ts`: call `requireOwnerSession()` first and `return` its result if non-null, before the existing `listDirectory` call (depends on T004; contracts/protected-routes.md)
- [X] T006 [P] [US2] Guard `POST` and `DELETE` in `frontend/app/api/directory/route.ts` the same way, before their existing storage calls (depends on T004; contracts/protected-routes.md)
- [X] T007 [P] [US2] Guard `GET`, `PUT`, `POST`, and `DELETE` in `frontend/app/api/file/route.ts` the same way, before their existing storage calls (depends on T004; contracts/protected-routes.md)
- [X] T008 [P] [US2] Guard `POST` in `frontend/app/api/upload/route.ts` the same way, before its existing storage calls (depends on T004; contracts/protected-routes.md)
- [X] T009 [P] [US2] Guard `GET` in `frontend/app/api/download-zip/route.ts` the same way, before its existing storage calls (depends on T004; contracts/protected-routes.md)
- [X] T010 [US2] Create `frontend/lib/editorFetch.ts`: a small `authedFetch(input, init?)` wrapper around `fetch` that, on receiving a `401` response, sets `window.location.href = "/oauth/login?continue=" + encodeURIComponent(window.location.pathname)` and otherwise returns the response unchanged (research.md §3, spec.md Edge Cases)
- [X] T011 [US2] Replace the direct `fetch(...)` calls (8 in `FileTree.tsx`, 2 in `FileEditor.tsx`) in `frontend/app/editor/FileTree.tsx` and `frontend/app/editor/FileEditor.tsx` with `authedFetch(...)` from T010, keeping every other argument and response-handling branch unchanged (depends on T010)
- [ ] T012 [US2] Execute quickstart.md §2 (unauthenticated API rejection) and §4 (session expiry mid-use); confirm SC-001, SC-004 (depends on T005, T006, T007, T008, T009, T011) — **not run**: per standing user instruction not to execute tests; needs manual verification

**Checkpoint**: User Stories 1 AND 2 both work independently — the editor page and every one of its data endpoints are now gated, and an expired session recovers gracefully (quickstart.md §1, §2, §4)

---

## Phase 3: User Story 3 - Signed-in owner moves freely between protected pages (Priority: P3)

**Goal**: Confirm that the single, already-shared owner session (the `oauth_owner_session` cookie is set with `path: "/"` since spec 008) covers `/editor` and `/settings/connected-apps` alike, in either sign-in order — no new code is required for this, since both pages now check the same `hasActiveOwnerSession()`.

**Independent Test**: Sign in from `/settings/connected-apps`, then navigate directly to `/editor` and confirm no further sign-in prompt; separately, sign in by first hitting `/editor`, then navigate to `/settings/connected-apps` and confirm the same (quickstart.md §3).

### Implementation for User Story 3

- [ ] T013 [US3] Execute quickstart.md §3 in both directions; confirm SC-003 and FR-005 (depends on T002 from User Story 1; no code changes expected — this validates that T002's reuse of `hasActiveOwnerSession()` and the existing global-path session cookie already produce this behavior) — **not run**: per standing user instruction not to execute tests; needs manual verification

**Checkpoint**: All three user stories independently functional (quickstart.md §1–§4)

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and a final end-to-end pass

- [X] T014 [P] Update the "Web File Explorer & Markdown Editor" section of root `README.md` to note that `/editor` now requires signing in with the same owner credential used for the MCP connector flow, linking to `specs/009-editor-login-gate/quickstart.md`
- [ ] T015 Run `specs/009-editor-login-gate/quickstart.md` end-to-end (all 4 sections), confirming every acceptance scenario and success criterion in spec.md passes (depends on T001–T013) — **not run**: per standing user instruction not to execute tests; needs manual verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately
- **User Story 2 (Phase 2)**: No dependency on User Story 1 (different files) — can start immediately, in parallel with Phase 1 if staffed
- **User Story 3 (Phase 3)**: Depends on User Story 1 (T002) being complete — its only task is validating behavior that T002 produces
- **Polish (Phase 4)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories
- **User Story 2 (P2)**: No dependencies on other stories (touches only `lib/oauth/session.ts` and the 5 API route files, plus the client fetch call sites — none of which User Story 1 changes)
- **User Story 3 (P3)**: Depends on User Story 1's page-level gate existing; otherwise there is nothing new to observe

### Within Each User Story

- T001 before T002 (T002 renders the component T001 creates)
- T004 before T005–T009 (each route guard calls the helper T004 adds)
- T010 before T011 (T011 uses the helper T010 creates)
- Each story's quickstart-execution task runs last, after that story's implementation tasks

### Parallel Opportunities

- User Story 1 and User Story 2 can be implemented in parallel by different people — they share no files
- Within User Story 2, T005, T006, T007, T008, T009 (the five route-guard tasks) can all run in parallel once T004 is done — five different files
- T014 (README) can run in parallel with any other Phase 4/late-story work

---

## Parallel Example: User Story 2

```bash
# After T004 (requireOwnerSession helper) is done, guard all five route files together:
Task: "Guard GET in frontend/app/api/tree/route.ts"
Task: "Guard POST and DELETE in frontend/app/api/directory/route.ts"
Task: "Guard GET, PUT, POST, and DELETE in frontend/app/api/file/route.ts"
Task: "Guard POST in frontend/app/api/upload/route.ts"
Task: "Guard GET in frontend/app/api/download-zip/route.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: User Story 1 (T001–T003)
2. **STOP and VALIDATE**: Run quickstart.md §1 — confirm the editor page itself is gated
3. Deploy/demo if ready — note this alone does not close the direct-API-access gap (User Story 2)

### Incremental Delivery

1. Add User Story 1 → validate (quickstart.md §1) → MVP demo-able (page-level gate live)
2. Add User Story 2 → validate (quickstart.md §2, §4) → the API-bypass gap is closed and session expiry recovers gracefully
3. Add User Story 3 → validate (quickstart.md §3) → confirms no regression in cross-page session convenience
4. Polish (T014, T015) → README updated, full quickstart re-run end-to-end

### Parallel Team Strategy

With two developers:

1. Developer A: User Story 1 (T001–T003)
2. Developer B: User Story 2 (T004–T012), in parallel — no shared files
3. Either developer: User Story 3 (T013) once User Story 1 lands
4. Either developer: Polish (T014, T015) once everything else lands

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test framework is introduced by this feature; verification is via the `quickstart.md` walkthrough
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
