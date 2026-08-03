# Contract: MCP Tree Search Tool Surface

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

These are three new MCP tools, additive to the existing surface documented in [specs/002-s3-mcp-server/contracts/mcp-tools.md](../../002-s3-mcp-server/contracts/mcp-tools.md). None of the 8 existing tools (`create_file`, `read_file`, `update_file`, `delete_file`, `create_directory`, `list_directory`, `delete_directory`, `move`) change name, input, or output shape (FR-013, SC-005).

All paths are filesystem-style strings, matching every existing tool. The `Trash` directory (spec 011) is excluded from all three tools' results by default (FR-011) — there is no option to include it in this feature.

## Common error shape

Same as [specs/002-s3-mcp-server/contracts/mcp-tools.md](../../002-s3-mcp-server/contracts/mcp-tools.md#common-error-shape) — no new `code` values are introduced:

| Code | Meaning | Applies to |
|---|---|---|
| `not_found` | The starting `path` does not exist. | All three tools |
| `type_mismatch` | The starting `path` exists but is a file, not a directory. | All three tools |
| `storage_unreachable` | The underlying S3 storage could not be reached. | All three tools |

An empty or whitespace-only `query` (on the two search tools) is rejected as a tool input validation error by the MCP input schema itself (FR-010) — this is not one of the codes above; it is surfaced the same way a caller already sees any other malformed tool input.

## Tools

### `list_directory_tree`

Returns the complete nested contents of the directory at `path` — every descendant file and directory, at every depth — in a single call (FR-001). Excludes `Trash`. Truncates and reports `truncated: true` if the subtree has more than the server's response cap.

- **Input**: `{ path: string }` — `""` means the storage root, same convention as `list_directory`.
- **Output**: `{ path: string, entries: Array<{ path: string, kind: "file" | "directory", size?: number, lastModified?: string }>, truncated: boolean }`
- **Errors**: `not_found` if nothing exists at `path`; `type_mismatch` if `path` is a file.
- **Satisfies**: FR-001, FR-002, FR-003, FR-011, FR-012

### `find_files_by_name`

Searches for files and directories whose own name (not full path) contains `query` (case-insensitive), across the subtree rooted at `path` (FR-004, FR-005).

- **Input**: `{ query: string, path?: string }` — `query` must be non-empty after trimming (FR-010); `path` defaults to the storage root when omitted (FR-008).
- **Output**: `{ query: string, matches: Array<{ path: string, kind: "file" | "directory" }>, truncated: boolean }`
- **Errors**: `not_found`/`type_mismatch` on `path` as above; empty match list (not an error) when nothing matches (FR-009).
- **Satisfies**: FR-004, FR-005, FR-008, FR-009, FR-010, FR-011, FR-012

### `search_file_content`

Searches the content of Markdown files for `query` (case-insensitive), across the subtree rooted at `path` (FR-006, FR-007).

- **Input**: `{ query: string, path?: string }` — same validation/defaulting as `find_files_by_name`.
- **Output**: `{ query: string, matches: Array<{ path: string, snippet: string }>, truncated: boolean }`
- **Errors**: `not_found`/`type_mismatch` on `path` as above; a file that isn't Markdown, or that can't be decoded as text, is silently skipped rather than causing a tool error (FR-007); empty match list (not an error) when nothing matches (FR-009).
- **Satisfies**: FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012
