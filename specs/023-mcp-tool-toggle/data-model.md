# Data Model: MCP Tool Toggle

**Input**: [spec.md](spec.md), [research.md](research.md)

This feature introduces no persisted or stored data — nothing is written to the S3 bucket, and no new request/response shape is added to any tool. The only "data" is a single piece of process configuration, read at server startup.

## Tool Disable Configuration

Read once per server process from the environment variable `MCP_DISABLED_TOOLS` (research.md §3).

| Field | Type | Notes |
|---|---|---|
| Raw value | `string \| undefined` | The literal `MCP_DISABLED_TOOLS` environment value. Absent or empty ⇒ deny-list is empty (spec.md FR-002). |
| Disabled tool names | `Set<string>` | Derived from the raw value: split on `,`, trim each entry, drop empty strings. Case-sensitive, compared for exact equality against a tool's registered name. |

## Tool Name (existing concept, not new)

The deny-list's entries are matched against the literal strings each tool is already registered under today — no new identifier scheme is introduced. The full set this feature must be able to address (spec.md FR-006):

`create_file`, `read_file`, `delete_file`, `create_directory`, `list_directory`, `delete_directory`, `update_file`, `move`, `get_os_engine`, `get_os_upgrade`, `get_os_init`, `send_email`, `send_telegram_message`, `get_inbox`, `list_directory_tree`, `find_files_by_name`, `search_file_content`.

## State / Lifecycle

There is no runtime state transition — a tool's enabled/disabled status is fixed for the lifetime of the server process, decided once at the moment each `register*Tools(server)` function runs during server startup (spec.md FR-008, Edge Cases: "no effect until the next server start").
