# Implementation Plan: MCP Tool Toggle

**Branch**: `023-mcp-tool-toggle` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-mcp-tool-toggle/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Let an operator disable individual MCP tools via a single environment variable, `MCP_DISABLED_TOOLS` (comma-separated tool names, denylist semantics). A deny-listed tool is never registered with the MCP server — never `server.registerTool()`-ed — so it is both absent from `tools/list` and, if called anyway, fails with the server's ordinary "unknown tool" error rather than a distinguishable one. Implemented via one new shared gate helper (`registerGatedTool`, `frontend/lib/mcp-tools/toolGate.ts`) that all 5 existing tool-registration modules call instead of `server.registerTool` directly; no tool's behavior changes when it isn't disabled.

## Technical Context

**Language/Version**: TypeScript, Next.js 16 (App Router), Node.js runtime — same as the rest of `frontend/`. No new language/runtime.

**Primary Dependencies**: `@modelcontextprotocol/sdk` (its existing `registerTool`/`tools/list` behavior, read directly from `node_modules` during research — no SDK upgrade or new dependency needed).

**Storage**: N/A — this feature reads only `process.env` at server startup; nothing is written to or read from the S3 bucket.

**Testing**: No automated test framework exists in this repo (research.md §5) and none is introduced for this feature — verification is the manual `quickstart.md` scenario walkthrough, consistent with specs 002, 011, and 022.

**Target Platform**: Same as the rest of the app — stateless Next.js Route Handler, deployable to Vercel or run locally; no platform-specific behavior.

**Project Type**: Web service extension — a small addition to the existing single Next.js app (`frontend/`), not a new project/service.

**Performance Goals**: Negligible — parsing one short comma-separated string happens at most once per tool per server start (17 times), not per-request.

**Constraints**: Must not change the behavior of any tool that isn't in the deny-list (SC-002); a disabled tool's call-time failure must be indistinguishable from calling a name the server has never registered (FR-004) — this rules out the SDK's own built-in per-tool `disable()`, which produces a distinguishable error message (research.md §1).

**Scale/Scope**: 17 existing tools across 5 registration modules (`index.ts` 8, `engineTools.ts` 3, `messagingTools.ts` 2, `inboxTools.ts` 1, `treeTools.ts` 3); the mechanism must be trivially reusable by any tool added later.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no project-specific principles have been ratified) — there are no gates to evaluate against. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/023-mcp-tool-toggle/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── mcp-tool-toggle-config.md    # Phase 1 output (/speckit-plan command)
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This repo has no separate backend/frontend split to choose between — everything deployable lives in the single `frontend/` Next.js app (see repo root `README.md` and spec 006-frontend-folder-structure). This feature only adds one new file and mechanically edits five existing ones inside it, following the existing `lib/mcp-tools/` (tool registration) layering:

```text
frontend/
├── lib/
│   └── mcp-tools/
│       ├── toolGate.ts         # NEW — isToolEnabled(name), registerGatedTool(server, ...args)
│       ├── index.ts            # existing — 8 core tools; server.registerTool(...) calls become registerGatedTool(server, ...)
│       ├── engineTools.ts      # existing — same change, including the loop over ENGINE_TOOLS (3 tools)
│       ├── messagingTools.ts   # existing — same change (2 tools)
│       ├── inboxTools.ts       # existing — same change (1 tool)
│       └── treeTools.ts        # existing — same change (3 tools)
└── .env.example                 # existing — documents MCP_DISABLED_TOOLS alongside MCP_BOOTSTRAP_PATH
```

**Structure Decision**: One new file (`lib/mcp-tools/toolGate.ts`) holding the gate predicate and the pass-through registration wrapper, plus a mechanical one-line change at each of the 17 existing `server.registerTool(...)` call sites across the 5 existing registration modules (rename the call to `registerGatedTool(server, ...)`, add the import). `frontend/app/mcp/route.ts` is untouched — it already calls all 5 `register*Tools(server)` functions, and this feature changes what happens *inside* them, not which functions are called. No existing tool's config or handler changes.

## Complexity Tracking

*No constitution gates apply (see Constitution Check above) — this section is not needed.*
