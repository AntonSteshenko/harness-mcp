---

description: "Task list for Editor File Deep Linking via URL"
---

# Tasks: Editor File Deep Linking via URL

**Input**: Design documents from `/specs/018-editor-file-deep-link/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/editor-url-contract.md](contracts/editor-url-contract.md), [quickstart.md](quickstart.md)

**Tests**: No test tasks are included — spec.md did not request tests, this project has no automated test suite (specs 001–009 validate via `quickstart.md` instead), and per standing user instruction tests are not to be executed as part of this workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

Single Next.js project at `frontend/` (plan.md Structure Decision) — all paths below are relative to the repository root, inside `frontend/`.

No new dependencies are introduced (research.md). This revision supersedes an earlier query-parameter-based task list: the file path is now carried directly in the URL's own path (`/files/notes/todo.md`, FR-012), which requires renaming and restructuring the route itself, so the shared prerequisite in the Foundational phase is larger than a simple state refactor.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Move the editor's route to `/files` as an optional catch-all, and make the URL (its path, not a query string) the source of truth for the open file — everything else builds on this

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 Rename the route directory with `git mv frontend/app/editor frontend/app/files`; create `frontend/app/files/[[...path]]/` and move `page.tsx` into it (`git mv frontend/app/files/page.tsx "frontend/app/files/[[...path]]/page.tsx"`), so `EditorApp.tsx`/`FileTree.tsx`/`FileEditor.tsx`/etc. remain directly under `frontend/app/files/` as siblings, imported by the nested `page.tsx` via `../EditorApp` etc.; in `frontend/app/files/EditorApp.tsx`, import `usePathname`, `useRouter` from `next/navigation`, remove the old `useState`-based `selectedPath` and derive it as `const pathname = usePathname(); const selectedPath = pathname === "/files" ? null : pathname.slice("/files/".length);`; update `handleSelectFile` to call `router.push(`/files/${path.split("/").map(encodeURIComponent).join("/")}`)`; update `handleFileDeleted`/`handleFolderDeleted` to call `router.replace("/files")` when the deleted path matches the currently open one (research.md §1, §2, §3, data-model.md, FR-012)

**Checkpoint**: `EditorApp` compiles and behaves as before, just at `/files` instead of `/editor` and with the path in the URL's own path — no other user-visible change yet

---

## Phase 2: User Story 1 - Open a file directly via a shared link (Priority: P1) 🎯 MVP

**Goal**: Opening `/files/<file>` loads that file's content immediately, with its containing folders expanded in the tree — no manual navigation required — this still works if the visitor has to sign in first, and links to the previous `/editor` URL keep working.

**Independent Test**: Navigate to `/files/<a known file>` in a fresh, signed-in browser session and confirm the file's content displays immediately with its folder(s) expanded in the sidebar (quickstart.md §1); repeat while signed out and confirm sign-in redirects back to that same file afterward (quickstart.md §4); visit the old `/editor` URL and confirm it redirects to `/files` (quickstart.md §6).

### Implementation for User Story 1

- [X] T002 [P] [US1] Add an optional `expandToPath?: string | null` prop to `FileTree` in `frontend/app/files/FileTree.tsx`, threaded from the root call into `DirectoryNode` and recursively down to every child `DirectoryNode` it renders; a `DirectoryNode` defaults `expanded` to `true` when its own `path` is `""` (existing root rule) **or** is an ancestor of `expandToPath` (`expandToPath === path` or `expandToPath.startsWith(`${path}/`)`) (research.md §4, FR-003)
- [X] T003 [US1] In `frontend/app/files/EditorApp.tsx`, pass `expandToPath={selectedPath}` to the `<FileTree>` element so the file opened via the URL (T001) is auto-expanded down to (T002) (depends on T001, T002)
- [X] T004 [US1] Write `frontend/app/files/[[...path]]/page.tsx`: an async server component accepting `params: Promise<{ path?: string[] }>`; checks `hasActiveOwnerSession()` and, if absent, `redirect()`s to `` `/oauth/login?continue=${encodeURIComponent(`/files${path?.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`)}` `` (reading `path` from the awaited `params`); otherwise renders `<EditorApp osName={getOsName()} language={await resolveLanguage()} />` directly, with **no** `<Suspense>` wrapper needed (`usePathname()`, unlike `useSearchParams()`, doesn't require one — research.md §3) (research.md §6, FR-006, FR-001, FR-012) (depends on T001) — **superseded by T004a**: this logic was later moved from `page.tsx` into a sibling `layout.tsx` after a regression was found (see T004a)
- [X] T004a [US1] First attempt (superseded by T004b): move T004's logic from `page.tsx` into a `layout.tsx` still co-located inside `frontend/app/files/[[...path]]/` — this did **not** fix the regression it was meant to address (see T004b), because a layout co-located with the exact dynamic segment whose value changes doesn't get Next.js's cross-navigation persistence guarantee either
- [X] T004b [US1] Move `frontend/app/files/[[...path]]/layout.tsx` up to the stable `frontend/app/files/layout.tsx` (one level above the `[[...path]]` catch-all); since this segment has no `params.path`, read the current path from a new `x-pathname` request header (set by `frontend/middleware.ts`, T004c) via `headers()` instead, for the login-redirect target. `frontend/app/files/[[...path]]/page.tsx` stays trivial (`return null`). This is what actually fixes the regression confirmed via manual testing: `FileTree`'s per-folder expand/collapse state (and `EditorApp`'s own `isDirty`/`sidebarOpen` state) now survives navigation between different `/files/<path>` values, because the layout sits at a segment whose own value is stable across those navigations (research.md §7)
- [X] T004c [US1] In `frontend/middleware.ts`, set an `x-pathname` request header equal to `request.nextUrl.pathname` on every request, via `NextResponse.next({ request: { headers } })` (Next's documented pattern for exposing the current pathname to Server Components that lack a route param for it) — read by T004b (research.md §7)
- [X] T005 [US1] Create `frontend/app/editor/[[...path]]/page.tsx`: a redirect-only route — reads `params: Promise<{ path?: string[] }>`, calls `redirect(`/files${path?.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`)` — so every old `/editor` or `/editor/<path>` request lands on the equivalent `/files` URL (research.md §2, FR-013)
- [X] T006 [P] [US1] In `frontend/app/init/McpConnectManual.tsx`, change `<a href="/editor">{dict.goToEditor}</a>` to `<a href="/files">{dict.goToEditor}</a>`
- [X] T007 [US1] Update the `goToEditor` string's URL reference from `/editor` to `/files` in the canonical `frontend/lib/i18n/dictionaries/en.ts` (e.g. `"Go to /files"`)
- [X] T008 [P] [US1] Same update in `frontend/lib/i18n/dictionaries/it.ts` (depends on T007)
- [X] T009 [P] [US1] Same update in `frontend/lib/i18n/dictionaries/ru.ts` (depends on T007)
- [X] T010 [P] [US1] Same update in `frontend/lib/i18n/dictionaries/fr.ts` (depends on T007)
- [X] T011 [P] [US1] Same update in `frontend/lib/i18n/dictionaries/de.ts` (depends on T007)
- [X] T012 [P] [US1] Same update in `frontend/lib/i18n/dictionaries/es.ts` (depends on T007)
- [X] T013 [P] [US1] Update all `/editor` references to `/files` in `README.md` (repo root) — the auth description, the deployment note, the web-editor walkthrough section and its `http://localhost:3000/editor` example
- [X] T014 [US1] Execute quickstart.md §1, §4, and §6 against the local dev server; confirm SC-001, SC-002, SC-005 (depends on T001-T013) — **user-verified** (2026-07-29): opening a file from the tree at `/files` loads it correctly with folders expanded, confirming the core §1 behavior and the T004b/T004c fix. §4 (login-gate redirect target) and §6 (old `/editor` → `/files` redirect) were not separately spot-checked by the user; still low-risk given no code changed there since implementation, but flagging for awareness

**Checkpoint**: User Story 1 fully functional and independently testable — a shared link opens directly to the right file, through the login gate if needed, and old links still resolve

---

## Phase 3: User Story 2 - URL stays in sync while browsing files and folders (Priority: P2)

**Goal**: As the user selects different files or folders, the URL updates so browser back/forward moves between previously viewed files/folders, a refresh reopens the same one, and the current URL can be copied/shared at any time.

**Independent Test**: Click through two or three different files and folders in the tree, then use the browser back button and confirm each previously viewed one reappears in order; refresh the page and confirm the last one reopens (quickstart.md §2).

### Implementation for User Story 2

- [X] T015 [US2] `handleSelectFile` in `frontend/app/files/EditorApp.tsx` already navigates with `router.push` (T001), which is what makes back/forward step through previously opened files — no additional code change needed here (research.md §3, FR-004, FR-005)
- [X] T015a [US2] Add an `onSelectFolder?: (path: string) => void` prop to `FileTree` in `frontend/app/files/FileTree.tsx`, called from the folder row's existing click handler (`DirectoryNode`'s row `onClick`, alongside its existing `setExpanded` toggle — both happen on the same click) with that folder's `path`; in `frontend/app/files/EditorApp.tsx`, pass the same navigation logic used for `handleSelectFile` (dirty-check, then `router.push` to `/files/<path>`) as `onSelectFolder` too, so clicking a folder updates the URL exactly like clicking a file does (spec.md US2 Acceptance Scenario 4, FR-004) (depends on T001, T002)
- [X] T016 [US2] Execute quickstart.md §2 against the local dev server; confirm SC-004 (depends on T015, T015a) — **user-verified** (2026-07-29): confirmed file *and* folder clicks update the URL and the tree's expand/collapse state now survives navigation (this is what T004a → T004b/T004c fixed). Back/forward stepping and refresh-reopens-file were not separately spot-checked by the user; same low-risk/unverified caveat as T014

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 4: User Story 3 - Graceful handling of invalid or inaccessible links (Priority: P3)

**Goal**: A URL pointing at a missing file, a folder, or an unsupported file type shows a clear, specific message instead of a blank or generic-error screen.

**Independent Test**: Open `/files/<nonexistent>`, `/files/<a folder>`, and `/files/<a binary file>` in turn and confirm each shows a distinct, understandable message (quickstart.md §3).

### Implementation for User Story 3

- [X] T017 [US3] Add `openedPathIsFolder: (path: string) => string` to the `Dictionary["editor"]["file"]` interface in `frontend/lib/i18n/dictionaries/types.ts`, and its canonical English text in `frontend/lib/i18n/dictionaries/en.ts` (e.g. `` (path) => `"${path}" is a folder, not a file.` ``) (research.md §5, FR-008)
- [X] T018 [P] [US3] Add the same `openedPathIsFolder` key, translated, to `frontend/lib/i18n/dictionaries/it.ts` (depends on T017)
- [X] T019 [P] [US3] Add the same key, translated, to `frontend/lib/i18n/dictionaries/ru.ts` (depends on T017)
- [X] T020 [P] [US3] Add the same key, translated, to `frontend/lib/i18n/dictionaries/fr.ts` (depends on T017)
- [X] T021 [P] [US3] Add the same key, translated, to `frontend/lib/i18n/dictionaries/de.ts` (depends on T017)
- [X] T022 [P] [US3] Add the same key, translated, to `frontend/lib/i18n/dictionaries/es.ts` (depends on T017)
- [X] T023 [US3] In `frontend/app/files/FileEditor.tsx`'s file-loading effect, extend the `LoadState` union with a `{ status: "folder"; message: string }` variant; when `GET /api/file` responds not-ok with `data.code === "type_mismatch"`, set this new state (using `dict.openedPathIsFolder(path)`) instead of the generic `{ status: "error" }`; render it the same way the existing `"unsupported"` branch is rendered (research.md §5, FR-008) (depends on T017-T022)
- [ ] T024 [US3] Execute quickstart.md §3 against the local dev server; confirm SC-003 (depends on T023) — **not run**: per standing instruction not to execute tests; needs manual verification

**Checkpoint**: All three user stories independently functional

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final safety validation spanning all stories

- [ ] T025 Execute quickstart.md §5 (path traversal / malformed path safety) against the local dev server; confirm a nonexistent/malformed path behaves exactly like any other not-found path, with no server error (depends on T001-T024) — **not run**: per standing instruction not to execute tests; needs manual verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 2)**: Depends on Foundational (T001) completion
- **User Story 2 (Phase 3)**: Depends on Foundational (T001) completion only — already delivered by T001, this phase is validation-only
- **User Story 3 (Phase 4)**: Depends on Foundational (T001) completion only — fully independent of US1/US2's files
- **Polish (Phase 5)**: Depends on all three user stories being complete

### Within Each User Story

- US1: T002 (FileTree) / T004 (new page.tsx) / T005 (redirect route) / T006 (McpConnectManual) / T007 (dict en) / T013 (README) can start in parallel once T001 is done → T003 (needs T001 + T002) → T008-T012 (parallel, need T007) → T014 (validation, needs everything else in the phase)
- US2: T015 (no-op, already done by T001) → T016 (validation)
- US3: T017 (canonical dictionary key) → T018-T022 (parallel translations) → T023 (needs all dictionaries) → T024 (validation)

### Parallel Opportunities

- T002, T004, T005, T006, T007, T013 (US1) can all start in parallel once T001 lands — six different files/concerns, no dependency on each other (T003 and T008-T012 wait on T002/T007 respectively)
- T018, T019, T020, T021, T022 (US3 translations) can run in parallel once T017 is done
- Once Foundational (T001) is done, US1 and US3 could be staffed in parallel — they touch disjoint files (US1: routing/redirect/copy; US3: dictionaries + `FileEditor.tsx`)

---

## Parallel Example: User Story 1

```bash
# After T001 (Foundational) is done, launch these together:
Task: "Add expandToPath prop and ancestor auto-expand to frontend/app/files/FileTree.tsx"
Task: "Write the new frontend/app/files/[[...path]]/page.tsx"
Task: "Create the redirect-only frontend/app/editor/[[...path]]/page.tsx"
Task: "Update the /editor link in frontend/app/init/McpConnectManual.tsx"
Task: "Update the goToEditor string in frontend/lib/i18n/dictionaries/en.ts"
Task: "Update /editor references to /files in README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001)
2. Complete Phase 2: User Story 1 (T002-T014)
3. **STOP and VALIDATE**: quickstart.md §1, §4, §6
4. Deploy/demo if ready — a shared link already opens the right file at this point, and old bookmarks still work

### Incremental Delivery

1. Foundational (T001) → route renamed to `/files`, URL-driven state ready
2. Add User Story 1 (T002-T014) → test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (T015-T016) → test independently → Deploy/Demo (back/forward, refresh)
4. Add User Story 3 (T017-T024) → test independently → Deploy/Demo (friendly error states)
5. Polish (T025) → final safety check

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task
- [Story] label maps task to specific user story for traceability
- No automated tests exist in this project and none are added here; `quickstart.md` is the verification mechanism, and per standing instruction its steps are documented as manual/"not run" rather than executed
- This revision replaces the earlier query-parameter-based task list (T001-T017 in a prior version of this file) after the URL shape was changed to a path segment and the route renamed from `/editor` to `/files`, per explicit decision — the prior implementation was discarded and rebuilt against this file
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently

## Feature Status: Closed (2026-07-29)

All implementation tasks (T001-T023, excluding the pure-validation T024/T025) are complete; `npx tsc --noEmit` passes clean. The user manually verified the core behavior end-to-end in the browser at `/files` (T014, T016) — including the regression this session found and fixed (T004a → T004b/T004c: `FileTree`'s expand/collapse state resetting on every file/folder click). Not separately spot-checked: quickstart.md §3 (folder/missing/unsupported-file messages, T024), §4/§6 (login-gate and old-`/editor`-redirect targets, part of T014), and §5 (path-traversal safety, T025) — none of these had code paths touched after the parts that *were* verified, so risk is low, but they remain formally unverified rather than confirmed.
