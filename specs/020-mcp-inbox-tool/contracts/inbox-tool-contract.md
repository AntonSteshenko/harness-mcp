# Contract: `get_inbox`

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

**Adds (additively)**: One new MCP tool. No existing tool (spec 002's filesystem tools, spec 016's `get_os_engine`/`get_os_upgrade`/`get_os_init`, spec 017's `send_email`/`send_telegram_message`) is renamed, changed, or removed by this feature.

## Common error shape

Failures follow the same convention every other tool in this server uses (`lib/mcp-tools/result.ts`'s `errorResult()`): `isError: true` with a text content block whose JSON body is `{ code, message }`. This tool reuses the existing `StorageErrorCode` values already thrown by `readFile()` (`lib/storage/errors.ts`) — no new error codes are introduced:

| Code | Meaning |
|---|---|
| `not_found` | `data/inbox.md` does not exist yet (OS not initialized, or the file was moved/deleted) (FR-004). |
| `type_mismatch` | Something exists at `data/inbox.md` but is a directory, not a file (pre-existing `readFile()` behavior, surfaced unchanged). |
| `storage_unreachable` | The underlying storage could not be reached (FR-005). |

## `get_inbox`

Returns the full current content of the fixed inbox file, `data/inbox.md`.

- **Input**: `{}` — no parameters. The path is fixed and not caller-supplied (FR-001, spec.md Assumptions).
- **Output**: `{ path: string, content: string, size: number, lastModified: string, etag: string }` — the exact `FileContent` shape `readFile()` already returns, unmodified.
- **Errors**: `not_found`, `type_mismatch`, `storage_unreachable` (see table above).
- **Behavior notes**:
  - Read-only: makes no write, create, or delete call (FR-002).
  - Always reads storage directly on every call — no response caching (FR-003).
  - Returns the header-only content unchanged (not an error) when the inbox has just been emptied by a weekly review (spec.md Acceptance Scenario US1.2).
- **Satisfies**: spec 020 FR-001, FR-002, FR-003, FR-004, FR-005, FR-006.

## Cross-cutting

- Does not replace or restrict `read_file` — an assistant can still read `data/inbox.md` (or any other path) via the existing generic tool; `get_inbox` is an additive, purpose-named shortcut (spec.md Assumptions).
- Introduces no new write capability for the inbox — capturing a new item or emptying the inbox during a weekly review continues to go through the existing generic file tools (`create_file`/`update_file`), unchanged by this feature.
