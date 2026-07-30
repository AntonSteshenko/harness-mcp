# Phase 0 Research: Dedicated Inbox MCP Tool

No open unknowns remained in the Technical Context — this feature reuses
existing, already-proven patterns from specs 010/016/017. This document
records the decisions and the alternatives considered instead of leaving a
placeholder.

## 1. Tool implementation: thin wrapper vs. new storage function

**Decision**: Implement `get_inbox` as a thin MCP-tool wrapper that calls the
existing `readFile("data/inbox.md")` from `lib/storage/files.ts`, with no new
storage-layer function.

**Rationale**: `readFile()` already does exactly what's needed — reads full
content from S3, throws `StorageError("not_found", …)` when the key is
absent, and `StorageError("storage_unreachable", …)` on connectivity
failures. Both of those are exactly the two distinguishable outcomes FR-004/
FR-005 require. Adding a parallel `readInbox()` storage function would
duplicate that logic for no behavioral gain.

**Alternatives considered**: A dedicated `getInboxContent()` function in
`lib/storage/files.ts` — rejected as unnecessary indirection; the path is a
constant known only to the MCP-tool layer, not a storage-layer concern.

## 2. Fixed path

**Decision**: Hard-code `data/inbox.md` as the path inside `inboxTools.ts`
(mirroring how `engineTools.ts` hard-codes its bundled-file paths), rather
than making it configurable.

**Rationale**: Per spec 017's `init.md` blueprint, every business OS gets
exactly one inbox at that fixed path. There is no multi-inbox concept to
parameterize (Assumptions in spec.md).

**Alternatives considered**: An environment variable for the inbox path —
rejected; nothing else in the codebase makes storage-internal paths
configurable, and there is no requirement driving it.

## 3. Tool description framing

**Decision**: Build the `get_inbox` tool's description with
`buildEntryDescription()` from `lib/mcp-tools/bootstrap.ts`, the same helper
`read_file` uses in `index.ts`.

**Rationale**: `get_inbox` reads live storage content (not bundled,
code-shipped content like `engineTools.ts`'s `get_os_engine`/`get_os_init`),
so it belongs in the same "entry tool" framing category as `read_file` /
`list_directory` — the bootstrap-file guidance (spec 010) is exactly as
relevant here as it is for any other storage read.

**Alternatives considered**: No framing (plain description, like
`engineTools.ts`) — rejected because `engineTools.ts`'s tools intentionally
skip framing since they return fixed, bundled instructional content unrelated
to the connected storage account, which doesn't apply here.

## 4. Registration wiring

**Decision**: Add a new `registerInboxTools(server)` export from a new
`lib/mcp-tools/inboxTools.ts`, called from `app/mcp/route.ts` alongside the
three existing `register*` calls.

**Rationale**: Matches the established one-module-per-concern pattern
(`index.ts` for CRUD file tools, `engineTools.ts` for spec 016,
`messagingTools.ts` for spec 017) rather than growing an existing file with
an unrelated tool.

**Alternatives considered**: Adding `get_inbox` directly inside `index.ts` —
rejected to keep that file scoped to generic, path-parameterized file/
directory operations; `get_inbox` is a purpose-specific shortcut, matching why
`engineTools.ts` and `messagingTools.ts` are separate files.
