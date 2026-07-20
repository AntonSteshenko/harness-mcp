---

description: "Task list template for feature implementation"
---

# Tasks: Markdown Upload & Folder Download

**Input**: Design documents from `/specs/004-markdown-upload-download/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature (spec.md Testing: validated via quickstart.md browser walkthrough, consistent with specs 001–003). No test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User Story 1 and User Story 3 are both Priority P1 and together form the MVP; User Story 2 (P2) extends User Story 1's upload mechanism.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at the repository root (same app as specs 002/003): `app/editor/`, `app/api/`, `lib/storage/`. No `tests/` directory — no automated tests requested.

---

## Phase 1: Setup

**Purpose**: Project dependency needed by this feature

- [X] T001 Add `jszip` as a project dependency (`npm install jszip`), updating `package.json`/`package-lock.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared UI primitives used by the upload/download buttons in every user story below

**⚠️ CRITICAL**: Complete before starting any user story phase

- [X] T002 Add `UploadIcon` and `DownloadIcon` SVG icon components to `app/editor/Icons.tsx`, matching the existing icon style (`ChevronIcon`, `FileIcon`, `FolderIcon`)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Upload one or more Markdown files (Priority: P1) 🎯 MVP

**Goal**: A user can select one or more local `.md` files and add them to a chosen folder in the tree, with non-`.md` files skipped and reported, and confirmation before overwriting an existing file.

**Independent Test**: From a folder in the tree, trigger "Upload files", pick one or more local `.md` files (optionally mixed with a non-`.md` file), and confirm the `.md` file(s) appear in the tree with original content while non-`.md` files are reported as skipped (quickstart.md steps 1–3).

### Implementation for User Story 1

- [X] T003 [P] [US1] Implement `POST /api/upload` route handler in `app/api/upload/route.ts`: parse `{ basePath: string, files: Array<{ relativePath: string; content: string }> }`; for each entry, skip (do not store) any `relativePath` not ending in `.md` (case-insensitive); otherwise join `basePath` + `relativePath`, normalize via `lib/storage/paths.ts#normalizeFilePath`, and call `lib/storage/files.ts#createFile(path, content)`; collect one `{ path, status: "uploaded"|"skipped"|"failed", message? }` per submitted entry and return `{ results }` with 200; return 400 `{ code: "invalid_request", message }` only if `basePath`/`files` are missing or malformed (contracts/api-routes.md)
- [X] T004 [US1] Add an "Upload files" button and a hidden `<input type="file" accept=".md" multiple>` to each `DirectoryNode` in `app/editor/FileTree.tsx`; on selection, read each file's text via `File.text()`, filter to `.md` only (case-insensitive extension check), and track the skipped count for files excluded this way (research.md §3, §7; data-model.md Upload Batch)
- [X] T005 [US1] In `app/editor/FileTree.tsx`, before submitting the filtered batch, compare its filenames against the target `DirectoryNode`'s already-fetched `entries.files` and, if any collide, show one `window.confirm` naming the conflicting file(s); if declined, abort and send nothing (research.md §5, FR-006)
- [X] T006 [US1] In `app/editor/FileTree.tsx`, submit the confirmed batch to `POST /api/upload` via `fetch`; on success, show a summary of how many files were uploaded vs. skipped (with skip reasons) and re-fetch that directory's `GET /api/tree` listing so new files appear without a full page reload (FR-005); on a network/storage failure, show a clear error and leave the folder's listing unchanged (FR-010)

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md steps 1–3)

---

## Phase 4: User Story 3 - Download an entire folder as a zip (Priority: P1)

**Goal**: A user can download an entire folder (including nested subfolders) of `.md` files from the tree as a single zip archive, with a clear message instead of a file when there's nothing to download.

**Independent Test**: From any folder in the tree containing `.md` files in nested subfolders, trigger "Download folder" and confirm a single zip downloads locally with the same structure and content; on an empty folder, confirm no file is saved and a message is shown instead (quickstart.md steps 6–7).

### Implementation for User Story 3

- [X] T007 [P] [US3] Add `listFilesRecursive(path: string)` to `lib/storage/directories.ts`: breadth-first walk using the existing `listDirectory` per subdirectory discovered, returning every file whose path ends in `.md` (case-insensitive) anywhere under `path` (research.md §2, data-model.md Folder Download)
- [X] T008 [US3] Implement `GET /api/download-zip` route handler in `app/api/download-zip/route.ts`: read `path` from query params, call `listFilesRecursive`, read each result's content via `lib/storage/files.ts#readFile`, build an in-memory zip with `jszip` preserving each file's path relative to `path` as its archive entry name, and return it with `Content-Type: application/zip` and `Content-Disposition: attachment; filename="<folder-name-or-root>.zip"`; return `404 { code: "not_found" }` if `path` doesn't exist, `404 { code: "empty" }` if it has no `.md` files anywhere in its subtree, `502 { code: "storage_unreachable" }` on backend failure (research.md §1, §6; contracts/api-routes.md; FR-007, FR-008, FR-009)
- [X] T009 [US3] Add a "Download folder" button to each `DirectoryNode` in `app/editor/FileTree.tsx` that calls `fetch` on `GET /api/download-zip?path=...`; on a 200 response, read the body as a `Blob`, create an object URL, click a temporary `<a download="...">`, then revoke the URL; on a non-2xx response (`empty`, `not_found`, or `storage_unreachable`), show the corresponding message and save nothing (research.md §6; FR-009, FR-010; SC-005)

**Checkpoint**: User Stories 1 AND 3 (the P1 MVP) both work independently (quickstart.md steps 1–3, 6–8)

---

## Phase 5: User Story 2 - Upload a folder of Markdown files (Priority: P2)

**Goal**: A user can pick an entire local folder (with nested subfolders) of `.md` files and have the same structure recreated in the tree, reusing User Story 1's upload mechanism.

**Independent Test**: From a folder in the tree, trigger "Upload folder", pick a local folder with `.md` files across nested subfolders (plus a non-`.md` file), and confirm the same subfolder structure appears with only the `.md` files and correct content, with a skip count matching the non-`.md` file (quickstart.md steps 4–5).

### Implementation for User Story 2

- [X] T010 [US2] Add an "Upload folder" button and a hidden `<input type="file" webkitdirectory multiple>` to each `DirectoryNode` in `app/editor/FileTree.tsx`, alongside the "Upload files" button from T004 (research.md §4)
- [X] T011 [US2] Extend the batch builder from T004 so that, when triggered from the folder picker, each file's `relativePath` is derived from `file.webkitRelativePath` (preserving nested subfolder structure) instead of just its filename; reuse the existing `.md` filtering, overwrite-conflict confirmation (T005), submission, summary, and error-handling (T006) logic unchanged (FR-002)
- [X] T012 [US2] In `app/editor/FileTree.tsx`, when a folder pick yields zero `.md` files anywhere in its structure, show a "nothing to upload" message directly and skip calling `POST /api/upload` (Edge Cases; User Story 2 Acceptance Scenario 3)

**Checkpoint**: All three user stories independently functional (quickstart.md steps 1–8)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistency and end-to-end validation across both new routes

- [X] T013 [P] Align the error-response shape and status codes in `app/api/upload/route.ts` and `app/api/download-zip/route.ts` with the existing `STATUS_BY_CODE`/`errorResponse` pattern already used in `app/api/file/route.ts` and `app/api/tree/route.ts`
- [X] T014 Run the full quickstart.md walkthrough (all 8 scenarios) end-to-end against the local dev server and MinIO stack

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3, P1)**: Depends on Foundational only
- **User Story 3 (Phase 4, P1)**: Depends on Foundational only — independent of User Story 1
- **User Story 2 (Phase 5, P2)**: Depends on Foundational and reuses User Story 1's client-side batch/conflict/submit logic (T004–T006) — implement after User Story 1
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — first slice of the MVP
- **User Story 3 (P1)**: No dependencies on other stories — second, independent slice of the MVP; can be built in parallel with User Story 1 by a different contributor
- **User Story 2 (P2)**: Builds on User Story 1's upload batch/conflict/submit code (T004–T006) — implement after User Story 1 is complete

### Parallel Opportunities

- T001 (Setup) and T002 (Foundational) touch different files (`package.json` vs. `app/editor/Icons.tsx`) and can be done together
- T003 (`app/api/upload/route.ts`) is a different file from T004–T006 (`app/editor/FileTree.tsx`) and can be built in parallel with them; final wiring in T006 needs both done
- T007 (`lib/storage/directories.ts`) is a different file from T008 (`app/api/download-zip/route.ts`) and T009 (`app/editor/FileTree.tsx`); T008 depends on T007's helper existing before it can be tested end-to-end, but authoring can proceed in parallel
- User Story 1 (Phase 3) and User Story 3 (Phase 4) touch disjoint files (`app/api/upload/route.ts` vs. `lib/storage/directories.ts` + `app/api/download-zip/route.ts`; both add buttons to `app/editor/FileTree.tsx` but in non-overlapping code regions) and can be worked on in parallel by different contributors once Phase 2 is done
- T004, T005, T006 (User Story 1) and T010, T011, T012 (User Story 2) all edit `app/editor/FileTree.tsx` sequentially within their own story — not parallelizable with each other, and User Story 2's edits should land after User Story 1's

---

## Parallel Example: Foundational + User Story 1 kickoff

```bash
# Once Phase 2 (T002) is done, these can start together:
Task: "Implement POST /api/upload route handler in app/api/upload/route.ts"          # T003
Task: "Add 'Upload files' button + hidden file input to FileTree.tsx"                 # T004
```

## Parallel Example: User Story 1 vs. User Story 3

```bash
# After Phase 2, these two independent P1 slices can proceed in parallel:
Task: "User Story 1 — POST /api/upload + FileTree.tsx upload UI (T003-T006)"
Task: "User Story 3 — listFilesRecursive + GET /api/download-zip + FileTree.tsx download UI (T007-T009)"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3 — both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (single/multi-file upload)
4. Complete Phase 4: User Story 3 (folder download) — independent of Phase 3, can be done in either order or in parallel
5. **STOP and VALIDATE**: quickstart.md steps 1–3 and 6–8
6. Deploy/demo the MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently (quickstart.md steps 1–3)
3. Add User Story 3 → validate independently (quickstart.md steps 6–8) — MVP complete
4. Add User Story 2 → validate independently (quickstart.md steps 4–5)
5. Polish (Phase 6) → full quickstart.md walkthrough

---

## Notes

- [P] tasks touch different files with no ordering dependency on incomplete work
- [Story] label maps each task to its user story for traceability
- User Story 2 intentionally depends on User Story 1's code (T004–T006) per research.md §3 — the upload transport, conflict confirmation, and summary/error handling are shared, not duplicated
- Verify each user story against its quickstart.md steps before moving to the next
- Commit after each task or logical group
