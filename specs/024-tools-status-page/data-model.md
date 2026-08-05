# Data Model: Tools Status Page

**Input**: [spec.md](spec.md), [research.md](research.md)

This feature persists nothing new — no writes, no new storage. It combines two things that already exist: a static list of tool names (new, but not stored data — a code-level constant) and a live boolean per name (spec 023's `isToolEnabled`).

## Tool Catalog Entry

Defined in `frontend/lib/mcp-tools/catalog.ts` as `TOOL_CATALOG: ToolCatalogEntry[]`.

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | The tool's exact registered name (e.g. `send_email`) — must match the literal string each `register*Tools` module registers it under. |
| `group` | `string` | Which registration module the tool belongs to, for display grouping (research.md §5): `"File & Directory"`, `"Engine"`, `"Messaging"`, `"Inbox"`, or `"Tree Search"`. |

17 entries total (spec.md's full list): `create_file`, `read_file`, `delete_file`, `create_directory`, `list_directory`, `delete_directory`, `update_file`, `move` (File & Directory); `get_os_engine`, `get_os_upgrade`, `get_os_init` (Engine); `send_email`, `send_telegram_message` (Messaging); `get_inbox` (Inbox); `list_directory_tree`, `find_files_by_name`, `search_file_content` (Tree Search).

## Tool Status Entry (spec.md's "Key Entity")

Not a stored type — the shape the page computes per request by combining a catalog entry with a live check:

| Field | Type | Source |
|---|---|---|
| `name` | `string` | From the matching `TOOL_CATALOG` entry. |
| `group` | `string` | From the matching `TOOL_CATALOG` entry. |
| `enabled` | `boolean` | `isToolEnabled(name)` (`frontend/lib/mcp-tools/toolGate.ts`, spec 023) — evaluated fresh on every page load, never cached (data-model.md of spec 023 §"State / Lifecycle" already establishes there is no cross-request caching in `isToolEnabled` itself). |

## State / Lifecycle

None beyond what spec 023 already defines: a tool's `enabled` value is fixed for the lifetime of the server process, decided by the current `MCP_DISABLED_TOOLS` value at the moment this page's Server Component runs (i.e., every request, since the page is dynamically rendered — research.md §3). There is no state this feature itself introduces or mutates.
