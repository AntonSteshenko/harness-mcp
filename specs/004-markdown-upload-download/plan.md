# Implementation Plan: Markdown Upload & Folder Download

**Branch**: `004-markdown-upload-download` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-markdown-upload-download/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add upload and folder-download actions to the existing spec 003 file tree (`app/editor/FileTree.tsx`), scoped exclusively to `.md` files. Uploading (single/multiple files or an entire local folder) reads text client-side via the browser File API and posts a batch to a new `POST /api/upload` route, which calls the existing `lib/storage/files.ts#createFile` per accepted `.md` entry (research.md §3, §5). Downloading a folder recursively lists every `.md` file under it via a new `listFilesRecursive` helper added to `lib/storage/directories.ts` (composing the existing `listDirectory`), reads each with the existing `readFile`, and streams them into a single zip built with `jszip` in a new `GET /api/download-zip` route (research.md §1, §2). No new storage backend or persisted entity is introduced — this is purely an additional consumer of `lib/storage/*`, exactly like spec 003 itself (FR-011).

## Technical Context

**Language/Version**: TypeScript on Node.js (same app as specs 002/003 — Next.js ≥ 18.18 requirement, current Node.js LTS)

**Primary Dependencies**: `jszip` (new — in-memory zip archive construction for `GET /api/download-zip`, research.md §1); browser `File`/`FileReader` APIs and the non-standard-but-widely-supported `webkitdirectory` input attribute (native, no new dependency, research.md §3–§4) for reading uploaded `.md` files' text and relative paths; everything else (Next.js, `@aws-sdk/client-s3` via `lib/storage/*`) is already in the project

**Storage**: The spec 001 local MinIO storage, accessed exclusively through spec 002's existing `lib/storage/files.ts` (`createFile`, `readFile`) and `lib/storage/directories.ts` (`listDirectory`, plus a new small `listFilesRecursive` helper composed from it) — this feature adds no new storage access primitives, only a recursive-listing convenience wrapper (research.md §2)

**Testing**: No automated test suite requested; validated via the browser-driven walkthrough in quickstart.md, consistent with specs 001–003

**Target Platform**: Same developer-local Next.js dev server as specs 002/003 (`npm run dev`), viewed in a desktop browser

**Project Type**: Web application UI/API extension added to the existing spec 002/003 Next.js app — no new project/app is created

**Performance Goals**: Uploading a 50-file batch completes within a few seconds on localhost (SC-002); zip generation for a typical Markdown folder (tens of files, KB-scale each) completes in well under the download's perceived-instant threshold

**Constraints**: Reuses spec 002's storage layer exclusively (FR-011) — no second way of talking to storage; upload/download accept and produce `.md` files only, with non-`.md` files always skipped, never stored or zipped (FR-003, FR-008); overwrite requires client-side confirmation before any existing file's content is replaced (FR-006); zip archives are built fully in memory (`jszip`, not a streaming archiver) given the local-single-developer scale (research.md §1)

**Scale/Scope**: Single local developer uploading/downloading batches of Markdown notes (tens to low hundreds of files); bounded only by what spec 001/002's storage already supports and by holding one zip/one upload batch in memory at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` still contains only unfilled template placeholders (same state as specs 001–003). No concrete gates exist to evaluate against, so this check trivially passes with no violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-markdown-upload-download/
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
│   ├── page.tsx           # (existing, spec 003 — unchanged)
│   ├── FileTree.tsx        # (existing, spec 003 — extended: per-directory Upload files/Upload folder/Download folder actions, research.md §3–§6)
│   ├── FileEditor.tsx       # (existing, spec 003 — unchanged)
│   ├── MarkdownEditor.tsx    # (existing, spec 003 — unchanged)
│   ├── PlainTextEditor.tsx   # (existing, spec 003 — unchanged)
│   └── Icons.tsx             # (existing, spec 003 — extended: Upload/Download icons)
└── api/
    ├── tree/route.ts       # (existing, spec 003 — unchanged)
    ├── file/route.ts        # (existing, spec 003 — unchanged)
    ├── upload/route.ts       # NEW — POST, batch-creates .md files from an upload (contracts/api-routes.md)
    └── download-zip/route.ts  # NEW — GET, zips all .md files under a folder (contracts/api-routes.md)

lib/
├── storage/
│   ├── files.ts            # (existing, spec 002 — unchanged; reused as-is: createFile, readFile)
│   └── directories.ts       # (existing, spec 002 — extended: new listFilesRecursive helper, contracts/api-routes.md)
└── mcp-tools/              # (existing, spec 002 — unchanged)
```

**Structure Decision**: Everything lives inside the existing spec 002/003 Next.js app — no new project. `app/editor/FileTree.tsx` gains the upload/download entry points (buttons + hidden `<input>` elements per directory row), and `app/api/` gains two new thin Route Handlers. `lib/storage/directories.ts` gains one new exported helper (`listFilesRecursive`) that composes the existing `listDirectory`; `lib/storage/files.ts` is untouched and reused as-is (research.md §2–§3).

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
