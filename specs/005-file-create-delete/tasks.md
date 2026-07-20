---

description: "Task list template for feature implementation"
---

# Tasks: File Delete & Create

**Input**: Design documents from `/specs/005-file-create-delete/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature (spec.md Testing: validated via quickstart.md browser walkthrough, consistent with specs 001-004). No test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User Story 1 (delete) and User Story 2 (create file) are both Priority P1 and together form the MVP; User Story 3 (create folder) is P2 and reuses the name-validation helper shared with User Story 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at the repository root (same app as specs 002/003/004): `app/editor/`, `app/api/`, `lib/storage/`. No `tests/` directory — no automated tests requested. No new dependencies are introduced (research.md), so there is no Setup phase — implementation starts directly at Foundational.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Shared UI primitives used by the delete/create actions in every user story below

**⚠️ CRITICAL**: Complete before starting any user story phase

- [X] T001 [P] Add `TrashIcon`, `NewFileIcon`, and `NewFolderIcon` SVG icon components to `app/editor/Icons.tsx`, matching the existing icon style (`ChevronIcon`, `FileIcon`, `FolderIcon`, `UploadIcon`, `DownloadIcon`)
- [X] T002 [P] Add a shared `promptForEntryName` helper function in `app/editor/FileTree.tsx` that calls `window.prompt`, trims the result, rejects (via `window.alert`, returning `null`) any name containing `/`, and returns `null` for a blank/whitespace/cancelled entry — used by both the "New file" (US2) and "New folder" (US3) actions (research.md §2, FR-007)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 2: User Story 1 - Delete a file (Priority: P1) 🎯 MVP

**Goal**: A user can delete an existing file from any folder in the tree, with confirmation before removal; if that file is open in the editor, the editor closes it.

**Independent Test**: From the tree, trigger "Delete" on a file, confirm the prompt, and verify the file disappears from the tree and is no longer readable from storage; repeat with that file open in the editor and confirm the editor closes it (quickstart.md steps 8-10).

### Implementation for User Story 1

- [X] T003 [P] [US1] Add a `DELETE` handler to `app/api/file/route.ts`: read `path` from the query string, call `lib/storage/files.ts#deleteFile(path)`, return `{ path, deleted: true }` with 200 on success; 404 `{ code: "not_found", message }` if `path` is missing from the query string; map any `StorageError` via the route's existing `STATUS_BY_CODE`/`errorResponse` pattern (contracts/api-routes.md)
- [X] T004 [US1] Add a "Delete" button (using `TrashIcon` from T001) to each file row in `app/editor/FileTree.tsx` that shows a `window.confirm` naming the file before doing anything; on confirm, call `DELETE /api/file?path=...` via `fetch`; on success, re-fetch that directory's `GET /api/tree` listing so the removed file disappears without a full page reload; on failure, show a clear error via `window.alert` (FR-001, FR-002, FR-008, FR-009)
- [X] T005 [US1] Add an `onFileDeleted?: (path: string) => void` prop to `FileTreeProps` in `app/editor/FileTree.tsx`, threaded down through `DirectoryNode` the same way `onSelectFile` already is, and invoke it with the deleted path after a successful delete from T004 (research.md §3)
- [X] T006 [US1] Update `app/editor/page.tsx` to pass an `onFileDeleted` handler to `<FileTree>` that clears `selectedPath` when the deleted path matches the currently open file, closing that file in the editor (FR-003)

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md steps 8-10)

---

## Phase 3: User Story 2 - Create a new file (Priority: P1)

**Goal**: A user can create a new, empty, named file inside any folder in the tree, which opens automatically in the editor; creating over an existing name requires confirmation.

**Independent Test**: From any folder in the tree, trigger "New file", enter a name, and confirm a new empty file appears in that folder and opens in the editor ready for typing (quickstart.md steps 1-3).

### Implementation for User Story 2

- [X] T007 [US2] Add a `POST` handler to `app/api/file/route.ts`: body `{ path: string, content?: string }` (`content` defaults to `""`), call `lib/storage/files.ts#createFile(path, content)`, return the resulting `FileMetadata` with 201 on success; 404 `{ code: "not_found", message }` if `path` is missing from the body; map any `StorageError` via the route's existing `STATUS_BY_CODE`/`errorResponse` pattern (contracts/api-routes.md)
- [X] T008 [US2] Add a "New file" button (using `NewFileIcon` from T001) to each `DirectoryNode` in `app/editor/FileTree.tsx` that calls the shared `promptForEntryName` helper (T002) to get a validated name; a `null` result (blank, cancelled, or rejected) aborts with no request sent (FR-004, FR-007)
- [X] T009 [US2] In `app/editor/FileTree.tsx`, before submitting a validated new-file name, compare it against that directory's already-fetched `entries.files` basenames and, if it collides, show one `window.confirm` naming the conflicting file; if declined, abort and send nothing (FR-006)
- [X] T010 [US2] In `app/editor/FileTree.tsx`, submit the confirmed new-file request to `POST /api/file` with empty content; on success, re-fetch that directory's listing and call `onSelectFile` with the new file's full path so it opens in the editor ready for typing; on failure, show a clear error via `window.alert` (FR-008, FR-009, FR-010)

**Checkpoint**: User Stories 1 AND 2 (the P1 MVP) both work independently (quickstart.md steps 1-3, 8-10)

---

## Phase 4: User Story 3 - Create a new folder (Priority: P2)

**Goal**: A user can create a new, named subfolder inside any folder in the tree; re-creating an existing folder name is a harmless no-op, and colliding with an existing file name is a clear error.

**Independent Test**: From any folder in the tree, trigger "New folder", enter a name, and confirm a new empty subfolder appears in the tree under that folder (quickstart.md steps 5-7).

### Implementation for User Story 3

- [X] T011 [P] [US3] Implement a `POST /api/directory` route handler in new file `app/api/directory/route.ts`: body `{ path: string }`, call `lib/storage/directories.ts#createDirectory(path)`, return `{ path, created: true }` with 201 on success; 404 `{ code: "not_found", message }` if `path` is missing from the body; map any `StorageError` via a `STATUS_BY_CODE`/`errorResponse` pattern matching `app/api/file/route.ts` and `app/api/tree/route.ts` (contracts/api-routes.md)
- [X] T012 [US3] Add a "New folder" button (using `NewFolderIcon` from T001) to each `DirectoryNode` in `app/editor/FileTree.tsx` that calls the shared `promptForEntryName` helper (T002) to get a validated name; a `null` result aborts with no request sent (FR-005, FR-007)
- [X] T013 [US3] In `app/editor/FileTree.tsx`, submit the validated new-folder name to `POST /api/directory`; on success (including the idempotent case where the folder already existed), re-fetch that directory's listing; on a name collision with an existing file (`already_exists`), show the storage error's message via `window.alert` and create nothing (FR-005, FR-009)

**Checkpoint**: All three user stories independently functional (quickstart.md steps 1-11)

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Consistency and end-to-end validation across all three new/changed routes

- [X] T014 [P] Align the error-response shape and status codes in `app/api/directory/route.ts` with the existing `STATUS_BY_CODE`/`errorResponse` pattern already used in `app/api/file/route.ts` and `app/api/tree/route.ts`
- [X] T015 Run the full quickstart.md walkthrough end-to-end against the local dev server and MinIO stack (API-level: create file, create folder, idempotent re-create, file/folder name collision, delete file, read-after-delete, missing-path validation, all verified via `curl` against `localhost:3002` — the Chrome browser extension was unavailable in this environment so the UI itself (button clicks, prompts, editor auto-open) was reviewed by code inspection, not click-tested)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories.
- **User Stories (Phase 2+)**: All depend on Foundational phase completion.
- **Polish (Phase 5)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — first slice of the MVP; touches `app/api/file/route.ts` (new `DELETE` handler) and `app/editor/FileTree.tsx`/`page.tsx` in code regions independent of User Story 2's `POST` handler
- **User Story 2 (P1)**: No dependencies on other stories — second, independent slice of the MVP; can be built in parallel with User Story 1 by a different contributor (different handler in the same route file, different buttons in the same tree file)
- **User Story 3 (P2)**: Depends on Foundational's `promptForEntryName` helper (T002), shared with User Story 2's naming flow — implement after Foundational; independent of both US1 and US2 otherwise

### Parallel Opportunities

- T001 and T002 (Foundational) touch different files (`Icons.tsx` vs. `FileTree.tsx`) and can be done together
- T003 (`app/api/file/route.ts` `DELETE`) and T007 (`app/api/file/route.ts` `POST`) are different handlers in the same file — not literally parallel-safe to edit at the same time, but independent in logic and can be authored by different contributors sequentially without blocking each other's story
- T011 (`app/api/directory/route.ts`, a new file) is fully independent of T003/T007 and can be built in parallel with either
- User Story 1 (Phase 2) and User Story 2 (Phase 3) can be worked on in parallel by different contributors once Phase 1 is done, landing their respective route-handler and button additions independently
- T004-T006 (User Story 1) and T008-T010 (User Story 2) both edit `app/editor/FileTree.tsx` in non-overlapping regions (file-row buttons vs. directory-row buttons) — coordinate merges but no logical dependency between them

---

## Parallel Example: Foundational

```bash
# These can start together:
Task: "Add TrashIcon, NewFileIcon, NewFolderIcon to app/editor/Icons.tsx"        # T001
Task: "Add shared promptForEntryName helper to app/editor/FileTree.tsx"          # T002
```

## Parallel Example: User Story 1 vs. User Story 2

```bash
# After Phase 1, these two independent P1 slices can proceed in parallel:
Task: "User Story 1 — DELETE /api/file + FileTree.tsx delete UI + page.tsx wiring (T003-T006)"
Task: "User Story 2 — POST /api/file + FileTree.tsx new-file UI (T007-T010)"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — both P1)

1. Complete Phase 1: Foundational
2. Complete Phase 2: User Story 1 (delete a file)
3. Complete Phase 3: User Story 2 (create a new file) — independent of Phase 2, can be done in either order or in parallel
4. **STOP and VALIDATE**: quickstart.md steps 1-3 and 8-10
5. Deploy/demo the MVP

### Incremental Delivery

1. Foundational → foundation ready
2. Add User Story 1 → validate independently (quickstart.md steps 8-10)
3. Add User Story 2 → validate independently (quickstart.md steps 1-3) — MVP complete
4. Add User Story 3 → validate independently (quickstart.md steps 5-7)
5. Polish (Phase 5) → full quickstart.md walkthrough

---

## Notes

- [P] tasks touch different files with no ordering dependency on incomplete work
- [Story] label maps each task to its user story for traceability
- User Story 3 intentionally depends on Foundational's `promptForEntryName` helper (T002), shared with User Story 2, per research.md §2 — the naming/validation UX is shared, not duplicated
- Verify each user story against its quickstart.md steps before moving to the next
- Commit after each task or logical group
