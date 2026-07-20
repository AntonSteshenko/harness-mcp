---

description: "Task list template for feature implementation"
---

# Tasks: Web File Explorer & Markdown Editor

**Input**: Design documents from `/specs/003-web-file-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not requested in the feature specification. Verification is via the browser-driven `quickstart.md` walkthrough (research.md §8), consistent with specs 001–002. Each user story phase below ends with quickstart-execution tasks that serve as its acceptance check.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Per plan.md's Project Structure — new files added to the existing spec 002 Next.js app:

- `app/editor/page.tsx`, `FileTree.tsx`, `FileEditor.tsx`, `MarkdownEditor.tsx`, `PlainTextEditor.tsx`
- `app/api/tree/route.ts`, `app/api/file/route.ts`
- `lib/storage/*` (existing, spec 002 — read-only reuse, no changes)

## Phase 1: Setup

**Purpose**: Install this feature's new dependencies

- [ ] T001 Install `@uiw/react-codemirror`, `@codemirror/lang-markdown`, `react-markdown`, `remark-gfm` (plan.md Technical Context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two API routes every story reads through, plus the page/Editor Session skeleton

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Implement `GET /api/tree` in `app/api/tree/route.ts`, wrapping `listDirectory` (lib/storage/directories.ts); map `not_found`/`storage_unreachable` to `404`/`502` per contracts/api-routes.md (research.md §2)
- [ ] T003 Implement `GET /api/file` in `app/api/file/route.ts`, wrapping `readFile` (lib/storage/files.ts); map `not_found`/`storage_unreachable` to `404`/`502` per contracts/api-routes.md (research.md §3)
- [ ] T004 Add `PUT /api/file` to `app/api/file/route.ts`, wrapping `updateFile` (lib/storage/files.ts); same error mapping, plus ensure a failed request never implies content was saved (contracts/api-routes.md, FR-010) (depends on T003 — same file)
- [ ] T005 [P] Create `app/editor/page.tsx` skeleton: two-panel layout with placeholders for the file tree and the editor area
- [ ] T006 [P] Create the Editor Session state shape in `app/editor/FileEditor.tsx` skeleton per data-model.md (`path`, `loadedContent`, `currentContent`, `kind`, `dirty`, `saveState`)

**Checkpoint**: Foundation ready - API routes work end-to-end against a running storage stack; page shell renders; user story implementation can now begin

---

## Phase 3: User Story 1 - Browse and view files (Priority: P1) 🎯 MVP

**Goal**: A user can see the folder/file structure in the browser, expand directories without a full page reload, and open a file to view its content.

**Independent Test**: `specs/003-web-file-editor/quickstart.md` Section 1 (load page, expand a folder, expand an empty folder, open a file and see its content).

### Implementation for User Story 1

- [ ] T007 [US1] Implement `app/editor/FileTree.tsx`: fetch `GET /api/tree` lazily per directory as the user expands nodes; render an expandable tree; show empty folders clearly rather than looking broken (research.md §2, FR-001)
- [ ] T008 [US1] Wire tree file-selection to `FileEditor.tsx`: clicking a file calls `GET /api/file` and loads the result into Editor Session state (FR-002)
- [ ] T009 [US1] Display the loaded file's content (read-only for this story — real editing lands in US2/US3) in `FileEditor.tsx` (FR-002, SC-001)
- [ ] T010 [US1] Handle `not_found`/`storage_unreachable` responses from `GET /api/tree`/`GET /api/file` with a clear on-screen message in `FileTree.tsx`/`FileEditor.tsx` (Edge Cases)

### Validation for User Story 1

- [ ] T011 [US1] Execute `specs/003-web-file-editor/quickstart.md` Section 1 against a running `npm run dev` + spec 001 storage stack; confirm SC-001

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Edit Markdown files with live preview (Priority: P2)

**Goal**: Markdown files open in a split-view editor (raw text + live rendered preview), can be saved, show unsaved-changes state, and handle save failures without losing edits.

**Independent Test**: `specs/003-web-file-editor/quickstart.md` Section 2 (edit a `.md` file, watch the preview update live, save, reload to confirm persistence, trigger the unsaved-changes warning, and the save-error path).

### Implementation for User Story 2

- [ ] T012 [US2] Implement `app/editor/MarkdownEditor.tsx`: CodeMirror (`@uiw/react-codemirror` + `@codemirror/lang-markdown`) for the raw-text pane and `react-markdown` + `remark-gfm` for the preview pane, laid out side by side (research.md §4, FR-003)
- [ ] T013 [US2] Wire the preview to update on every keystroke with no manual refresh (FR-004, SC-002)
- [ ] T014 [US2] Implement the save action in `FileEditor.tsx`: call `PUT /api/file`; on success reset `loadedContent`/`dirty` and confirm; on failure set `saveState: "error"` and leave `currentContent` untouched (FR-005, FR-008, FR-010, contracts/api-routes.md)
- [ ] T015 [US2] Render the dirty/unsaved-changes indicator and save success/error UI in `FileEditor.tsx` (FR-008, FR-010)
- [ ] T016 [US2] Implement the navigation guard in `FileEditor.tsx`: `window.confirm`-style prompt before switching files while dirty, plus a `beforeunload` handler for tab close/reload (FR-009, research.md §7)
- [ ] T017 [US2] Wire `FileEditor.tsx` to render `MarkdownEditor.tsx` when the open file's `kind` is `"markdown"` (`.md` extension, data-model.md)

### Validation for User Story 2

- [ ] T018 [US2] Execute `specs/003-web-file-editor/quickstart.md` Section 2, including stopping the storage stack mid-edit to trigger the save-error path; confirm SC-002, SC-003, SC-004

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Edit other text files (Priority: P3)

**Goal**: Non-Markdown text files open in a simple plain-text editor and can be saved, reusing the save/dirty infrastructure built for Markdown.

**Independent Test**: `specs/003-web-file-editor/quickstart.md` Section 3 (open a non-`.md` file, edit it, save, reload to confirm persistence).

### Implementation for User Story 3

- [ ] T019 [US3] Implement `app/editor/PlainTextEditor.tsx`: a plain `<textarea>` bound to the Editor Session's `currentContent`, no Markdown rendering (research.md §5, FR-006)
- [ ] T020 [US3] Wire `FileEditor.tsx` to render `PlainTextEditor.tsx` when the open file's `kind` is `"text"` (non-`.md`, decodable as text, data-model.md)
- [ ] T021 [US3] Confirm the save action from T014/T015 works unmodified for `PlainTextEditor.tsx` (same `PUT /api/file` + dirty/saveState flow, FR-007) — fix if the Markdown-specific wiring from US2 accidentally coupled to `MarkdownEditor.tsx`

### Validation for User Story 3

- [ ] T022 [US3] Execute `specs/003-web-file-editor/quickstart.md` Section 3; confirm SC-005

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Binary-file handling, remaining edge cases, and documentation

- [ ] T023 Implement "unsupported" file detection end-to-end: `GET /api/file` in `app/api/file/route.ts` returns `422 unsupported` when content fails UTF-8 decode or the extension is in a small known-binary denylist (research.md §6); `FileEditor.tsx` shows a clear "can't edit this file" message instead of opening an editor (FR-011)
- [ ] T024 Execute `specs/003-web-file-editor/quickstart.md` Section 4 (open a binary file) and Section 5 (file deleted elsewhere while open, then attempt to save) as final edge-case validation
- [ ] T025 [P] Add a section to `README.md` documenting the `/editor` URL and its dependency on the spec 001 storage stack and `npm run dev` being up
- [ ] T026 Cross-check `app/api/tree/route.ts` and `app/api/file/route.ts` response shapes against `specs/003-web-file-editor/contracts/api-routes.md` for drift and fix any found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 has no dependency on US2/US3
  - US2 and US3 both build on `FileEditor.tsx`'s save/dirty infrastructure — recommended order is still priority order (P1 → P2 → P3) since US3 (T021) explicitly reuses what US2 (T014/T015) builds
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - independently testable via its own quickstart section, though it owns the save/dirty logic US3 later reuses
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - independently testable, but T021 explicitly depends on US2's T014/T015 landing first

### Within Each User Story

- Implementation before validation
- API routes (Foundational) before any UI work that calls them
- Story complete before moving to next priority

### Parallel Opportunities

- T002 (`app/api/tree/route.ts`), T005 (`app/editor/page.tsx`), and T006 (`app/editor/FileEditor.tsx` skeleton) can all run in parallel (three different files) — T003→T004 must stay sequential (both touch `app/api/file/route.ts`)
- T025 (README) can run in parallel with T023/T024/T026 (different files)
- Because US2 and US3 converge on the same `FileEditor.tsx` save/dirty logic, most of their value only becomes truly parallel-friendly across *files* (`MarkdownEditor.tsx` vs `PlainTextEditor.tsx` themselves can be built in parallel), not across the shared wiring

---

## Parallel Example: Foundational Phase

```bash
# Launch these together (three different files):
Task: "Implement GET /api/tree in app/api/tree/route.ts"
Task: "Create app/editor/page.tsx skeleton"
Task: "Create Editor Session state shape in app/editor/FileEditor.tsx skeleton"
# ...while T003 -> T004 proceed sequentially against app/api/file/route.ts
```

## Parallel Example: User Story 2 vs User Story 3 editor components

```bash
# Once Foundational + US2's save/dirty wiring (T014/T015) exist, these can proceed in parallel:
Task: "Implement app/editor/MarkdownEditor.tsx (CodeMirror + react-markdown split view)"
Task: "Implement app/editor/PlainTextEditor.tsx (plain textarea)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md Section 1 independently
5. At this point a user can already browse and read every stored file from the browser — editing lands in the next two increments

### Incremental Delivery

1. Complete Setup + Foundational → API routes + page shell ready
2. Add User Story 1 → validate independently → browse/view works (MVP!)
3. Add User Story 2 → validate independently → Markdown editing with live preview and save works (the primary motivating use case)
4. Add User Story 3 → validate independently → non-Markdown text editing works
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test framework is introduced by this feature; verification is via the browser-driven `quickstart.md` walkthrough (research.md §8)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Both the spec 001 storage stack (`docker compose up -d`) and the spec 002 Next.js dev server (`npm run dev`) must be running to validate anything in this feature
