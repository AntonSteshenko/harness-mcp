# Contract: `MCP_DISABLED_TOOLS` Configuration

**Input**: [spec.md](../spec.md), [research.md](../research.md)

This feature has no new MCP tool, so there is no tool input/output shape to document. Its one external interface is the environment variable operators use to configure it, plus the internal helper future tool authors must use for it to keep working.

## Environment Variable

**Name**: `MCP_DISABLED_TOOLS`

**Location**: `frontend/.env.local` (or however the deployment supplies env vars) — declared for reference in `frontend/.env.example`, following the same convention as `MCP_BOOTSTRAP_PATH` and every other MCP-server-affecting variable in this repo.

**Format**: Zero or more tool names, separated by commas. Example:

```
MCP_DISABLED_TOOLS=send_email,send_telegram_message
```

**Matching rules**:
- Each name is trimmed of surrounding whitespace before matching.
- Empty entries (e.g. a trailing comma) are dropped silently.
- Matching is case-sensitive, exact string equality against a tool's registered name — no substring or fuzzy matching.
- A name that doesn't match any currently-registered tool is ignored: no startup error, no effect on any other tool (spec.md FR-005).
- Unset or empty ⇒ no tools are disabled (spec.md FR-002) — identical to this feature not existing.

**Effect**: Every tool name present in the parsed list is not registered with the MCP server for the lifetime of that server process. It is absent from every connected client's `tools/list` result, and calling it by name fails with the same error the server already returns for any name it has never registered (spec.md FR-003, FR-004).

**Addressable tool names** (spec.md FR-006) — the full set this variable can name today:

| Group | Tool names |
|---|---|
| File/directory (`index.ts`) | `create_file`, `read_file`, `delete_file`, `create_directory`, `list_directory`, `delete_directory`, `update_file`, `move` |
| Engine/bootstrap (`engineTools.ts`) | `get_os_engine`, `get_os_upgrade`, `get_os_init` |
| Messaging (`messagingTools.ts`) | `send_email`, `send_telegram_message` |
| Inbox (`inboxTools.ts`) | `get_inbox` |
| Tree search (`treeTools.ts`) | `list_directory_tree`, `find_files_by_name`, `search_file_content` |

**When it takes effect**: Only at server start. Changing the value while the server is already running has no effect until the next restart (spec.md FR-008).

## Internal Contract: `registerGatedTool`

**Location**: `frontend/lib/mcp-tools/toolGate.ts`

Every `register*Tools(server)` module in `frontend/lib/mcp-tools/` MUST call `registerGatedTool(server, name, config, handler)` instead of `server.registerTool(name, config, handler)` directly for this feature to apply to that tool. A tool registered by calling `server.registerTool` directly bypasses the deny-list entirely.

```ts
function isToolEnabled(name: string): boolean;

function registerGatedTool<T extends Parameters<McpServer["registerTool"]>>(
  server: McpServer,
  ...args: T
): void;
```

`registerGatedTool` forwards its arguments unchanged to `server.registerTool` when `isToolEnabled(name)` is true, and does nothing otherwise. It does not alter `config` or `handler` in any way — a tool's behavior when enabled is identical, byte-for-byte, to its behavior before this feature existed.
