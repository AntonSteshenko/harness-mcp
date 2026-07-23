# Quickstart: MCP File Trash

**Input**: [spec.md](./spec.md), [contracts/mcp-tools-trash.md](./contracts/mcp-tools-trash.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes the storage-layer changes described in plan.md (see plan.md Project Structure) have already been implemented per tasks.md, and that spec 001's local storage stack is available.

## Prerequisites

1. The spec 001 local storage stack is running: `docker compose up -d` (see `specs/001-s3-self-hosted-storage/quickstart.md`).
2. Dependencies installed: `npm install`.
3. The MCP server's dev server running: `npm run dev` (Next.js on `http://localhost:3000` by default).
4. An MCP client capable of connecting over Streamable HTTP, pointed at `http://localhost:3000/mcp` (same client setup as spec 002's quickstart.md).

## 1. Soft-delete a file (validates User Story 1, FR-001, FR-003, FR-004)

Call `create_file` with `{ path: "notes/todo.txt", content: "buy milk" }`.

Expected: success, as in spec 002.

Call `delete_file` with `{ path: "notes/todo.txt" }`.

Expected: `{ path: "notes/todo.txt", deleted: true, permanent: false, trashedTo: "Trash/<opId>/notes/todo.txt" }` — note the `trashedTo` value for use in later steps.

Call `read_file` with `{ path: "notes/todo.txt" }`.

Expected: error `code: "not_found"` — the file is gone from its original location.

Call `read_file` with `{ path: "<trashedTo value from above>" }`.

Expected: `content` exactly equals `"buy milk"` — the file survived, just relocated.

## 2. Soft-delete a directory (validates User Story 2, FR-002, FR-003)

Call `create_directory` with `{ path: "drafts/" }`, then `create_file` with `{ path: "drafts/a.txt", content: "a" }` and `{ path: "drafts/sub/b.txt", content: "b" }`.

Call `delete_directory` with `{ path: "drafts/" }`.

Expected: `{ path: "drafts/", deleted: true, permanent: false, filesRemoved: 2, trashedTo: "Trash/<opId>/drafts/" }`.

Call `list_directory` with `{ path: "<trashedTo value>" }`.

Expected: `files` contains `<trashedTo>a.txt`; `directories` contains `<trashedTo>sub/` — same structure as before deletion, just relocated under `Trash`.

Call `list_directory` with `{ path: "drafts/" }` (the original location).

Expected: error `code: "not_found"`.

## 3. Inspect Trash with existing tools (validates User Story 4, FR-008)

Call `list_directory` with `{ path: "Trash" }`.

Expected: `directories` contains the `opId` subfolders created in steps 1 and 2 (e.g. `Trash/20260723T140522123Z-a1b2c3/`) — visible with no new tool, just the existing `list_directory`.

## 4. Restore a trashed item (validates User Story 4, FR-009)

Using the `trashedTo` value from step 1, call `move` with `{ sourcePath: "<trashedTo value>", destinationPath: "notes/todo.txt" }`.

Expected: `{ moved: true }`. Then `read_file` with `{ path: "notes/todo.txt" }` returns `content: "buy milk"` again — fully restored, using only the pre-existing `move` tool.

## 5. Permanently delete an already-trashed item (validates User Story 3, FR-005, FR-006)

Using the `trashedTo` value from step 2 (the `drafts/` subtree now under `Trash`), call `delete_directory` with `{ path: "<trashedTo value>" }`.

Expected: `{ path: "<trashedTo value>", deleted: true, permanent: true, filesRemoved: 2 }` — no `trashedTo` in the response this time. Then `list_directory` on that same path returns `not_found`: it is genuinely gone, not moved again.

## 6. Empty Trash entirely (validates FR-006, spec Assumptions "no dedicated empty_trash tool")

Soft-delete one or two more throwaway files into `Trash` (repeat step 1 with new paths), then call `delete_directory` with `{ path: "Trash" }`.

Expected: `{ path: "Trash", deleted: true, permanent: true, filesRemoved: <count> }`. Then `list_directory` with `{ path: "Trash" }` returns `not_found` — Trash is fully emptied using the same `delete_directory` tool, no dedicated "empty trash" tool involved.

## 7. Collision safety (validates FR-007)

Repeat step 1's `create_file` + `delete_file` sequence on the same path (`notes/todo.txt`) twice in quick succession (e.g. in a tight script loop, no delay between iterations).

Expected: both `delete_file` calls succeed, each returning a distinct `trashedTo` value (different `opId`) — no `already_exists` error, confirming two delete operations never collide on the same Trash subfolder even when their original paths are identical.

## 8. Web editor delete still works, untouched (validates FR-010)

With the Next.js app running, open `http://localhost:3000/editor`, delete a file from the tree via the UI as usual.

Expected: the file disappears from the tree exactly as before this feature — the UI required no changes; under the hood it is now recoverable from `Trash` via the MCP tools above, but nothing about the editor's own behavior changed.
