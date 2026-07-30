# Implementation Plan: Dedicated Inbox MCP Tool

**Branch**: `020-mcp-inbox-tool` | **Date**: 2026-07-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-mcp-inbox-tool/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a new, dedicated `get_inbox` MCP tool that returns the full current
content of the fixed, well-known inbox file (`data/inbox.md`) so a connected
assistant no longer needs to know that path or go through the generic
`read_file` tool to check the quick-capture inbox (FR-001/FR-006). The tool
is a thin, read-only wrapper around the existing `readFile()` storage
function (`lib/storage/files.ts`, unchanged) called with that fixed path —
no new storage layer code, no caching (FR-003), and the existing
`StorageError` codes it already throws (`not_found` for a missing file,
`storage_unreachable` for connectivity failures) map directly onto FR-004/
FR-005 without any new error-handling logic. It is registered alongside the
existing `registerTools`/`registerEngineTools`/`registerMessagingTools` calls
in `app/mcp/route.ts`, following the same one-file-per-concern pattern as
`engineTools.ts` (spec 016) and `messagingTools.ts` (spec 017).

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router) — unchanged from prior specs

**Primary Dependencies**: None new. Reuses `@modelcontextprotocol/sdk`'s `McpServer.registerTool` (already used by every other tool module) and `mcp-handler`'s existing `createMcpHandler` wiring in `app/mcp/route.ts`.

**Storage**: No change. Reads the existing S3-backed file store (spec 001/002) via the existing `readFile(path)` in `lib/storage/files.ts`, called with the fixed path `data/inbox.md`. Nothing new is persisted; this feature is read-only (FR-002).

**Testing**: No automated test suite exists in this project (specs 001–019 all validate via a runnable `quickstart.md` walkthrough instead); this feature follows the same convention — see [quickstart.md](quickstart.md).

**Target Platform**: Node.js server (Next.js route handler `app/mcp/route.ts`), same runtime as every other MCP tool — no change.

**Project Type**: Web application — single Next.js project (`frontend/`); no new project/service. One new tool-registration module plus a one-line wiring change.

**Performance Goals**: Not applicable beyond existing `read_file` performance — a single S3 `GetObjectCommand` per call, no polling, no batching.

**Constraints**: MUST NOT cache a previous call's content (FR-003) — every call re-reads storage directly, mirroring `read_file`'s existing behavior (it also does not cache). MUST NOT expose any write capability (FR-002) — no `create`/`update`/`delete` path is added for the inbox. MUST return a `not_found`-coded result when the file is absent, distinguishable in the JSON `code` field from `storage_unreachable` (FR-004/FR-005) — both are already distinct `StorageErrorCode` values thrown by the existing `readFile()`/`wrapStorageError()`, so this requires no new error-mapping code.

**Scale/Scope**: Single new file, `lib/mcp-tools/inboxTools.ts`, one new exported `registerInboxTools(server)` function registering exactly one tool (`get_inbox`), plus a 2-line addition to `app/mcp/route.ts`. No change to `lib/storage/files.ts`, `lib/mcp-tools/index.ts`, `engineTools.ts`, or `messagingTools.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still unfilled template placeholder content — no project principles have been ratified yet, so there are no gates to check against. Nothing to re-check post-design.

## Project Structure

### Documentation (this feature)

```text
specs/020-mcp-inbox-tool/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── inbox-tool-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   └── mcp/
│       └── route.ts                    # CHANGED: import and call
│                                        # registerInboxTools(server) alongside
│                                        # the existing registerTools/
│                                        # registerEngineTools/
│                                        # registerMessagingTools calls
├── lib/
│   ├── mcp-tools/
│   │   └── inboxTools.ts               # NEW: registers the single get_inbox
│                                        # tool. Reads getBootstrapFraming()/
│                                        # buildEntryDescription() from
│                                        # bootstrap.ts (same framing used by
│                                        # read_file in index.ts, since this
│                                        # tool also reads live storage
│                                        # content, unlike the bundled-content
│                                        # engineTools.ts). Calls the existing
│                                        # readFile("data/inbox.md") from
│                                        # lib/storage/files.ts and wraps the
│                                        # result with ok()/errorResult() from
│                                        # result.ts — identical conventions
│                                        # to every tool in index.ts (FR-001
│                                        # through FR-006)
│   └── storage/
│       └── files.ts                    # UNCHANGED — readFile() already
│                                        # throws StorageError("not_found", …)
│                                        # for a missing file and
│                                        # StorageError("storage_unreachable",
│                                        # …) for connectivity failures
│                                        # (FR-004, FR-005), so no change is
│                                        # needed here
```

**Structure Decision**: Single Next.js project at `frontend/` (unchanged from
prior specs). One new tool-registration module (`lib/mcp-tools/inboxTools.ts`)
following the exact pattern of `engineTools.ts`/`messagingTools.ts`, wired in
with a 2-line addition to `app/mcp/route.ts`. No new route, no new storage
function, no new dependency.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
