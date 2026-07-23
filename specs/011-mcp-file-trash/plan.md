# Implementation Plan: MCP File Trash

**Branch**: `011-mcp-file-trash` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-mcp-file-trash/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

`delete_file` and `delete_directory` (spec 002/005) currently remove content permanently on a single MCP tool call, with no way to recover an accidental deletion. This feature changes both tools' behavior at the storage layer only: a delete on a path outside the reserved `Trash` folder now moves the item into a per-deletion timestamped subfolder under `Trash` instead of destroying it; a delete on a path already under `Trash` permanently removes it, as before. Because the web file editor's API routes call the same storage functions directly, this is a storage-layer change with no new MCP tools and no required web UI changes — restore uses the existing `move` tool, and emptying `Trash` uses `delete_directory` on `Trash` itself.

## Technical Context

**Language/Version**: TypeScript 5.9 (Next.js 16 App Router, Node.js runtime)

**Primary Dependencies**: `@aws-sdk/client-s3` 3.1090.0 (S3-compatible storage client), `@modelcontextprotocol/sdk` 1.26.0 + `mcp-handler` (MCP tool surface, spec 002), `zod` (tool input schemas)

**Storage**: S3-compatible object storage (MinIO, spec 001), single pre-configured bucket via `frontend/lib/storage/client.ts`

**Testing**: No automated test suite in this project; changes are validated against a running `next dev` instance plus the spec 001 MinIO stack via a scripted MCP tool-call sequence (`quickstart.md`), consistent with specs 001/002/005

**Target Platform**: Linux server / local dev; same Next.js Route Handler (Streamable HTTP transport) that already hosts every other MCP tool

**Project Type**: web — single Next.js app (`frontend/`) housing both the MCP server route and the file editor UI/API routes over one shared storage layer

**Performance Goals**: No new targets; reuses the existing batched-delete (≤1000 keys/call) and copy-then-delete move mechanics already used by `deleteDirectory`/`move`

**Constraints**: No new MCP tools may be introduced (spec Assumptions); "is this path already in Trash" is determined purely by path prefix — no new metadata store or database

**Scale/Scope**: Same scale as existing file/directory operations — single bucket, single active client per session (spec 002's concurrency assumption, unchanged by this feature)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (all sections are placeholders — no ratified principles exist for this project). No gates apply; nothing to check against. Re-confirmed after Phase 1: still N/A.

## Project Structure

### Documentation (this feature)

```text
specs/011-mcp-file-trash/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── mcp-tools-trash.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── lib/
│   ├── storage/
│   │   ├── trash.ts         # NEW: Trash path helpers (isUnderTrash, trashDestinationFor)
│   │   ├── files.ts         # MODIFIED: deleteFile branches to move-into-Trash vs. permanent delete
│   │   ├── directories.ts   # MODIFIED: deleteDirectory branches to move-into-Trash vs. permanent delete
│   │   ├── move.ts          # UNCHANGED: reused internally to perform the move-into-Trash
│   │   └── paths.ts         # UNCHANGED: normalizeFilePath/normalizeDirectoryPath reused as-is
│   └── mcp-tools/
│       └── index.ts         # MODIFIED: delete_file/delete_directory tool descriptions updated
└── app/api/
    ├── file/route.ts        # UNCHANGED: DELETE handler already calls deleteFile — inherits new behavior automatically
    └── directory/route.ts   # UNCHANGED: DELETE handler already calls deleteDirectory — inherits new behavior automatically
```

**Structure Decision**: This feature lives entirely inside the existing single Next.js app (`frontend/`) established by specs 001–010 — no new project, service, or top-level directory. It is implemented once in the shared storage layer (`frontend/lib/storage/`), which both the MCP tools (`frontend/lib/mcp-tools/index.ts`) and the web file editor's API routes already call through, so the soft-delete behavior applies uniformly without touching the API routes or UI.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — Constitution Check is N/A (unfilled template project).
