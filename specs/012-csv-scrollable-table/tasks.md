---

description: "Task list template for feature implementation"
---

# Tasks: CSV Scrollable Table View

**Input**: Design documents from `/specs/012-csv-scrollable-table/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature (plan.md Testing: no automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-011). No test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User Story 1 (view a CSV file as a table) and User Story 2 (scroll through large CSV files) are both Priority P1 and together form the MVP; User Story 3 (graceful fallback for malformed/empty CSV) is P2 and layers additional edge-case handling onto the same two files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at `frontend/` (same app as specs 001-011): `frontend/lib/csv.ts` (new), `frontend/app/editor/CsvTableEditor.tsx` (new), `frontend/app/editor/FileEditor.tsx` (modified). No `tests/` directory — no automated tests requested. No new dependencies are introduced (research.md §1-2), so there is no Setup phase — implementation starts directly at Foundational.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The shared `kind` plumbing and CSV parsing logic every user story depends on

**⚠️ CRITICAL**: Complete before starting any user story phase

- [X] T001 [P] In `frontend/app/editor/FileEditor.tsx`, extend `EditorSession["kind"]` from `"markdown" | "text"` to `"markdown" | "text" | "csv"`, and add a `.csv` branch to `deriveKind()` (checked the same way as the existing `.md` branch) so `.csv` files derive `kind: "csv"` instead of falling through to `"text"` (data-model.md "EditorSession extended", contracts/file-api-and-editor-kind.md)
- [X] T002 [P] Create `frontend/lib/csv.ts` exporting a `CsvDocument` interface (`headers: string[]`, `rows: string[][]`, `truncated: boolean`, `totalRowCount: number`) and `parseCsv(text: string): CsvDocument` (data-model.md "CSV Document"). Implement RFC 4180-style parsing: split fields on commas; a comma or newline inside a `"..."`-quoted field does not split the value; `""` inside a quoted field decodes to a literal `"` (research.md §1). The first parsed row becomes `headers`; subsequent rows become `rows` entries, preserved as-is with no padding/truncation of individual rows (ragged rows pass through unchanged — rendering handles that, not parsing). An empty input string produces `{ headers: [], rows: [], truncated: false, totalRowCount: 0 }`. Export a `MAX_TABLE_ROWS = 5000` constant; if the file has more than `MAX_TABLE_ROWS` data rows, `rows` contains only the first `MAX_TABLE_ROWS` entries, `truncated` is `true`, and `totalRowCount` reflects the real total row count (FR-012, research.md §2)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 2: User Story 1 - View a CSV file as a table (Priority: P1) 🎯 MVP

**Goal**: Opening a `.csv` file renders its content as a table (header row + data rows split into columns) instead of raw text in the plain-text fallback, with a way to switch to the existing raw-text view to edit.

**Independent Test**: Open a `.csv` file with a header row and several data rows; verify the content renders as a table with the first row shown as distinct column headers and each subsequent row as a table row split into columns (spec.md US1).

### Implementation for User Story 1

- [X] T003 [US1] Create `frontend/app/editor/CsvTableEditor.tsx` with `CsvTableEditorProps { value: string; onChange: (value: string) => void; mode: "table" | "raw" }`, mirroring `MarkdownEditor.tsx`'s single-view-at-a-time pattern. In `"raw"` mode, render `<PlainTextEditor value={value} onChange={onChange} />` unchanged (FR-006, FR-007). In `"table"` mode, call `parseCsv(value)` (from `frontend/lib/csv.ts`, T002) and render a `<table>`: one `<tr>` of `<th>` cells from `headers`, followed by one `<tr>` of `<td>` cells per entry in `rows` (FR-001, FR-002)
- [X] T004 [US1] In `frontend/app/editor/FileEditor.tsx`: reuse the existing `mode` state (currently `"preview" | "edit"`, used only for `kind === "markdown"`) for `kind === "csv"` sessions too, treating `"preview"` as the table view and `"edit"` as the raw view; add toolbar buttons labeled "Table" and "Raw" shown only when `session.kind === "csv"` (parallel to the existing Preview/Edit buttons shown only for `"markdown"`); render `<CsvTableEditor value={session.currentContent} onChange={handleContentChange} mode={mode === "preview" ? "table" : "raw"} />` when `session.kind === "csv"`, alongside the existing `MarkdownEditor`/`PlainTextEditor` branches. Reset `mode` to `"preview"` on file open, matching the existing reset-on-path-change effect, so CSV files also default to the table view (FR-006)
- [X] T005 [US1] In `CsvTableEditor.tsx`'s table mode, style the header row's `<th>` cells distinctly (e.g., bold text plus a light background) so the header is visually distinguished from data rows at a glance (FR-003, SC-003)
- [X] T006 [US1] In `CsvTableEditor.tsx`, wrap the `<table>` in a `<div>` styled with `maxHeight: "60vh"` and `overflowX: "auto"` (matching the `60vh` convention already used by `MarkdownEditor`/`PlainTextEditor`) so a table wider than the viewport scrolls horizontally instead of breaking the page layout (US1 acceptance scenario 2)

**Checkpoint**: User Story 1 is fully functional and independently testable — well-formed `.csv` files render as a table with a visibly distinct header, and stay readable at any viewport width (quickstart.md Scenario 1)

---

## Phase 3: User Story 2 - Scroll through large CSV files (Priority: P1)

**Goal**: A `.csv` file with more rows or columns than fit on screen can be scrolled vertically and horizontally, with the header row staying visible, and files beyond a 5,000-row cap show a clear truncation notice instead of silently cutting off or freezing the browser.

**Independent Test**: Open a `.csv` file with enough rows to exceed the visible area; verify scrolling down reveals additional rows while the header stays visible/pinned, and scrolling right reveals additional columns without breaking row alignment (spec.md US2).

### Implementation for User Story 2

- [X] T007 [US2] In `CsvTableEditor.tsx`, add `position: "sticky", top: 0` (plus an opaque background matching the styling from T005) to the header row's `<th>` cells, so the header stays visible while the table body scrolls vertically inside the `60vh` container from T006 (FR-004, US2 acceptance scenario 1)
- [X] T008 [US2] In `frontend/lib/csv.ts`, verify `parseCsv`'s `MAX_TABLE_ROWS` cap from T002 is applied correctly: for a file with more than 5,000 data rows, `rows.length === 5000`, `truncated === true`, and `totalRowCount` equals the real total (FR-011, FR-012)
- [X] T009 [US2] In `CsvTableEditor.tsx`, render a visible notice (e.g., "Showing {rows.length.toLocaleString()} of {totalRowCount.toLocaleString()} rows") above or below the table whenever `parseCsv(value).truncated` is `true` (FR-012, SC-002)

**Checkpoint**: User Stories 1 and 2 (the P1 MVP) both work independently — tables of any size open, scroll smoothly up to 5,000 rows with a pinned header, and larger files show a clear truncation notice rather than degrading (quickstart.md Scenarios 2 and 8)

---

## Phase 4: User Story 3 - Fall back gracefully for non-tabular or malformed CSV content (Priority: P2)

**Goal**: Empty, header-only, ragged-row, and quoted-value-containing `.csv` files all render sensibly (a table, a partial table, or a clear empty-state message) instead of erroring or showing a blank/broken table.

**Independent Test**: Open an empty `.csv` file, a header-only `.csv` file, and a `.csv` file with ragged rows; verify each renders a table (or a clear empty state) without errors (spec.md US3).

### Implementation for User Story 3

- [X] T010 [US3] In `CsvTableEditor.tsx`, render a clear empty-state message (e.g., "This file is empty") instead of a table when `parseCsv(value)` returns `headers.length === 0 && rows.length === 0` (FR-009, US3 acceptance scenario 2)
- [X] T011 [US3] In `CsvTableEditor.tsx`, when `headers.length > 0 && rows.length === 0`, render the header row as usual plus a clear "no data" indication in place of the (empty) table body (FR-010, US3 acceptance scenario 1)
- [X] T012 [US3] In `CsvTableEditor.tsx`'s data-row rendering (T003), render each row's cells up to `Math.max(headers.length, row.length)` rather than just `headers.length`, treating any index beyond `row.length` as an empty string — so a short row shows blank trailing cells and a long row still displays its extra values instead of dropping them (FR-008, US3 acceptance scenario 3)
- [X] T013 [US3] In `frontend/lib/csv.ts`, verify `parseCsv` (T002) correctly keeps a quoted value containing commas or embedded newlines as a single field, and decodes an escaped `""` inside a quoted field to a literal `"` (FR-002, US3 acceptance scenario 4)

**Checkpoint**: All three user stories are independently functional — empty, header-only, ragged, and quote-embedded `.csv` files never produce an error or a blank screen (quickstart.md Scenarios 4, 5, 6, 7)

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across the whole feature, including confirming no regression to existing file kinds

- [ ] T014 [P] Run the full `quickstart.md` walkthrough (Scenarios 1-9) end-to-end against a local `next dev` instance, including Scenario 9 (opening an existing `.md`/`.txt` file to confirm Markdown preview/edit and plain-text behavior are unchanged). **Not yet run**: no browser automation was available in the implementing session (Chrome extension not connected) — a `next dev` instance is already running (port 3002) and code changes (T001-T013) pass `tsc --noEmit` cleanly, but the actual click-through against the browser still needs to happen manually.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories.
- **User Stories (Phase 2-4)**: All depend on Foundational phase completion (T001, T002).
- **Polish (Phase 5)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational (T001, T002) — creates `CsvTableEditor.tsx` and wires it into `FileEditor.tsx`
- **User Story 2 (P1)**: Depends on Foundational (T002 for the cap logic) and on User Story 1 (T003/T006 — the sticky header in T007 builds on the header styling and scroll container User Story 1 already created)
- **User Story 3 (P2)**: Depends on User Story 1 (T003 — extends the same row-rendering logic and component) and Foundational (T002 — extends/verifies the same `parseCsv`)

### Within Each User Story

- T001 and T002 (Foundational) touch different files and have no dependency on each other
- T003 must exist before T004 (FileEditor.tsx imports CsvTableEditor), T005, T006 (all edit the same new file, so sequential)
- T007 depends on T005/T006 (same file, builds on the header styling and scroll container)
- T008 depends on T002 (same file, csv.ts)
- T009 depends on T007 (same file) and T008 (reads `truncated`/`totalRowCount`)
- T010, T011, T012 depend on T003-T009 (same file, CsvTableEditor.tsx) being in place
- T013 depends on T002/T008 (same file, csv.ts)

### Parallel Opportunities

- T001 and T002 (Foundational) can run in parallel — different files
- No other tasks are parallelizable: this feature concentrates almost entirely in two files (`CsvTableEditor.tsx`, `csv.ts`), so later tasks in each story build sequentially on earlier edits to the same file

---

## Parallel Example: Foundational Phase

```bash
# T001 and T002 touch different files and can proceed together:
Task: "Extend EditorSession[\"kind\"] and deriveKind() in frontend/app/editor/FileEditor.tsx"
Task: "Create parseCsv()/CsvDocument in frontend/lib/csv.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — both P1)

1. Complete Phase 1: Foundational (T001, T002)
2. Complete Phase 2: User Story 1 (view a CSV file as a table)
3. Complete Phase 3: User Story 2 (scroll through large CSV files, including the 5,000-row cap/notice)
4. **STOP and VALIDATE**: quickstart.md Scenarios 1, 2, 3, 8
5. Deploy/demo the MVP — `.csv` files already render as a readable, scrollable table

### Incremental Delivery

1. Foundational (T001, T002) → foundation ready
2. Add User Story 1 → validate independently (quickstart.md Scenario 1)
3. Add User Story 2 → validate independently (quickstart.md Scenarios 2, 8) — MVP complete
4. Add User Story 3 → validate the malformed/empty-input edge cases (quickstart.md Scenarios 4-7)
5. Polish (Phase 5) → full quickstart.md walkthrough, including the non-regression check for Markdown/plain-text files

---

## Notes

- [P] tasks touch different files with no ordering dependency on incomplete work
- [Story] label maps each task to its user story for traceability
- This feature deliberately concentrates in two files (`frontend/lib/csv.ts`, `frontend/app/editor/CsvTableEditor.tsx`) plus one small extension to `frontend/app/editor/FileEditor.tsx`, per research.md §3 (reusing the exact `kind`/mode-toggle pattern `MarkdownEditor.tsx` already established) — no new dependencies, API routes, or storage changes (contracts/file-api-and-editor-kind.md)
- Verify each user story against its quickstart.md scenarios before moving to the next
- Commit after each task or logical group
