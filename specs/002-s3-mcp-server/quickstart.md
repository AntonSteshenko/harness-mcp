# Quickstart: S3 Storage MCP Server

**Input**: [spec.md](./spec.md), [contracts/mcp-tools.md](./contracts/mcp-tools.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes the Next.js app (see plan.md Project Structure) has already been implemented per tasks.md, and that spec 001's local storage stack is available.

## Prerequisites

1. The spec 001 local storage stack is running: from the repo root, `docker compose up -d` (see `specs/001-s3-self-hosted-storage/quickstart.md`).
2. Dependencies installed: `npm install`.
3. The MCP server's own dev server running: `npm run dev` (Next.js on `http://localhost:3000` by default).
4. An MCP client capable of connecting over Streamable HTTP, pointed at the server's MCP route (e.g. `http://localhost:3000/mcp`) — either a generic MCP inspector/CLI client, or a short Node.js script using `@modelcontextprotocol/sdk`'s client.

## 1. Basic file operations (validates User Story 1, FR-002–FR-003, FR-005, FR-011, SC-001, SC-005)

Call `create_file` with `{ path: "hello.txt", content: "hello from mcp" }`.

Expected: response includes `path: "hello.txt"` and a `size`/`lastModified`.

Call `read_file` with `{ path: "hello.txt" }`.

Expected: `content` exactly equals `"hello from mcp"`.

Call `delete_file` with `{ path: "hello.txt" }`.

Expected: `{ deleted: true }`.

Call `read_file` with `{ path: "hello.txt" }` again.

Expected: an error with `code: "not_found"` — not an empty success.

## 2. Directory operations (validates User Story 2, FR-006–FR-008, FR-011, SC-002, SC-003)

Call `create_directory` with `{ path: "notes/" }`.

Expected: `{ created: true }`.

Call `list_directory` with `{ path: "" }` (the root).

Expected: `notes/` appears in `directories`, even though it's empty.

Create two files inside it: `create_file` with `{ path: "notes/a.txt", content: "a" }` and `{ path: "notes/sub/b.txt", content: "b" }` (the latter implicitly creates the `notes/sub/` directory per the storage-adapter behavior).

Call `list_directory` with `{ path: "notes/" }`.

Expected: `files` contains `notes/a.txt`; `directories` contains `notes/sub/` — `notes/sub/b.txt` is **not** flattened into this listing (it's one level deeper).

Call `delete_directory` with `{ path: "notes/" }`.

Expected: `{ deleted: true, filesRemoved: 2 }`. Then `list_directory` on `notes/` returns `not_found`, and `read_file` on both `notes/a.txt` and `notes/sub/b.txt` returns `not_found` — zero orphaned files (SC-003).

## 3. Modify and reorganize (validates User Story 3, FR-004, FR-009–FR-010)

Call `create_file` with `{ path: "draft.txt", content: "v1" }`, then `update_file` with `{ path: "draft.txt", content: "v2" }`.

Expected: `read_file` on `draft.txt` now returns `"v2"`.

Call `move` with `{ sourcePath: "draft.txt", destinationPath: "final.txt" }`.

Expected: `read_file` on `final.txt` returns `"v2"`; `read_file` on `draft.txt` returns `not_found`.

Repeat with a directory: `create_directory` `{ path: "wip/" }`, `create_file` `{ path: "wip/x.txt", content: "x" }`, then `move` `{ sourcePath: "wip/", destinationPath: "done/" }`.

Expected: `read_file` on `done/x.txt` returns `"x"`; `list_directory` on `wip/` returns `not_found`.

## 4. Type-collision and error handling (validates FR-011, FR-012, SC-005)

With `notes/` recreated as a directory: call `create_directory` with `{ path: "notes/" }` again (idempotent) — expect success, no error.

Call `create_file` with `{ path: "notes/", content: "oops" }` (a file where a directory already exists).

Expected: error with `code: "already_exists"` (or `type_mismatch`, per contracts/mcp-tools.md) — the directory is untouched afterward.

Call `read_file` with `{ path: "notes/" }` (reading a directory as if it were a file).

Expected: error with `code: "type_mismatch"`.

## 5. Storage unavailability (validates Edge Cases)

Stop the underlying storage: `docker compose stop` (from the spec 001 project root).

Call any tool, e.g. `read_file` with `{ path: "hello.txt" }`.

Expected: error with `code: "storage_unreachable"` returned promptly — not a hang, not a crash of the MCP server process itself.

Restart it (`docker compose up -d`) and confirm a subsequent call succeeds again.

## 6. Responsiveness (validates SC-004)

Time a `create_file` → `read_file` → `update_file` → `delete_file` cycle on a small (few-KB) file.

Expected: each individual call completes in well under 2 seconds.
