# Implementation Plan: Web File Explorer & Markdown Editor

**Branch**: `003-web-file-editor` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-web-file-editor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a browser UI (`app/editor`) to the existing spec 002 Next.js app: a lazily-loaded folder/file tree backed by two thin API routes (`GET /api/tree`, `GET`/`PUT /api/file`) that wrap the already-built `lib/storage/*` functions (research.md §1–§3). Markdown files open in a CodeMirror + `react-markdown` split view with a live-updating preview; everything else opens in a plain `<textarea>` fallback; non-text files show a clear "can't edit here" message instead. Explicit save only, with an unsaved-changes indicator and navigation/unload guards, all tracked as plain client-side React state (research.md §7).

## Technical Context

**Language/Version**: TypeScript on Node.js (same app as spec 002 — Next.js ≥ 18.18 requirement, current Node.js LTS)

**Primary Dependencies**: `@uiw/react-codemirror` + `@codemirror/lang-markdown` (Markdown raw-text pane), `react-markdown` + `remark-gfm` (live preview rendering) — all new; everything else (Next.js, `@aws-sdk/client-s3` via `lib/storage/*`) is already in the project from spec 002

**Storage**: The spec 001 local MinIO storage, accessed exclusively through spec 002's existing `lib/storage/files.ts` / `lib/storage/directories.ts` — this feature adds no new storage access code (research.md §1–§3)

**Testing**: No automated test suite requested; validated via the browser-driven walkthrough in quickstart.md (research.md §8), consistent with specs 001–002

**Target Platform**: Same developer-local Next.js dev server as spec 002 (`npm run dev`), viewed in a desktop browser

**Project Type**: Web application UI added to an existing web service (spec 002's Next.js app) — no new project/app is created

**Performance Goals**: Markdown preview reflects a typed change in under 500ms (SC-002); saves confirm in under 2s (SC-003)

**Constraints**: Reuses spec 002's storage layer exclusively (FR-012) — no second way of talking to storage; explicit save only, no autosave (spec Assumptions); single active editor per file, no locking (spec Assumptions, consistent with spec 002 FR-015)

**Scale/Scope**: Single local developer viewing/editing one file at a time in one browser tab; tree depth/file counts bounded only by what spec 001/002 already support

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` still contains only unfilled template placeholders (same state as specs 001 and 002). No concrete gates exist to evaluate against, so this check trivially passes with no violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-web-file-editor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── mcp/route.ts          # (existing, spec 002 — unchanged)
├── editor/
│   ├── page.tsx           # Editor page: layout hosting FileTree + FileEditor
│   ├── FileTree.tsx        # Client component: lazy-loaded tree (research.md §2)
│   ├── FileEditor.tsx       # Client component: Editor Session state, dispatches to the two views below (data-model.md)
│   ├── MarkdownEditor.tsx    # CodeMirror + react-markdown split view (research.md §4)
│   └── PlainTextEditor.tsx    # <textarea> fallback (research.md §5)
└── api/
    ├── tree/route.ts       # GET — wraps lib/storage/directories.ts listDirectory (contracts/api-routes.md)
    └── file/route.ts        # GET/PUT — wraps lib/storage/files.ts readFile/updateFile (contracts/api-routes.md)

lib/
├── storage/               # (existing, spec 002 — unchanged; reused as-is)
└── mcp-tools/              # (existing, spec 002 — unchanged)
```

**Structure Decision**: Everything lives inside the existing spec 002 Next.js app — no new project. A new `app/editor/` route holds the UI (page + client components), and a new `app/api/` folder holds the two thin Route Handlers that translate browser `fetch` calls into `lib/storage/*` function calls (research.md §1–§3). `lib/storage/*` itself is untouched: this feature is purely an additional consumer of it, exactly like `lib/mcp-tools/*` already is.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
