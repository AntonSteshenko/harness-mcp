# Implementation Plan: MCP Binary File Upload Tool

**Branch**: `029-mcp-binary-upload` | **Date**: 2026-08-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/029-mcp-binary-upload/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add two new MCP tools — `create_binary_file` and `read_binary_file` — that let a connected agent write and read binary content (base64-encoded over the wire, raw bytes in storage) through the same S3-backed storage every other file tool already uses. Both reuse infrastructure spec 028 already built for the browser upload: `lib/storage/fileTypes.ts`'s allow-list/size-cap/MIME lookup, `lib/storage/files.ts`'s now-`Buffer`-based `createFile`/`readFile`, and `lib/storage/errors.ts`'s `unsupportedType`/`tooLarge` helpers — so a file type or size rejected from the browser is rejected here too, by construction, not by parallel logic (Clarification: allow-list parity). `create_binary_file` decodes and validates its base64 input (rejecting malformed base64 before ever touching storage) then calls `createFile` exactly like `create_file` does for text — same overwrite-if-file/fail-if-directory semantics, no separate "update" tool (Clarification). The existing `read_file` tool gains a binary guard (extracted from the web app's existing extension + content-sniffing check, spec 003/018/028) so it now fails clearly on a binary file instead of silently returning UTF-8-corrupted text (Clarification, FR-010); `read_binary_file` is the new, separate tool that returns a binary file's exact bytes as base64 (Clarification, FR-009). Both new tools follow this codebase's established per-feature-area module pattern (a new `lib/mcp-tools/binaryFileTools.ts`, registered from `app/mcp/route.ts` alongside `registerTools`/`registerTreeTools`/etc.) and are added to `lib/mcp-tools/catalog.ts` so the existing `/tools` status/toggle page (spec 023/024) can list and disable them like any other tool — no new authorization or gating mechanism (FR-008). One cross-cutting fix is required beyond the two new tools: base64-encoding a 25 MB file produces roughly 33.3 MB of text, which — because `/mcp` passes through the same Next.js proxy/middleware layer as every other route — would exceed the 30 MB cap spec 028 set in `next.config.ts` to fix an analogous truncation bug on the browser upload; that cap needs raising to comfortably clear a full-size base64 payload.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router), Node.js — unchanged from spec 028 and every prior MCP-tool spec (002, 010, 017, 020, 022, 023)

**Primary Dependencies**: `@modelcontextprotocol/sdk` (existing — tool registration, `CallToolResult`), `zod` (existing — input schema validation). No new runtime dependency; base64 decode/validate uses Node's built-in `Buffer` (already used throughout `lib/storage/files.ts`).

**Storage**: No change to the storage backend or addressing scheme. Reuses spec 028's `Buffer`-based `createFile`/`readFile` (`lib/storage/files.ts`) and its allow-list/size-cap/MIME module (`lib/storage/fileTypes.ts`) unmodified — this feature is a new *entry point* into that same storage layer, not a new storage mechanism.

**Testing**: No automated test suite exists in this project (specs 001–028 all validate via a runnable `quickstart.md` walkthrough instead, using authenticated `curl`/an MCP client against the real `/mcp` endpoint) — this feature follows the same convention. Per user instruction, tests are not run as part of this work.

**Target Platform**: Node.js server; runs locally (`npm run dev`) and deploys to Vercel — same `/mcp` route (`app/mcp/route.ts`) every existing MCP tool already registers on; no new route.

**Project Type**: Web application — single Next.js project (`frontend/`); no new project/service.

**Performance Goals**: A 25 MB binary upload/read via MCP completes within the same practical bounds as the browser upload (spec 028 SC-001: file appears within 10 seconds) — base64 decode/encode of an already-in-memory buffer is fast (milliseconds), so end-to-end time is dominated by the S3 read/write itself, unchanged from spec 028's measurements.

**Constraints**: Must decode base64 into raw bytes before ever calling `createFile` — never pass the base64 string through as content (the exact bug this feature exists to fix, per the user's original request). Must validate base64 strictly (reject malformed input) before any storage write, so a bad call can never partially corrupt a file. Must apply the identical allow-list and 25 MB cap the browser upload enforces (Clarification) — achieved by importing the same `lib/storage/fileTypes.ts` functions, not reimplementing them. Must not change `read_file`'s behavior for text files in any way (Clarification, FR-010) — only its behavior for files that are actually binary. Must raise `next.config.ts`'s `experimental.proxyClientMaxBodySize` (currently `"30mb"`, set by spec 028) high enough to clear a base64-encoded 25 MB file (≈33.3 MB) plus JSON-RPC/tool-call envelope overhead — verified empirically against a live `/mcp` request, the same way spec 028's original 10 MB truncation bug was caught, since this is exactly the kind of platform default that doesn't show up in a type-check or a unit-level read of the code.

**Scale/Scope**: Single owner's MCP server, per-call file size up to 25 MB (same cap as spec 028). Touches: `lib/storage/errors.ts` (new `invalid_content` `StorageErrorCode`, mapped 400, plus the existing four `STATUS_BY_CODE` maps in the web routes that must stay total), `lib/storage/fileTypes.ts` (no functional change — reused as-is), a refactor extracting the binary-detection logic already living in `app/api/file/route.ts` into a shared, importable function so both the web route and the new MCP tools use one implementation, `lib/mcp-tools/index.ts` (`read_file`'s handler gains the binary guard), `lib/mcp-tools/catalog.ts` (+2 entries), `app/mcp/route.ts` (+1 `register*Tools` call), `next.config.ts` (raise the body-size cap). One new file: `lib/mcp-tools/binaryFileTools.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still unfilled template placeholder content — no project principles have been ratified yet, so there are no gates to check against. Nothing to re-check post-design.

## Project Structure

### Documentation (this feature)

```text
specs/029-mcp-binary-upload/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── mcp-tools-binary.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   └── mcp/
│       └── route.ts                     # CHANGED: imports and calls the new
│                                         # registerBinaryFileTools(server,
│                                         # disabledTools), alongside the
│                                         # existing register*Tools calls
├── lib/
│   ├── mcp-tools/
│   │   ├── index.ts                     # CHANGED: read_file's handler now
│   │   │                                # runs the shared binary guard
│   │   │                                # (from storage/binaryDetection.ts)
│   │   │                                # before decoding content as text,
│   │   │                                # returning a clear invalid_content-
│   │   │                                # style error instead of corrupted
│   │   │                                # text (FR-010)
│   │   ├── binaryFileTools.ts           # NEW: registerBinaryFileTools —
│   │   │                                # create_binary_file (FR-001–FR-007,
│   │   │                                # FR-011) and read_binary_file
│   │   │                                # (FR-009), both gated the same way
│   │   │                                # every other tool is (FR-008)
│   │   └── catalog.ts                   # CHANGED: +2 entries
│   │                                     # (create_binary_file,
│   │                                     # read_binary_file), group
│   │                                     # "File & Directory"
│   └── storage/
│       ├── binaryDetection.ts           # NEW: extension list + content-
│       │                                # sniffing check, factored out of
│       │                                # app/api/file/route.ts so the web
│       │                                # route and the MCP tools share one
│       │                                # binary/text determination instead
│       │                                # of two independently-maintained
│       │                                # copies
│       ├── fileTypes.ts                 # UNCHANGED — allow-list, size cap,
│       │                                # MIME lookup already built in spec
│       │                                # 028, reused as-is
│       ├── files.ts                     # UNCHANGED — Buffer-based
│       │                                # createFile/readFile already built
│       │                                # in spec 028, reused as-is
│       └── errors.ts                    # CHANGED: new invalid_content
│                                         # StorageErrorCode + helper
├── app/api/file/route.ts                # CHANGED: GET's binary check now
│                                         # calls the extracted
│                                         # lib/storage/binaryDetection.ts
│                                         # instead of its own local
│                                         # copy — behavior unchanged, just
│                                         # de-duplicated
├── app/api/{directory,tree,download-zip}/route.ts
│                                         # CHANGED: STATUS_BY_CODE maps gain
│                                         # invalid_content: 400 (required for
│                                         # the widened StorageErrorCode union
│                                         # to type-check, same mechanical fix
│                                         # spec 028 needed for its own two
│                                         # new codes)
└── next.config.ts                       # CHANGED: proxyClientMaxBodySize
                                          # raised from "30mb" to comfortably
                                          # exceed a base64-encoded 25 MB
                                          # file (≈33.3 MB) plus envelope
                                          # overhead
```

**Structure Decision**: Single Next.js project at `frontend/` (unchanged from spec 006). One new MCP-tools module (`lib/mcp-tools/binaryFileTools.ts`) following the existing `treeTools.ts`/`inboxTools.ts`/`engineTools.ts` pattern — a dedicated file per feature area, registered once from `app/mcp/route.ts`. One new storage-layer module (`lib/storage/binaryDetection.ts`) extracted from existing code to eliminate a would-be duplicate binary-detection implementation between the web route and the new MCP tools.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
