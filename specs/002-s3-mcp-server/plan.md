# Implementation Plan: S3 Storage MCP Server

**Branch**: `002-s3-mcp-server` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-s3-mcp-server/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Expose the spec 001 local S3 storage as filesystem-like MCP tools (create/read/update/delete files; create/list/delete directories, recursively; move files and directories) — built entirely on Next.js, per the user's request. The MCP server itself is a single Next.js Route Handler using the `mcp-handler` package (Streamable HTTP transport over `@modelcontextprotocol/sdk`), with a thin storage-adapter layer translating filesystem-style paths into S3 operations against MinIO via `@aws-sdk/client-s3` (research.md §1–§5). Directories are emulated via key prefixes with zero-byte marker objects for explicit empty directories (FR-007). No locking (single-client assumption, FR-015) and no file-size ceiling or streaming (FR-016).

## Technical Context

**Language/Version**: TypeScript on Node.js (Next.js requires Node.js ≥ 18.18; use the current Node.js LTS)

**Primary Dependencies**: Next.js (App Router), `mcp-handler` (Vercel's Next.js adapter for `@modelcontextprotocol/sdk`, research.md §1), `@modelcontextprotocol/sdk`, `@aws-sdk/client-s3`, `zod` (MCP tool input-schema validation, a `mcp-handler`/MCP SDK convention)

**Storage**: The spec 001 local, self-hosted MinIO S3 storage, accessed via `@aws-sdk/client-s3` pointed at `http://localhost:${MINIO_API_PORT:-9000}` with `forcePathStyle: true` (research.md §2)

**Testing**: No automated test suite requested in the spec; validated via the scripted MCP tool-call walkthrough in quickstart.md (research.md §9), consistent with spec 001's approach

**Target Platform**: Developer local machine — Next.js dev server (`next dev`) running natively (not containerized, research.md §7), alongside the already-running spec 001 Docker Compose stack

**Project Type**: Web service (single Next.js app exposing one MCP-over-HTTP route) — no frontend UI is in scope; the "client" is any MCP-compatible tool, not a browser

**Performance Goals**: Individual tool calls on typical small files (a few KB) complete in under 2 seconds (SC-004)

**Constraints**: Single active MCP client per session, handled sequentially — no locking/conflict-rejection (FR-015); no file-size ceiling or chunked/streaming transfer (FR-016); must present only filesystem terminology to callers, no S3 concepts leaking through (FR-014); operates against exactly one pre-configured storage location (FR-013)

**Scale/Scope**: One local MCP server instance per developer machine; directory trees at least 5 levels deep must list/navigate correctly (SC-002); recursive directory delete must leave zero orphaned files at up to 100 files (SC-003)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` still contains only unfilled template placeholders (no project-specific principles have been ratified — same state as when spec 001 was planned). There are no concrete gates to evaluate against, so this check trivially passes with no violations to record in Complexity Tracking. If the constitution is filled in later, this feature should be re-checked against it before implementation is considered final.

## Project Structure

### Documentation (this feature)

```text
specs/002-s3-mcp-server/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json              # New: this feature introduces the project's first Node.js/npm project
tsconfig.json
next.config.ts

app/
├── mcp/
│   └── route.ts          # The MCP-over-HTTP endpoint: wires mcp-handler + tool registrations (contracts/mcp-tools.md)
└── layout.tsx             # Minimal required App Router root layout (no real UI in scope)

lib/
├── storage/
│   ├── client.ts          # @aws-sdk/client-s3 client construction against the spec 001 MinIO endpoint (research.md §2)
│   ├── files.ts           # create/read/update/delete File operations (data-model.md File)
│   ├── directories.ts     # create/list/delete Directory operations, prefix + marker-object logic (research.md §3–§4)
│   └── move.ts            # copy-then-delete move logic for both Files and Directories (research.md §5)
└── mcp-tools/
    └── index.ts            # Tool definitions (name, Zod input schema, handler) matching contracts/mcp-tools.md 1:1

.env.example                # MINIO_API_PORT / MINIO_ROOT_USER / MINIO_ROOT_PASSWORD read by lib/storage/client.ts
```

**Structure Decision**: A single Next.js App Router project at the repository root (this is the repo's first Node.js project — spec 001 introduced no `package.json`). The MCP protocol surface lives entirely in one Route Handler (`app/mcp/route.ts`); all S3-to-filesystem translation logic is isolated in `lib/storage/` so it's testable independently of the MCP transport, and `lib/mcp-tools/` is the thin layer connecting the two per the contract in `contracts/mcp-tools.md`. No `tests/` directory is introduced now since no automated test suite was requested (Technical Context → Testing); validation is the `quickstart.md` walkthrough.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
