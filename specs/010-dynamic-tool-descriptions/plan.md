# Implementation Plan: Dynamic Tool Descriptions from a Single Bootstrap File

**Branch**: `010-dynamic-tool-descriptions` | **Date**: 2026-07-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-dynamic-tool-descriptions/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a small new module, `frontend/lib/mcp-tools/bootstrap.ts`, that reads the bootstrap file (`MCP_BOOTSTRAP_PATH`, e.g. `assistant/AGENTS.md`) from the existing S3-backed storage via the already-existing `readFile()` (`lib/storage/files.ts`), extracts the optional `mcp-context`/`mcp-triggers` HTML-comment markers, and returns generated framing text (or `null` on any failure). `frontend/lib/mcp-tools/index.ts`'s `registerTools()` — which already runs fresh on every incoming MCP request because `mcp-handler` constructs a brand-new `McpServer` per HTTP POST (research.md §1) — calls this once per `tools/list`-serving request and prepends the long or short framing to each tool's existing, unchanged description text, based on whether the tool is an "entry" tool (`read_file`, `list_directory`) or a "write" tool (`create_file`, `update_file`, `move`, `create_directory`, `delete_directory`, `delete_file`). A short in-memory TTL cache avoids re-reading the file on every single request within a warm serverless instance. No tool name, schema, or handler behavior changes.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router), Node.js 18+ (unchanged from prior specs)

**Primary Dependencies**: None new. Reuses `@modelcontextprotocol/sdk`'s `McpServer.registerTool` (already used in `lib/mcp-tools/index.ts`), `mcp-handler`'s per-request server construction (already in `app/mcp/route.ts`), and `lib/storage/files.ts`'s `readFile()` (already used elsewhere) to read the bootstrap file from the existing S3-compatible bucket.

**Storage**: No new storage backend or schema. The bootstrap file is an ordinary Markdown file living in the same bucket as every other file this server manages (`frontend/lib/storage/*`, spec 001/007); this feature only reads it.

**Testing**: No automated test suite exists in this project (specs 001–009 all validate via a runnable `quickstart.md` walkthrough instead) — this feature follows the same convention; see [quickstart.md](quickstart.md)

**Target Platform**: Node.js server; runs locally (`npm run dev`) and deploys to Vercel — the MCP route (`app/mcp/route.ts`) already runs on the Node runtime (it uses `@aws-sdk/client-s3`), so no runtime change is required

**Project Type**: Web application — single Next.js project (`frontend/`), extending its existing `app/mcp/route.ts` / `lib/mcp-tools/*`; no new project/service is introduced

**Performance Goals**: N/A — one additional cached file read (shared across requests within a short TTL window) per `tools/list`-serving request; not a scale-sensitive feature. A 45-second in-memory TTL cache keeps repeated `tools/list` calls from each re-reading the bootstrap file from S3.

**Constraints**: Must never throw or block `tools/list` regardless of the bootstrap file's state (FR-009, User Story 3 — the spec's own top safety requirement). Must not alter any tool's name, input schema, or handler logic (FR-008) — only the `description` string passed to `registerTool()` changes. Must only add one new environment variable (`MCP_BOOTSTRAP_PATH`), per the feature request.

**Scale/Scope**: Single MCP server process; touches one existing file (`lib/mcp-tools/index.ts`, 8 `registerTool()` calls) and adds one new file (`lib/mcp-tools/bootstrap.ts`); no UI, no new API routes, no new page.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still unfilled template placeholder content — no project principles have been ratified yet, so there are no gates to check against. Nothing to re-check post-design.

## Project Structure

### Documentation (this feature)

```text
specs/010-dynamic-tool-descriptions/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── tool-description-framing.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── lib/
│   └── mcp-tools/
│       ├── bootstrap.ts      # NEW: reads MCP_BOOTSTRAP_PATH via lib/storage/files.ts's
│       │                     # readFile(), extracts the mcp-context/mcp-triggers HTML-
│       │                     # comment markers, caches the parsed result for a short TTL,
│       │                     # and exposes buildEntryDescription()/buildWriteDescription()
│       │                     # that prepend generated framing to a base description string.
│       │                     # Never throws — every failure path resolves to "no framing".
│       ├── index.ts          # CHANGED: registerTools() calls bootstrap.ts once per
│       │                     # invocation and passes the result through
│       │                     # buildEntryDescription()/buildWriteDescription() when
│       │                     # constructing the `description` field for each of the 8
│       │                     # registerTool() calls (read_file/list_directory get the
│       │                     # long framing; create_file/update_file/move/
│       │                     # create_directory/delete_directory/delete_file get the
│       │                     # short framing) — tool names, inputSchema, and handlers
│       │                     # are untouched.
│       └── result.ts         # unchanged
├── .env.example               # CHANGED: documents the new optional MCP_BOOTSTRAP_PATH var
```

**Structure Decision**: Single Next.js project at `frontend/` (unchanged from every prior spec). This feature touches only `lib/mcp-tools/` — the module that already owns tool registration — plus documentation of the one new env var. No new route, no new page, no change to `app/mcp/route.ts` itself (it already calls `registerTools(server)` fresh per request; that existing behavior is what this feature relies on, per research.md §1).

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
