# Contract: Editor API Routes

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

These are the two internal Next.js Route Handlers the `app/editor/*` UI calls via `fetch`. They are thin wrappers around `lib/storage/*` (spec 002) — not a new storage API, just an HTTP-shaped adapter for browser `fetch` calls (research.md §1–§3). Both accept/return JSON.

## `GET /api/tree`

Lists the direct children of a directory, for lazily expanding the file tree (FR-001, research.md §2).

- **Query params**: `path` (string, defaults to `""` for the root)
- **Success (200)**: `{ path: string, files: Array<{ path: string, size: number, lastModified: string }>, directories: Array<{ path: string }> }` — identical shape to spec 002's `list_directory` tool output.
- **Errors**: `404` with `{ code: "not_found", message: string }` if the path doesn't exist; `502` with `{ code: "storage_unreachable", message: string }` if the underlying storage can't be reached.

## `GET /api/file`

Reads a file's current content, to open it in the editor (FR-002).

- **Query params**: `path` (string, required)
- **Success (200)**: `{ path: string, content: string, size: number, lastModified: string }` — identical shape to spec 002's `read_file` tool output.
- **Errors**: `404` `not_found`; `422` `{ code: "unsupported", message: string }` if the content isn't text-editable (research.md §6, FR-011); `502` `storage_unreachable`.

## `PUT /api/file`

Saves edited content back to an existing file (FR-005, FR-007).

- **Body**: `{ path: string, content: string }`
- **Success (200)**: `{ path: string, size: number, lastModified: string }`
- **Errors**: `404` `not_found` (the file was deleted/moved elsewhere since it was opened — Edge Cases); `502` `storage_unreachable`. The client MUST keep the user's `currentContent` unchanged in the editor on any error (FR-010) — a failed `PUT` never clears in-progress edits.

## UI contract (`app/editor`)

Not a wire protocol, but the states the page guarantees to the user, for validation purposes:

| State | Trigger | User-visible guarantee |
|---|---|---|
| Browsing | Page load / tree navigation | Tree reflects real storage structure (via `GET /api/tree`), expandable without full page reload. |
| Viewing | File selected in tree | Content loaded via `GET /api/file`; Markdown files render in split view (raw + live preview), others in a plain-text area, unsupported files show a clear message instead of an editor (FR-011). |
| Editing (dirty) | User types | `dirty` indicator visible (FR-008); preview (if Markdown) updates live (FR-004, SC-002). |
| Saving | User triggers save | `saveState: "saving"` shown; on success, `dirty` clears and success is confirmed (FR-008); on failure, a clear error is shown and edits are retained (FR-010). |
| Navigation guard | User tries to switch files or leave with `dirty === true` | A confirmation prompt is shown before discarding changes (FR-009). |
