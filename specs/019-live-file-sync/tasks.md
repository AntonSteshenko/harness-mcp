---

description: "Task list for Live File Sync in the Files Interface"
---

# Tasks: Live File Sync in the Files Interface

**Input**: Design documents from `/specs/019-live-file-sync/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/file-sync-contract.md](contracts/file-sync-contract.md), [quickstart.md](quickstart.md)

**Tests**: No automated test tasks are included — spec.md did not request tests, this project has no automated test suite (specs 001–018 validate via `quickstart.md` instead), and per standing user instruction tests are not to be executed as part of this workflow. Each user story ends with a task to manually run its `quickstart.md` scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

Single Next.js project at `frontend/` (plan.md Structure Decision) — all paths below are relative to the repository root, inside `frontend/`.

---

## Phase 1: Setup

- [X] T001 [P] Add `swr` (2.x) as a runtime dependency in `frontend/package.json` and run `npm install` in `frontend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Give every SWR hook in the files app one shared polling/caching config, sitting at a stable position in the route tree so the cache survives navigation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 In `frontend/app/files/layout.tsx`, wrap the existing rendered children in `<SWRConfig value={{ refreshInterval: 15000, revalidateOnFocus: true }}>` (research.md §1, §5). This file is the stable segment established by spec 018 (sits above `[[...path]]`), so the SWR cache and poll timers are not reset when navigating between different open files/folders (depends on T001)

**Checkpoint**: `SWRConfig` is in place; no visible behavior change yet since no component uses `useSWR` yet

---

## Phase 3: User Story 1 - See externally-added or externally-changed files without reloading (Priority: P1) 🎯 MVP

**Goal**: An expanded folder in the files tree reflects additions/removals/metadata changes made outside the browser tab, in the background, without disturbing scroll position, open menus, or other expanded folders — and stops polling while the tab is hidden.

**Independent Test**: Expand a folder, change its contents from a second tab or the MCP tools, and confirm the change appears within the refresh window with no reload (quickstart.md §1); confirm no `/api/tree` requests fire while the tab is hidden, and one fires promptly on refocus (quickstart.md §2).

### Implementation for User Story 1

- [X] T003 [US1] In `frontend/app/files/FileTree.tsx`, replace `DirectoryNode`'s manual `useEffect`+`useState(entries)` fetch with `useSWR(expanded ? \`/api/tree?path=${encodeURIComponent(path)}\` : null, fetcher)`, where `fetcher` wraps the existing `authedFetch` + `res.json()` + not-ok-throws pattern already used inline today (research.md §1) (depends on T002)
- [X] T004 [US1] In `frontend/app/files/FileTree.tsx`, replace `refreshEntries()`'s manual `authedFetch`+`setEntries` body with a call to SWR's `mutate()` for the same key, keeping the function's name and every existing call site (after upload, create file, create folder, delete file, delete folder) unchanged (research.md §1, FR-009) (depends on T003)
- [X] T005 [US1] In `frontend/app/files/FileTree.tsx`, use SWR's `isLoading` (true only when there's no data yet) rather than `isValidating` to drive the existing `{loading && <div>{dict.loading}</div>}` row, so a background revalidation tick never re-shows the loading indicator (FR-003) (depends on T003)
- [ ] T006 [US1] Execute quickstart.md §1 and §2 against the local dev server (background tree update from a second tab/MCP call while a folder is expanded; polling pauses while the tab is hidden and catches up on refocus); confirm SC-001 and SC-004 (depends on T003, T004, T005) — **not run**: per standing instruction not to execute tests; needs manual verification in the browser

**Checkpoint**: User Story 1 fully functional and independently testable — the tree stays live without a reload, and pauses while backgrounded

---

## Phase 4: User Story 2 - Safely notice when the open file changed elsewhere, without losing unsaved edits (Priority: P1)

**Goal**: The open file's content quietly refreshes when the user has no unsaved edits; when they do, their edits are never overwritten and a non-blocking notice offers an explicit choice.

**Independent Test**: Open a file with no unsaved edits, change it externally, and confirm the content updates silently (quickstart.md §3); open a file, make an unsaved edit, change it externally, and confirm a non-blocking banner appears instead of the edit being overwritten, with working "reload"/"keep mine" actions and correct re-arming/save behavior (quickstart.md §4).

### Implementation for User Story 2

- [X] T007 [US2] In `frontend/lib/storage/files.ts`, add `etag: string` to the `FileMetadata` interface and populate it from S3's `ETag` response field in `readFile()`, `createFile()`, and `updateFile()` (data-model.md, research.md §3)
- [X] T008 [US2] In `frontend/lib/storage/files.ts`, add `getFileMetadata(path: string): Promise<FileMetadata>` using `HeadObjectCommand` (mirroring the existing `headObjectExists` helper in `frontend/lib/storage/paths.ts`), throwing the same `not_found`/`type_mismatch` errors as `readFile()` on a missing/wrong-type path (research.md §2) (depends on T007)
- [X] T009 [US2] In `frontend/app/api/file/route.ts`, add an exported `HEAD` handler: call `requireOwnerSession()`, then `getFileMetadata(path)`, and on success return a `200` response with `ETag` and `Last-Modified` headers set and no body; on failure, return the same status codes as `GET` (404 for `not_found`/`type_mismatch`, 502 for `storage_unreachable`) with no body (contracts/file-sync-contract.md) (depends on T008)
- [X] T010 [US2] In `frontend/app/api/file/route.ts`, include the new `etag` field in the `GET` handler's success JSON response (contracts/file-sync-contract.md) (depends on T007)
- [X] T011 [US2] In `frontend/app/api/file/route.ts`, include the new `etag` field in the `PUT` handler's success JSON response (data-model.md Save transition) (depends on T007)
- [X] T012 [P] [US2] Create `frontend/app/files/ExternalChangeBanner.tsx`: a small presentational component taking `onReload: () => void` and `onKeepMine: () => void` props, rendering a non-blocking notice ("This file changed externally") with two buttons, styled consistently with the existing inline-style conventions in `FileEditor.tsx`
- [X] T013 [US2] In `frontend/app/files/FileEditor.tsx`, extend the `EditorSession` interface with `loadedEtag: string` and `externalChange: { etag: string; dismissed: boolean } | null`; set `loadedEtag` from the `GET /api/file` response's new `etag` field wherever a session is created (data-model.md) (depends on T010)
- [X] T014 [US2] In `frontend/app/files/FileEditor.tsx`, replace the file-loading `useEffect`'s manual `authedFetch` call with `useSWR(path ? \`/api/file?path=${encodeURIComponent(path)}\` : null, fetcher)`, mapping its result into the existing `LoadState` union exactly as the current effect does (unsupported/folder/error/ready) (depends on T013)
- [X] T015 [US2] In `frontend/app/files/FileEditor.tsx`, add a second `useSWR(path ? ["file-etag", path] : null, headFetcher)` hook whose `headFetcher` issues `authedFetch(\`/api/file?path=...\`, { method: "HEAD" })` and returns the `ETag` response header (contracts/file-sync-contract.md) (depends on T009, T014)
- [X] T016 [US2] In `frontend/app/files/FileEditor.tsx`, add a `useEffect` comparing the polled etag (T015) against `session.loadedEtag`: if they differ and `!dirty`, call `mutate()` on the T014 content key to silently refetch and adopt the new content, updating `loadedContent`/`currentContent`/`loadedEtag`; if they differ and `dirty`, set `externalChange: { etag, dismissed: false }` (data-model.md state transitions, FR-004, FR-005) (depends on T015)
- [X] T017 [US2] In `frontend/app/files/FileEditor.tsx`, render `<ExternalChangeBanner>` (T012) when `session.externalChange && !session.externalChange.dismissed`; wire `onReload` to adopt the fetched content and clear `externalChange` (updating `loadedEtag`), and `onKeepMine` to set `externalChange.dismissed = true` without touching `currentContent` (data-model.md) (depends on T016, T012)
- [X] T018 [US2] In `frontend/app/files/FileEditor.tsx`'s `handleSave` success path, update `loadedEtag` from the `PUT` response's new `etag` field (T011) and clear any pending `externalChange` (data-model.md Save transition, spec.md US2 Acceptance Scenario 4) (depends on T011, T017)
- [ ] T019 [US2] Execute quickstart.md §3 and §4 against the local dev server (silent update when not dirty; conflict banner when dirty, including reload/keep-mine, re-arming on a further change, and save resolving the conflict); confirm SC-002 (depends on T007-T018) — **not run**: per standing instruction not to execute tests; needs manual verification in the browser

**Checkpoint**: User Stories 1 AND 2 both work independently — the tree stays live, and the open file never loses unsaved work

---

## Phase 5: User Story 3 - Snappier navigation via cached data (Priority: P3)

**Goal**: Re-visiting a previously-loaded folder or file within the same session shows it instantly from cache while a background revalidation confirms or updates it.

**Independent Test**: Expand a folder, collapse and re-expand it, and confirm no loading indicator appears; open a file, switch away, and re-open it, confirming instant content (quickstart.md §5).

### Implementation for User Story 3

- [X] T020 [US3] Confirm `SWRConfig` (T002) remains at the stable `frontend/app/files/layout.tsx` position (not moved inside `[[...path]]`) so its cache is shared across every `DirectoryNode`/`FileEditor` mount for the life of the session, per spec 018 research.md §7's finding about layout placement and navigation persistence (depends on T002, T003, T014) — confirmed: `frontend/app/files/layout.tsx` exists as a sibling of, not nested inside, `frontend/app/files/[[...path]]/`
- [ ] T021 [US3] Execute quickstart.md §5 against the local dev server (instant re-expand of a folder, instant re-open of a file); confirm SC-003 (depends on T020) — **not run**: per standing instruction not to execute tests; needs manual verification in the browser

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final safety/quality validation spanning all stories

- [ ] T022 [P] Execute quickstart.md §6 against the local dev server (a single blocked/failed background poll produces no visible error, last-known-good data stays displayed); confirm SC-005 (depends on T006, T019, T021) — **not run**: per standing instruction not to execute tests; needs manual verification in the browser
- [X] T023 Run `npx tsc --noEmit` in `frontend/` to confirm no type errors across all files touched by T002-T018 (depends on T002-T018) — passes clean

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T002) only
- **User Story 2 (Phase 4)**: Depends on Foundational (T002) only — independent of US1's files (`FileTree.tsx` vs. `files.ts`/`route.ts`/`FileEditor.tsx`)
- **User Story 3 (Phase 5)**: Depends on US1 (T003) and US2 (T014) already using `useSWR`, plus Foundational (T002) — this story validates an emergent property of the SWR migration rather than adding new fetch logic
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- US1: T003 → T004 and T005 (both build on the same `useSWR` call from T003) → T006 (validation, needs all three)
- US2: T007 → T008 → T009 and T010 and T011 (all touch `route.ts`/depend on T007-T008) → T013 (depends on T010) → T014 (depends on T013) → T015 (depends on T009, T014) → T016 (depends on T015) → T017 (depends on T016, and T012 which can run anytime in parallel) → T018 (depends on T011, T017) → T019 (validation, needs everything else in the phase)
- US3: T020 (placement check, depends on T002/T003/T014 already being done) → T021 (validation)

### Parallel Opportunities

- T001 (Setup) has no dependencies and can start immediately
- T012 (`ExternalChangeBanner.tsx`, US2) touches a brand-new file with no dependency on the rest of US2's chain — can be built any time in parallel with T007-T011 and T013-T016
- Once Foundational (T002) is done, US1 (Phase 3) and US2's storage/route layer (T007-T011) can be staffed in parallel — disjoint files (`FileTree.tsx` vs. `files.ts`/`route.ts`)

---

## Parallel Example: User Story 2

```bash
# After Foundational (T002) is done, launch these together:
Task: "Add etag to FileMetadata and populate it in readFile/createFile/updateFile in frontend/lib/storage/files.ts"
Task: "Create frontend/app/files/ExternalChangeBanner.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003-T006)
4. **STOP and VALIDATE**: quickstart.md §1, §2
5. Deploy/demo if ready — the tree already stays live without a reload at this point

### Incremental Delivery

1. Setup + Foundational (T001-T002) → SWR wired up, no visible change yet
2. Add User Story 1 (T003-T006) → test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (T007-T019) → test independently → Deploy/Demo (safe open-file sync)
4. Add User Story 3 (T020-T021) → test independently → Deploy/Demo (instant cached re-visits)
5. Polish (T022-T023) → final safety/type check

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task
- [Story] label maps task to specific user story for traceability
- No automated tests exist in this project and none are added here; `quickstart.md` is the verification mechanism, and per standing instruction its steps are documented as manual — the agent does not execute them
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently

## Implementation Status (2026-07-29)

All code tasks (T001-T005, T007-T018, T020) are complete; `npx tsc --noEmit` passes clean (T023). Not run by the agent, per standing instruction — need manual verification in the browser: T006 (US1: background tree refresh, hidden-tab pause), T019 (US2: silent update, conflict banner reload/keep-mine/re-arm/save), T021 (US3: instant cached re-visit), T022 (a single failed poll stays invisible). None of these have any remaining code dependency — every implementation task they depend on is done.
