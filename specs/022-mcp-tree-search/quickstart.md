# Quickstart: MCP Tree Search Tools

**Input**: [spec.md](./spec.md), [contracts/mcp-tools-tree.md](./contracts/mcp-tools-tree.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes the three new tools have been implemented per tasks.md, and that the existing S3 storage MCP server (spec 002) is already running.

## Prerequisites

1. The spec 001 local storage stack is running: from the repo root, `docker compose up -d`.
2. Dependencies installed: `cd frontend && npm install`.
3. The MCP server's dev server running: `npm run dev` (Next.js on `http://localhost:3000` by default).
4. An MCP client capable of connecting over Streamable HTTP, pointed at `http://localhost:3000/mcp`.
5. A small multi-level fixture already created via the existing tools:
   - `create_directory` `{ path: "demo/" }`, `create_directory` `{ path: "demo/skills/" }`
   - `create_file` `{ path: "demo/notes.txt", content: "top level note" }`
   - `create_file` `{ path: "demo/skills/invoicing.md", content: "# Invoicing\n\nHandles refund requests and payment terms." }`
   - `create_file` `{ path: "demo/skills/onboarding.md", content: "# Onboarding\n\nSteps for a new client." }`

## 1. Full subtree in one call (validates User Story 1, FR-001–FR-003, SC-001, SC-005)

Call `list_directory_tree` with `{ path: "demo/" }`.

Expected: `entries` includes all four descendants — `demo/notes.txt`, `demo/skills/` (or however directories are represented), `demo/skills/invoicing.md`, `demo/skills/onboarding.md` — each labeled with the correct `kind`, in a single response. `truncated` is `false`.

Call `list_directory_tree` with `{ path: "does-not-exist/" }`.

Expected: an error with `code: "not_found"` — same as `list_directory` would give today.

Call `list_directory_tree` with `{ path: "demo/notes.txt" }` (a file, not a directory).

Expected: an error with `code: "type_mismatch"`.

Confirm the existing tools are untouched (SC-005): call `list_directory` with `{ path: "demo/" }` and check its output shape (`files`/`directories`, one level only) is exactly what it was before this feature.

## 2. Find by name (validates User Story 2, FR-004–FR-005, FR-008–FR-010, SC-002)

Call `find_files_by_name` with `{ query: "invoicing" }` (no `path` — searches from the root).

Expected: `matches` includes `{ path: "demo/skills/invoicing.md", kind: "file" }`, and does **not** include `demo/skills/onboarding.md`.

Call `find_files_by_name` with `{ query: "skills" }`.

Expected: `matches` includes the `demo/skills/` directory entry itself, but not `invoicing.md`/`onboarding.md` (their own names don't contain "skills" — name matching is per-entry, not full-path, per research.md §4).

Call `find_files_by_name` with `{ query: "nonexistent-xyz" }`.

Expected: `matches` is an empty array — not an error (FR-009).

Call `find_files_by_name` with `{ query: "  " }` (whitespace only).

Expected: a tool input validation error (FR-010), not an empty-match success.

## 3. Find by content (validates User Story 3, FR-006–FR-007, SC-003)

Call `search_file_content` with `{ query: "refund" }`.

Expected: `matches` includes `{ path: "demo/skills/invoicing.md", snippet: "...refund..." }` (snippet contains the matched word in context), and does **not** include `onboarding.md`.

Call `search_file_content` with `{ query: "onboarding" }` where the word only appears in `onboarding.md`'s body, not in `invoicing.md`'s.

Expected: `matches` includes only `demo/skills/onboarding.md`.

Call `search_file_content` with `{ query: "top level note" }` — this text exists only in `demo/notes.txt`, which is **not** Markdown.

Expected: `matches` is empty — content search never inspects non-Markdown files (FR-007).

## 4. Trash exclusion (validates FR-011)

Call `delete_file` with `{ path: "demo/notes.txt" }` (soft-deletes it into `Trash/` per spec 011, since `demo/` is outside `Trash`).

Call `list_directory_tree` with `{ path: "" }` (the root) and `find_files_by_name` with `{ query: "notes" }`.

Expected: neither result includes anything under `Trash/` — the moved file is invisible to both, even though it still physically exists in storage.

## Cleanup

Call `delete_directory` with `{ path: "demo/" }`, then again with `{ path: "Trash/" }` to permanently empty Trash (per spec 011's "calling delete on Trash itself empties it" behavior).
