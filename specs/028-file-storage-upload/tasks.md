---

description: "Task list for Upload and Browse Mixed File Types in Storage"
---

# Tasks: Upload and Browse Mixed File Types in Storage

**Input**: Design documents from `/specs/028-file-storage-upload/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/upload-contract.md](contracts/upload-contract.md), [contracts/file-retrieval-contract.md](contracts/file-retrieval-contract.md), [quickstart.md](quickstart.md)

**Tests**: No test tasks are included — spec.md did not request tests, this project has no automated test suite (specs 001–019 validate via `quickstart.md` instead), and per standing user instruction tests are not to be executed as part of this workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

Single Next.js project at `frontend/` (plan.md Structure Decision) — all paths below are relative to the repository root, inside `frontend/`.

## Priority note

User Story 1 (upload) and User Story 3 (binary-open guard + retrieval) are both **P1** — the spec explicitly calls out that US3 "must hold from the moment mixed file types can be uploaded," so they share top priority. User Story 2 (icons) is P2. See Implementation Strategy below for what this means for MVP scope.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Make the storage layer binary-safe and establish the one shared allow-list/category table every other phase reads from — nothing user-visible changes yet

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 [P] Add `unsupported_type` (415) and `too_large` (413) to `StorageErrorCode` in `frontend/lib/storage/errors.ts`, plus helper constructors `unsupportedType(path, extension)` and `tooLarge(path, maxBytes)` mirroring the existing `notFound`/`typeMismatch`/`alreadyExists` helpers (data-model.md). Also updated the `STATUS_BY_CODE` maps in `app/api/{file,directory,tree,download-zip}/route.ts` with the two new codes (415/413), required for the widened union to type-check.
- [X] T002 [P] Create `frontend/lib/storage/fileTypes.ts`: export the extension→category allow-list table (data-model.md's category table — document/pdf: `pdf,doc,docx`; spreadsheet: `xls,xlsx,csv`; image: `jpg,jpeg,png,gif,bmp,webp`; diagram: `bpmn`; markup/code: `html,xml,css,md,txt,json`; archive: `zip`), `MAX_UPLOAD_BYTES = 25 * 1024 * 1024`, and helper functions `categoryForPath(path)`, `isAllowedExtension(path)`, `mimeTypeForPath(path)`, and `isNativelyRenderable(path)` (true only for `pdf`/`jpg`/`jpeg`/`png`, research.md §7)
- [X] T003 Convert `frontend/lib/storage/files.ts` to binary-safe content: `createFile`/`updateFile` accept a `Buffer` (not `string`) for `content`; both `PutObjectCommand` calls set `ContentType` from a new `contentType` parameter, falling back to `mimeTypeForPath` (T002) when not provided; `readFile` returns `Buffer` content via the S3 SDK's byte-array transform instead of `transformToString()`, and gains a new `contentType` field on `FileMetadata`/`FileContent` populated from `result.ContentType`, falling back to `mimeTypeForPath` (T002) for pre-existing objects with no stored type (data-model.md, research.md §2, §3) (depends on T002). **Unplanned but required**: this also changed the shape every existing caller of `readFile`/`createFile`/`updateFile` sees, so fixed up in the same pass to keep the build green and behavior unchanged for non-web callers: `lib/i18n/resolve.ts`, `lib/os/init.ts`, `lib/mcp-tools/{index,treeTools,bootstrap,inboxTools}.ts` now explicitly decode `Buffer`→`utf-8` string (or encode string→`Buffer`) at their existing text boundaries — the MCP `create_file`/`read_file`/`update_file`/`get_inbox` tools' text-only contract is unchanged from an agent's perspective.

**Checkpoint**: Storage layer is binary-safe end to end; no caller has been updated to use it differently yet, so behavior is still unchanged for `.md` files and nothing new is reachable.

---

## Phase 2: User Story 1 - Upload files of any common type into storage (Priority: P1) 🎯 MVP

**Goal**: Uploading a PDF, XLS/XLSX, DOC/DOCX, JPG/JPEG, PNG, BPMN, HTML, XML, or CSS file (individually or as a mixed batch, alongside the existing MD/TXT/CSV) stores it under the target folder with byte-for-byte integrity, reports a clear per-file result, and rejects disallowed or oversized files without discarding the rest of the batch.

**Independent Test**: quickstart.md Scenario 1 (mixed-type upload + overwrite) and Scenario 2 (disallowed type / oversized file rejection).

### Implementation for User Story 1

- [X] T004 [US1] Rewrite `frontend/app/api/upload/route.ts` to parse the request as `multipart/form-data` via `request.formData()` instead of JSON: read `basePath` as a text field, iterate every `files` entry, validate each entry's extension via `isAllowedExtension` (T002) — rejecting with an `unsupported_type`-derived message (T001) if not allowed — and its size against `MAX_UPLOAD_BYTES` (T002) — rejecting with a `too_large`-derived message (T001) if exceeded — otherwise read it via `.arrayBuffer()` into a `Buffer` and pass it to `createFile` (now `Buffer`-based, T003) with `contentType` from `file.type || mimeTypeForPath(path)`; keep the existing per-file `{path, status, message}` batch-result array response shape (contracts/upload-contract.md, FR-001, FR-002, FR-003, FR-004, FR-012) (depends on T002, T003)
- [X] T005 [US1] Update `handleUpload` in `frontend/app/files/FileTree.tsx`: replace the `.md`-only filter (`isMarkdownFile`) and `file.text()`-based JSON batching with building a `FormData` (one `basePath` field; each picked `File` appended under the repeated `files` field, preserving `webkitRelativePath` for folder uploads exactly as today) and `POST`ing it with no explicit `Content-Type` header (the browser sets the multipart boundary automatically); replace the `.md`-only client-side pre-filter with a check against the allow-list from `lib/storage/fileTypes.ts` (T002); widen both hidden `<input type="file">` elements' `accept` attribute from `.md` to the full allow-list's extensions (contracts/upload-contract.md, FR-001) (depends on T004)
- [X] T006 [US1] Update the upload-related strings in the canonical `frontend/lib/i18n/dictionaries/en.ts` (`nothingToUploadFiltered`) so they no longer say "Markdown (.md)" and instead describe the broader supported set (depends on T005)
- [X] T007 [P] [US1] Mirror T006's string changes in `frontend/lib/i18n/dictionaries/it.ts` (depends on T006)
- [X] T008 [P] [US1] Mirror T006's string changes in `frontend/lib/i18n/dictionaries/es.ts` (depends on T006)
- [X] T009 [P] [US1] Mirror T006's string changes in `frontend/lib/i18n/dictionaries/de.ts` (depends on T006)
- [X] T010 [P] [US1] Mirror T006's string changes in `frontend/lib/i18n/dictionaries/fr.ts` (depends on T006)
- [X] T011 [P] [US1] Mirror T006's string changes in `frontend/lib/i18n/dictionaries/ru.ts` (depends on T006)
- [X] T012 [US1] Update the upload section of `README.md` (repo root) to describe the broadened file-type support instead of ".md only" (depends on T005)

**Checkpoint**: User Story 1 is fully functional and independently testable — upload a mixed batch of files, confirm they appear intact, confirm disallowed/oversized files are rejected per-file without breaking the rest of the batch.

---

## Phase 3: User Story 2 - Recognize file types at a glance via icons (Priority: P2)

**Goal**: Files of different recognized types show visually distinct icons in the folder listing (PDF, spreadsheet, document, image, diagram, markup/code); unrecognized-but-allowed types show a generic fallback icon.

**Independent Test**: quickstart.md Scenario 3 (icon-per-category check).

### Implementation for User Story 2

- [X] T013 [P] [US2] Add `PdfIcon`, `SpreadsheetIcon`, `DocumentIcon`, `ImageIcon`, `DiagramIcon`, and `MarkupIcon` inline-SVG components to `frontend/app/files/Icons.tsx`, following the existing `FileIcon`/`FolderIcon` style (14×14 viewBox, `flexShrink: 0`, distinct simple glyph per category) (FR-005)
- [X] T014 [US2] In the file-row rendering of `frontend/app/files/FileTree.tsx` (the `entries?.files.map(...)` block), replace the single hardcoded `<FileIcon />` with a lookup via `categoryForPath(f.path)` (T002) that renders the matching icon from T013, falling back to the existing generic `<FileIcon />` for the archive category and any unrecognized case (FR-005, FR-006) (depends on T002, T013)

**Checkpoint**: User Story 2 is independently testable — a folder with a mix of file types shows a distinct icon per category, with a sensible fallback for anything else.

---

## Phase 4: User Story 3 - Only open text files for viewing, not binary ones (Priority: P1) 🎯 MVP

**Goal**: Genuinely text-readable files (of any allowed type, not just `.md`) open and edit exactly as before; binary files never render raw/garbled content — they show a clear message and can still be retrieved (opening inline in a new tab for PDF/JPG/PNG, downloading otherwise).

**Independent Test**: quickstart.md Scenario 4 (open text vs. blocked binary) and Scenario 5 (retrieve/download a binary file).

### Implementation for User Story 3

- [X] T015 [US3] In the `GET` handler of `frontend/app/api/file/route.ts`, move the binary check ahead of the `readFile` call and extend `BINARY_EXTENSIONS` with `doc, docx, xls, xlsx`; only call `readFile` (now `Buffer`-based, T003) and decode to text for extensions not conclusively binary, keeping the existing content-sniffing fallback (U+FFFD check) unchanged for those ambiguous cases; decode the returned `Buffer` to a UTF-8 string only once a file is confirmed text-viewable (research.md §4, FR-008, FR-009) (depends on T003). Also updated `PUT`/`POST` on the same route to `Buffer.from(content, "utf-8")` the incoming JSON string before calling the now-`Buffer`-based `updateFile`/`createFile`.
- [X] T016 [US3] Create `frontend/app/api/file/download/route.ts`: a `GET` handler requiring `requireOwnerSession()` that reads `path` from the query string, calls `readFile` (T003) for the raw `Buffer` and `contentType`, and responds — for `pdf`/`jpg`/`jpeg`/`png` (via `isNativelyRenderable`, T002) with the real `Content-Type` and `Content-Disposition: inline; filename="<basename>"`; for every other type with `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename="<basename>"`, and `X-Content-Type-Options: nosniff` — mapping `not_found`/`type_mismatch`/`storage_unreachable` to the same status codes `GET /api/file` already uses (contracts/file-retrieval-contract.md, FR-010) (depends on T002, T003)
- [X] T017 [US3] In `frontend/app/files/FileEditor.tsx`, add an Open/Download action shown alongside the existing `state.status === "unsupported"` message, linking to `` `/api/file/download?path=${encodeURIComponent(path)}` `` via an anchor with `target="_blank"` (FR-010) (depends on T016)
- [X] T018 [US3] Add the new Open/Download action's label string (`openOrDownload`) to `types.ts` and the canonical `frontend/lib/i18n/dictionaries/en.ts` (depends on T017)
- [X] T019 [P] [US3] Mirror T018 in `frontend/lib/i18n/dictionaries/it.ts` (depends on T018)
- [X] T020 [P] [US3] Mirror T018 in `frontend/lib/i18n/dictionaries/es.ts` (depends on T018)
- [X] T021 [P] [US3] Mirror T018 in `frontend/lib/i18n/dictionaries/de.ts` (depends on T018)
- [X] T022 [P] [US3] Mirror T018 in `frontend/lib/i18n/dictionaries/fr.ts` (depends on T018)
- [X] T023 [P] [US3] Mirror T018 in `frontend/lib/i18n/dictionaries/ru.ts` (depends on T018)

**Checkpoint**: User Story 3 is independently testable — text files (including newly-allowed HTML/XML/CSS/BPMN) open and edit normally; binary files never show garbled content and can be opened (PDF/JPG/PNG) or downloaded (everything else) from the same screen.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Extend the remaining existing operation (folder-zip download) to the newly-allowed file types, per FR-011, and validate the whole feature end-to-end

- [X] T024 [P] Drop the `.endsWith(".md")` filter in `listFilesRecursive` (`frontend/lib/storage/directories.ts`) so it returns every file under a folder, not only Markdown ones (FR-011)
- [X] T025 Update `frontend/app/api/download-zip/route.ts` to add each file's raw `Buffer` content (from the now-`Buffer`-based `readFile`, T003) to the `JSZip` archive via `zip.file(entryName, buffer)` instead of string content, and generalize its "has no Markdown (.md) files to download" empty-folder message to no longer be `.md`-specific (research.md §6, FR-011) (depends on T003, T024). `readFile` already returned `Buffer` after T003, so only the message/comment needed changing — `zip.file()` was already binary-safe.
- [X] T026 Ran the quickstart scenarios end-to-end against local dev (MinIO via `docker compose`, already running; `npm run dev`) using authenticated `curl` against the real API routes rather than a browser click-through: uploaded a mixed batch (`.xml`, `.txt`, `.pdf`, `.jpg`, `.exe`) — allowed types succeeded, `.exe` was rejected per-file (Scenario 1, 2); confirmed `.xml` opens as text via `GET /api/file` while `.pdf` returns 422 `unsupported` (Scenario 4); confirmed `GET /api/file/download` returns PDF/JPG `inline` with correct `Content-Type` and byte-identical content, and a `.txt` downloads as `attachment`/`octet-stream`/`nosniff` (Scenario 5); confirmed `GET /api/download-zip` now includes all 4 non-`.md` files with matching sizes (Scenario 6); confirmed `DELETE /api/directory` (soft-delete to Trash, then permanent delete) works unchanged on the mixed-type folder (Scenario 7). Icon rendering (Scenario 3) and the FileTree upload UI itself (Scenario 1's client half) are React/browser-only and weren't visually exercised — verified by code review and `tsc`/`next build` passing instead; flagged to the user as not browser-verified. **Unplanned fix found via this pass**: `POST /api/upload` requests between ~10 MB and 25 MB were being silently truncated at exactly 10 MB (Next.js's default proxy/middleware body-size cap, independent of the route handler's own 25 MB check) instead of cleanly succeeding or failing — fixed by setting `experimental.proxyClientMaxBodySize: "30mb"` in `frontend/next.config.ts`; re-verified with 15 MB (succeeds, byte-identical) and 26 MB (clean `too_large` rejection, no truncation) uploads.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS every user story.
- **User Story 1 (Phase 2)**: Depends on Phase 1 (T002, T003). No dependency on US2 or US3.
- **User Story 2 (Phase 3)**: Depends on Phase 1 (T002). No dependency on US1 or US3 — can proceed in parallel with either.
- **User Story 3 (Phase 4)**: Depends on Phase 1 (T002, T003). No dependency on US1 or US2 — can proceed in parallel with either.
- **Polish (Phase 5)**: Depends on Phase 1 (T003) and is otherwise independent of US1/US2/US3 completion, though T025 makes most sense once US1's upload path (Phase 2) has something to zip.

### Within Each User Story

- US1: T004 (API) before T005 (client, calls the new API shape) before T006 (dictionary wording depends on what T005 actually surfaces) before T007–T011 (parallel translations) ; T012 (README) after T005.
- US2: T013 (icon components) before T014 (wiring them into the file row).
- US3: T015 and T016 both depend only on Phase 1 and can run in parallel; T017 (UI action) depends on T016 (the route it links to); T018 before T019–T023 (parallel translations).

### Parallel Opportunities

- Phase 1: T001 and T002 in parallel (different files); T003 starts once T002 lands.
- Once Phase 1 completes: US1 (Phase 2), US2 (Phase 3), and US3 (Phase 4) can all start in parallel — they touch non-overlapping files except `FileTree.tsx`, where US1's upload change (T005) and US2's icon change (T014) touch different, non-conflicting regions (the upload handler vs. the file-row render) but should still be sequenced by one contributor to avoid a merge conflict if worked by the same person.
- All five non-English dictionary tasks within US1 (T007–T011) are parallel once T006 lands; same for US3's T019–T023 once T018 lands.
- T024 (directories.ts) can run any time after Phase 1; T025 depends on both T024 and T003.

---

## Parallel Example: User Story 1

```bash
# After T004 (API) and T005 (client) land, translate the new upload strings in parallel:
Task: "Mirror upload string changes in frontend/lib/i18n/dictionaries/it.ts"
Task: "Mirror upload string changes in frontend/lib/i18n/dictionaries/es.ts"
Task: "Mirror upload string changes in frontend/lib/i18n/dictionaries/de.ts"
Task: "Mirror upload string changes in frontend/lib/i18n/dictionaries/fr.ts"
Task: "Mirror upload string changes in frontend/lib/i18n/dictionaries/ru.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3 — both P1)

Unlike a typical single-P1-story MVP, this feature's spec explicitly marks User Story 3 (the binary-open guard) as sharing top priority with User Story 1 (upload) — uploading binary files without also guarding against opening them as text would be a data-integrity regression, not a smaller version of the feature.

1. Complete Phase 1: Foundational
2. Complete Phase 2: User Story 1 (upload)
3. Complete Phase 4: User Story 3 (binary guard + retrieval) — do this *before* considering the feature demoable, even though it's numbered Phase 4
4. **STOP and VALIDATE**: run quickstart.md Scenarios 1, 2, 4, 5
5. Deploy/demo the P1 MVP (upload + safe open/retrieve, generic icons)

### Incremental Delivery

1. Foundational → Phase 2 (US1) → Phase 4 (US3) → validate → this is the MVP (P1+P1)
2. Add Phase 3 (US2 icons) → validate independently (quickstart Scenario 3) → deploy/demo
3. Add Phase 5 (Polish: zip download, full quickstart pass) → ship

### Parallel Team Strategy

With multiple contributors:

1. Team completes Phase 1 (Foundational) together
2. Once Phase 1 is done:
   - Contributor A: Phase 2 (US1 — upload)
   - Contributor B: Phase 4 (US3 — binary guard + retrieval)
   - Contributor C: Phase 3 (US2 — icons)
3. Coordinate on `frontend/app/files/FileTree.tsx` (touched by both US1's T005 and US2's T014) to avoid a merge conflict; the two changes are in non-overlapping regions of the file
4. Phase 5 last, once Phase 1's storage change (T003) and US1's upload path exist to validate against

---

## Notes

- No test tasks: this project has no automated test suite; `quickstart.md` is the validation mechanism (T026).
- [P] tasks touch different files with no incomplete dependency.
- [Story] labels map every implementation task to spec.md's US1/US2/US3 for traceability.
- Commit after each task or logical group, per repo convention (see recent commit history).
- Stop at each phase checkpoint to validate that user story independently before moving on.
