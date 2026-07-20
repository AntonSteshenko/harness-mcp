# Implementation Plan: File Delete & Create

**Branch**: `005-file-create-delete` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-file-create-delete/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Expose the already-existing spec 002 storage primitives (`createFile`, `deleteFile`, `createDirectory` in `lib/storage/`) through the web editor: extend `app/api/file/route.ts` with `POST` (create) and `DELETE` handlers, and add a new `app/api/directory/route.ts` with a `POST` handler (research.md §1). On the UI side, extend `app/editor/FileTree.tsx` with per-file "Delete" and per-directory "New file"/"New folder" actions using the same inline-button + `window.prompt`/`window.confirm` pattern spec 004 already established for upload/download (research.md §2). Deleting the file currently open in the editor closes it by threading an `onFileDeleted` callback up to `app/editor/page.tsx`, which clears `selectedPath` (research.md §3, FR-003). No new storage backend, dependency, or persisted entity is introduced — like spec 004, this is purely an additional UI/API consumer of `lib/storage/*` (FR-011).

## Technical Context

**Language/Version**: TypeScript on Node.js (same app as specs 002/003/004 — Next.js ≥ 18.18 requirement, current Node.js LTS)

**Primary Dependencies**: None new. Reuses Next.js Route Handlers and the existing `lib/storage/files.ts` (`createFile`, `deleteFile`) and `lib/storage/directories.ts` (`createDirectory`), all already implemented and used by spec 002's MCP tools but not yet wired to the web UI/API.

**Storage**: The spec 001 local MinIO storage, accessed exclusively through spec 002's existing `lib/storage/files.ts` and `lib/storage/directories.ts` — no new storage access primitives are added (FR-011).

**Testing**: No automated test suite requested; validated via the browser-driven walkthrough in quickstart.md, consistent with specs 001-004.

**Target Platform**: Same developer-local Next.js dev server as specs 002/003/004 (`npm run dev`), viewed in a desktop browser.

**Project Type**: Web application UI/API extension added to the existing spec 002/003/004 Next.js app — no new project/app is created.

**Performance Goals**: Create/delete actions complete and refresh the tree within a second on localhost (SC-001/SC-002/SC-003) — bounded only by a single S3 PUT/DELETE call, same order of magnitude as existing save/upload actions.

**Constraints**: Reuses spec 002's storage layer exclusively (FR-011); delete is scoped to files only, not folders (spec explicitly excludes folder delete); create-file/create-folder names must not contain a path separator and blank/whitespace names are treated as "nothing to create" (FR-007); overwrite requires client-side confirmation before any existing file's content is replaced by a create action (FR-006), mirroring spec 004's upload-overwrite confirmation.

**Scale/Scope**: Single local developer managing individual files/folders one at a time (not batch, unlike spec 004's upload/download); bounded only by what spec 001/002's storage already supports.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` still contains only unfilled template placeholders (same state as specs 001-004). No concrete gates exist to evaluate against, so this check trivially passes with no violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-file-create-delete/
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
├── editor/
│   ├── page.tsx           # (existing, spec 003 — extended: onFileDeleted clears selectedPath when the open file is removed, research.md §3)
│   ├── FileTree.tsx        # (existing, spec 003/004 — extended: per-file Delete action; per-directory New file/New folder actions, research.md §2)
│   ├── FileEditor.tsx       # (existing, spec 003 — unchanged)
│   ├── MarkdownEditor.tsx    # (existing, spec 003 — unchanged)
│   ├── PlainTextEditor.tsx   # (existing, spec 003 — unchanged)
│   └── Icons.tsx             # (existing, spec 003/004 — extended: NewFileIcon, NewFolderIcon, TrashIcon)
└── api/
    ├── tree/route.ts       # (existing, spec 003 — unchanged)
    ├── file/route.ts        # (existing, spec 003 — extended: POST creates a file, DELETE removes one, contracts/api-routes.md)
    ├── directory/route.ts    # NEW — POST, creates a directory (contracts/api-routes.md)
    ├── upload/route.ts       # (existing, spec 004 — unchanged)
    └── download-zip/route.ts  # (existing, spec 004 — unchanged)

lib/
├── storage/
│   ├── files.ts            # (existing, spec 002 — unchanged; reused as-is: createFile, deleteFile)
│   └── directories.ts       # (existing, spec 002 — unchanged; reused as-is: createDirectory)
└── mcp-tools/              # (existing, spec 002 — unchanged)
```

**Structure Decision**: Everything lives inside the existing spec 002/003/004 Next.js app — no new project. `app/api/file/route.ts` gains `POST`/`DELETE` handlers alongside its existing `GET`/`PUT`; a new sibling `app/api/directory/route.ts` gains a `POST` handler — both thin Route Handlers that call already-existing, untouched `lib/storage/*` functions (research.md §1). `app/editor/FileTree.tsx` gains a Delete button per file row and New file/New folder buttons per directory row, following the exact inline-icon-button + hidden-input-or-prompt pattern spec 004 used for upload/download (research.md §2). `app/editor/page.tsx` gains one new callback prop so deleting the currently-open file closes it (research.md §3, FR-003).

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
