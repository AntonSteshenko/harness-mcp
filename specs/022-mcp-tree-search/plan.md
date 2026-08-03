# Implementation Plan: MCP Tree Search Tools

**Branch**: `022-mcp-tree-search` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-mcp-tree-search/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add three new, read-only MCP tools — `list_directory_tree`, `find_files_by_name`, `search_file_content` — that let a connected assistant map or search the whole storage tree in one call instead of one `list_directory` call per level. All three are built on a single new shared traversal helper (`walkTree`, generalized from the existing `listFilesRecursive` in `frontend/lib/storage/directories.ts`), reuse the existing error contract and Trash-exclusion logic, and are additive: none of the 8 existing file/directory tools change.

## Technical Context

**Language/Version**: TypeScript, Next.js 16 (App Router), Node.js runtime — same as the rest of `frontend/`. No new language/runtime.

**Primary Dependencies**: `@modelcontextprotocol/sdk` + `mcp-handler` (tool registration/transport), `@aws-sdk/client-s3` (storage), `zod` (input schemas) — all already in use; no new dependencies added.

**Storage**: The existing single S3-compatible bucket (spec 001/007) — these tools are read-only over the same bucket every other tool already reads/writes.

**Testing**: No automated test framework exists in this repo (research.md §7) and none is introduced for this feature — verification is the manual `quickstart.md` scenario walkthrough, consistent with specs 002 and 011.

**Target Platform**: Same as the rest of the app — stateless Next.js Route Handler, deployable to Vercel or run locally; no platform-specific behavior.

**Project Type**: Web service extension — new module inside the existing single Next.js app (`frontend/`), not a new project/service.

**Performance Goals**: A caller should be able to map or search a directory tree of a few hundred entries in one round trip, fast enough to feel like a single interactive step (SC-004) rather than the current one-round-trip-per-level cost.

**Constraints**: Response size/latency bounded by a fixed entry cap (`MAX_TREE_ENTRIES`, research.md §3) with an explicit `truncated` flag rather than silent truncation or pagination; content search restricted to Markdown files only (research.md §5); Trash excluded from all results by default (research.md §2).

**Scale/Scope**: Real Company OS trees are expected to be hundreds, not millions, of entries (spec.md Assumptions) — the design is not built for arbitrarily large trees, matching the storage's actual usage pattern.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no project-specific principles have been ratified) — there are no gates to evaluate against. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/022-mcp-tree-search/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── mcp-tools-tree.md            # Phase 1 output (/speckit-plan command)
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This repo has no separate backend/frontend split to choose between — everything deployable lives in the single `frontend/` Next.js app (see repo root `README.md` and spec 006-frontend-folder-structure). This feature only adds files within it, following the existing `lib/storage/` (data access) + `lib/mcp-tools/` (tool registration) layering:

```text
frontend/
├── lib/
│   ├── storage/
│   │   ├── directories.ts      # existing — listDirectory, deleteDirectory, listFilesRecursive (generalized by tree.ts, not removed)
│   │   ├── trash.ts            # existing — isUnderTrash (reused, unchanged)
│   │   ├── errors.ts           # existing — StorageError/codes (reused, unchanged)
│   │   ├── files.ts            # existing — readFile (reused by search_file_content)
│   │   └── tree.ts             # NEW — walkTree(path, opts) shared traversal, MAX_TREE_ENTRIES
│   └── mcp-tools/
│       ├── index.ts            # existing — 8 core tools (untouched, SC-005)
│       ├── engineTools.ts       # existing — pattern this feature follows
│       ├── messagingTools.ts    # existing — pattern this feature follows
│       ├── inboxTools.ts        # existing — pattern this feature follows
│       └── treeTools.ts         # NEW — registerTreeTools(server): list_directory_tree, find_files_by_name, search_file_content
└── app/
    └── mcp/
        └── route.ts             # existing — add one line: await registerTreeTools(server)
```

**Structure Decision**: New logic lives in two new files (`lib/storage/tree.ts`, `lib/mcp-tools/treeTools.ts`), following the repo's existing storage/tool-registration split and its existing "one file per tool-area" convention (engineTools.ts, messagingTools.ts, inboxTools.ts). `route.ts` gets a single added line to register the new tools alongside the existing ones. No existing file's behavior changes.

## Complexity Tracking

*No constitution gates apply (see Constitution Check above) — this section is not needed.*
