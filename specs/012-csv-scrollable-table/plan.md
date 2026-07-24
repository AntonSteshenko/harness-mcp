# Implementation Plan: CSV Scrollable Table View

**Branch**: `012-csv-scrollable-table` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-csv-scrollable-table/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Files with a `.csv` extension currently open in the web file editor's plain-text fallback (`PlainTextEditor`, spec 003) — raw comma-separated text in a textarea. This feature adds a `"csv"` branch to `EditorSession.kind` (parallel to the existing `"markdown"` branch) that parses the file's raw text into rows/columns (hand-rolled RFC 4180-style parsing, no new dependency) and renders it as a scrollable, read-only HTML table with a pinned header row, up to a 5,000-row cap (with a truncation notice beyond that, per clarification). A "Table"/"Raw" toggle — mirroring Markdown's existing "Preview"/"Edit" toggle — lets users switch to the existing raw-text view to make edits, which continue to save through the unchanged `PUT /api/file` flow. No API, MCP tool, or storage-layer changes.

## Technical Context

**Language/Version**: TypeScript 5.9 (Next.js 16 App Router, Node.js runtime), React 19

**Primary Dependencies**: None new. Reuses existing `frontend/package.json` deps only — no CSV-parsing library and no virtualization library added (see `research.md` §1–2 for why).

**Storage**: S3-compatible object storage (MinIO, spec 001) — unchanged; this feature only affects how already-fetched file content is rendered client-side.

**Testing**: No automated test suite in this project; changes are validated against a running `next dev` instance via a manual scenario walkthrough (`quickstart.md`), consistent with specs 001–011.

**Target Platform**: Linux server / local dev; same Next.js App Router page (`frontend/app/editor/`) that already hosts the file editor.

**Project Type**: web — single Next.js app (`frontend/`); this feature is entirely client-side (editor UI), no backend/API changes.

**Performance Goals**: Table view (initial render + scroll) stays responsive for CSV files up to 5,000 data rows (FR-011); files beyond that render only the first 5,000 rows with a truncation notice rather than attempting unbounded rendering (FR-012).

**Constraints**: Table view is read-only (FR-007) — no in-cell editing; CSV detection is extension-only (`.csv`), no content-sniffing (spec Assumptions); no new API endpoints or MCP tools.

**Scale/Scope**: Single new client-side rendering path (one new component + one small parsing helper) plus a two-line extension to existing `deriveKind()`/`kind` type in `frontend/app/editor/FileEditor.tsx`. No change to number of routes, tools, or storage entities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (all sections are placeholders — no ratified principles exist for this project). No gates apply; nothing to check against. Re-confirmed after Phase 1: still N/A.

## Project Structure

### Documentation (this feature)

```text
specs/012-csv-scrollable-table/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── file-api-and-editor-kind.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── lib/
│   └── csv.ts               # NEW: parseCsv(text) -> CsvDocument (headers, rows, truncated, totalRowCount)
└── app/
    └── editor/
        ├── FileEditor.tsx    # MODIFIED: EditorSession["kind"] gains "csv"; deriveKind() gains a .csv branch;
        │                     #           renders CsvTableEditor when kind === "csv"
        ├── CsvTableEditor.tsx # NEW: table/raw toggle (parallel to MarkdownEditor's preview/edit),
        │                      #      renders the scrollable <table> or reuses PlainTextEditor for raw/edit
        ├── MarkdownEditor.tsx # UNCHANGED
        └── PlainTextEditor.tsx # UNCHANGED — reused as-is by CsvTableEditor's "raw" mode
```

**Structure Decision**: This feature lives entirely inside the existing single Next.js app (`frontend/`) established by specs 001–011 — no new project, service, route, or top-level directory. It adds one small parsing helper (`frontend/lib/csv.ts`) and one new editor component (`frontend/app/editor/CsvTableEditor.tsx`), following the exact pattern `MarkdownEditor.tsx` already established for a second `kind`. No backend, storage, or MCP tool code is touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — Constitution Check is N/A (unfilled template project).
