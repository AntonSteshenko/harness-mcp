# Contract: Tool Description Framing

**Input**: [spec.md](../spec.md), [research.md](../research.md), [data-model.md](../data-model.md)

This is the contract between the bootstrap file's content and the `description` string a connecting MCP client sees for each of the 8 tools in `frontend/lib/mcp-tools/index.ts`, generated fresh on every request per research.md §1. Tool names, `inputSchema`, and handler behavior are entirely out of scope here — unchanged from spec 002/003/005.

## Tool categories

| Category    | Tools                                                                 | Framing        |
|-------------|------------------------------------------------------------------------|----------------|
| Entry tools | `read_file`, `list_directory`                                          | Long (below)   |
| Write tools | `create_file`, `update_file`, `move`, `create_directory`, `delete_directory`, `delete_file` | Short (below) |

## Templates

Let `{context}` = `BootstrapMarkers.context` (data-model.md), `{triggers}` = `BootstrapMarkers.triggers.join(", ")`, and `{bootstrap_path}` = the configured `MCP_BOOTSTRAP_PATH` value.

**Entry tools — both markers present:**

> Access to {context}: a Markdown store. Use it when the user wants: {triggers}. IMPORTANT: before acting, first read "{bootstrap_path}" and follow it.

**Write tools — `context` present:**

> Part of {context}. Before writing, follow {bootstrap_path}.

Both are prepended, followed by a single space, to the tool's existing, unmodified `description` string. The original description is never edited, truncated, or removed.

## Precedence / fallback table

| `MCP_BOOTSTRAP_PATH` configured? | File readable? | `mcp-context` present? | `mcp-triggers` present? | Result |
|---|---|---|---|---|
| No  | — | — | — | Original description only, unchanged (FR-009) |
| Yes | No (missing/unreachable) | — | — | Original description only, unchanged (FR-009) |
| Yes | Yes | No | No | Original description only, unchanged (FR-009) |
| Yes | Yes | Yes | Yes | Full template above, both categories (FR-006, FR-007) |
| Yes | Yes | Yes | No | Entry tools: template with the "Use it when the user wants: ..." clause omitted. Write tools: template unchanged (doesn't use `{triggers}`) (FR-010). |
| Yes | Yes | No | Yes | Entry tools: template with `{context}` replaced by a generic phrase (e.g. "this storage"). Write tools: same generic-phrase substitution (FR-010). |

No entry in this table ever raises an error or omits a tool from `tools/list` — every path resolves to a `description` string (User Story 3, FR-009).

## Non-goals

- No change to which tools exist, their input schemas, or their success/error result shapes.
- No new MCP method or protocol capability beyond the existing `tools/list`/`tools/call` surface (research.md §6: `notifications/tools/list_changed` is explicitly out of scope for this feature).
