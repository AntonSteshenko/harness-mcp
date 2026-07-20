# Contract: MCP Tool Surface

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

This is the set of MCP tools exposed by the server (research.md §1: a Next.js Route Handler via `mcp-handler`, Streamable HTTP transport) to any connecting MCP client. All paths are filesystem-style strings (e.g. `notes/todo.txt`, `notes/`) — no S3 concepts (buckets, keys, prefixes) appear in any tool's input or output (FR-014).

Every tool call operates against the single, pre-configured storage location from spec 001 (FR-013); no tool takes a bucket/storage-location parameter.

## Common error shape

Every tool reports failures as a structured MCP tool error (not a thrown/uncaught exception) with one of these `code` values, so a calling client can branch on outcome:

| Code | Meaning | FR |
|---|---|---|
| `not_found` | The target path does not exist. | FR-011 |
| `type_mismatch` | The target path exists but is the wrong kind (e.g. calling `read_file` on a directory, or `list_directory` on a file). | FR-012 (extended to the read-side equivalent) |
| `already_exists` | A create-style operation's target path is occupied by an entry of a *different* type. | FR-012 |
| `storage_unreachable` | The underlying local S3 storage could not be reached. | Edge Cases |

## Tools

### `create_file`

Creates a file at `path` with `content`. If a file already exists at `path`, its content is overwritten (idempotent create). Fails with `already_exists` if a directory exists at `path`.

- **Input**: `{ path: string, content: string }`
- **Output**: `{ path: string, size: number, lastModified: string }`
- **Satisfies**: FR-002, FR-012, FR-016

### `read_file`

Reads the full current content of the file at `path`.

- **Input**: `{ path: string }`
- **Output**: `{ path: string, content: string, size: number, lastModified: string }`
- **Errors**: `not_found` (FR-011) if nothing exists at `path`; `type_mismatch` if `path` is a directory.
- **Satisfies**: FR-003, FR-016

### `update_file`

Replaces the full content of an existing file at `path`. Unlike `create_file`, this requires the file to already exist.

- **Input**: `{ path: string, content: string }`
- **Output**: `{ path: string, size: number, lastModified: string }`
- **Errors**: `not_found` (FR-011) if no file exists at `path`; `type_mismatch` if `path` is a directory.
- **Satisfies**: FR-004 (whole-file overwrite only — no append/find-replace, per Clarifications), FR-016

### `delete_file`

Deletes the file at `path`.

- **Input**: `{ path: string }`
- **Output**: `{ path: string, deleted: true }`
- **Errors**: `not_found` (FR-011) if no file exists at `path`; `type_mismatch` if `path` is a directory (use `delete_directory` instead).
- **Satisfies**: FR-005

### `create_directory`

Creates a directory at `path`. Idempotent if the directory already exists. Fails with `already_exists` if a file exists at `path`.

- **Input**: `{ path: string }`
- **Output**: `{ path: string, created: true }`
- **Satisfies**: FR-007, FR-012

### `list_directory`

Lists the direct children (files and subdirectories) of the directory at `path`. Does not recurse into subdirectories.

- **Input**: `{ path: string }`
- **Output**: `{ path: string, files: Array<{ path: string, size: number, lastModified: string }>, directories: Array<{ path: string }> }`
- **Errors**: `not_found` (FR-011) if no directory exists at `path`; `type_mismatch` if `path` is a file.
- **Satisfies**: FR-006

### `delete_directory`

Deletes the directory at `path` and everything inside it, recursively.

- **Input**: `{ path: string }`
- **Output**: `{ path: string, deleted: true, filesRemoved: number }`
- **Errors**: `not_found` (FR-011) if no directory exists at `path`; `type_mismatch` if `path` is a file (use `delete_file` instead).
- **Satisfies**: FR-008 (SC-003: zero orphaned files after a recursive delete)

### `move`

Moves/renames a file or directory (and, for a directory, everything inside it) from `sourcePath` to `destinationPath`. Works for either a file or a directory — the server detects which one `sourcePath` is and performs the appropriate operation (research.md §5).

- **Input**: `{ sourcePath: string, destinationPath: string }`
- **Output**: `{ sourcePath: string, destinationPath: string, moved: true }`
- **Errors**: `not_found` (FR-011) if nothing exists at `sourcePath`; `already_exists` if something already exists at `destinationPath` (moves never silently overwrite an existing entry — the caller must delete the destination first if replacement is intended).
- **Satisfies**: FR-009 (file), FR-010 (directory, recursive)

## Cross-cutting

- All tools return `storage_unreachable` instead of hanging or crashing if the local MinIO service (spec 001) cannot be reached (Edge Cases).
- Per FR-015, tool calls are handled sequentially within a session; no tool exposes any locking/versioning parameter.
- No tool imposes a file-size limit or supports chunked/partial content transfer (FR-016) — `content` is always the complete file body.
