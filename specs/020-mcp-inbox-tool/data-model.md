# Phase 1 Data Model: Dedicated Inbox MCP Tool

No new persisted entity is introduced. This feature only adds a read path
onto data that already exists per spec 017's business-setup blueprint.

## Inbox (existing, read-only here)

Represents the single quick-capture log file at the fixed path
`data/inbox.md` within a connected storage account's business OS.

| Field | Type | Notes |
|---|---|---|
| `content` | string | Full raw Markdown content of the file, exactly as stored — a header line plus zero or more dated one-line captures (per `init.md`'s `data/inbox.md` blueprint). Returned verbatim; this feature does not parse or restructure it. |

**Lifecycle** (unchanged by this feature): created during OS setup (`get_os_init` flow), appended to ad hoc via the existing generic file tools, emptied back to just its header during a weekly review. This feature adds no new lifecycle state — it only reads whatever `content` currently is.

**Relationships**: None beyond being one file among the OS's `data/*` files; no foreign keys or cross-entity references apply to a flat Markdown store.

## Tool Result (new shape, following the existing convention)

Not a persisted entity — the JSON shape returned by the new `get_inbox` tool,
identical in structure to every other tool in this codebase
(`lib/mcp-tools/result.ts`):

- **Success**: `{ path: string, content: string, size: number, lastModified: string, etag: string }` — the exact `FileContent` shape `readFile()` already returns (`lib/storage/files.ts`), passed through unchanged via `ok()`.
- **Failure**: `{ code: "not_found" | "storage_unreachable", message: string }` — the exact `StorageError` shape, passed through unchanged via `errorResult()`.
