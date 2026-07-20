# Contract: Create & Delete API Routes

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

Two Route Handler additions the `app/editor/FileTree.tsx` UI calls via `fetch`: two new verbs on the existing `app/api/file/route.ts`, and one new `app/api/directory/route.ts`. All three are thin wrappers around already-existing `lib/storage/*` functions — not a new storage API (FR-011).

## `POST /api/file`

Creates a new file, or overwrites one if the caller has already confirmed the overwrite client-side (FR-004, FR-006, FR-010, data-model.md Create-File Action).

- **Body**: `{ path: string, content?: string }` (`content` defaults to `""` — a brand-new empty file, per FR-004).
- Server-side: calls `lib/storage/files.ts#createFile(path, content)` (existing, unchanged). `createFile` already overwrites in place if a file exists there, and rejects with `already_exists` only if a *directory* occupies that exact path.
- **Success (201)**: `{ path: string, size: number, lastModified: string }` — same `FileMetadata` shape `createFile` already returns.
- **Errors**: `404` with `{ code: "not_found", message: string }` if `path` is missing from the request body; `409` with `{ code: "already_exists", message: string }` if a directory occupies `path`; `502` with `{ code: "storage_unreachable", message: string }` if storage can't be reached — same `STATUS_BY_CODE` mapping already used by this route's `GET`/`PUT` handlers.

## `DELETE /api/file`

Deletes an existing file (FR-001, data-model.md Delete Action).

- **Query params**: `path` (string, required).
- Server-side: calls `lib/storage/files.ts#deleteFile(path)` (existing, unchanged).
- **Success (200)**: `{ path: string, deleted: true }` — same shape `deleteFile` already returns.
- **Errors**: `404` with `{ code: "not_found", message: string }` if `path` is missing from the query string, or if no file exists at `path`; `404` with `{ code: "type_mismatch", message: string }` if `path` now names a directory; `502` with `{ code: "storage_unreachable", message: string }` if storage can't be reached.

## `POST /api/directory`

Creates a new directory (FR-005, data-model.md Create-Folder Action).

- **Body**: `{ path: string }`.
- Server-side: calls `lib/storage/directories.ts#createDirectory(path)` (existing, unchanged). Idempotent — succeeds with no error if a directory already exists at `path`; rejects with `already_exists` only if a *file* occupies that exact path.
- **Success (201)**: `{ path: string, created: true }` — same shape `createDirectory` already returns.
- **Errors**: `404` with `{ code: "not_found", message: string }` if `path` is missing from the request body; `409` with `{ code: "already_exists", message: string }` if a file occupies `path`; `502` with `{ code: "storage_unreachable", message: string }` if storage can't be reached.

## UI contract (`app/editor/FileTree.tsx` additions)

Not a wire protocol, but the states the tree guarantees to the user for each row, for validation purposes:

| State | Trigger | User-visible guarantee |
|---|---|---|
| Delete confirmation | User clicks "Delete" on a file row | A confirmation naming the file is shown before anything is sent (FR-002); declining sends nothing. |
| Delete result | `DELETE /api/file` responds | On success, the file disappears from the tree; if it was the file open in the editor, the editor closes it (FR-003). On failure, a clear error is shown and the tree refreshes to current storage state (Edge Cases). |
| New file naming | User clicks "New file" on a directory row | A name prompt appears (FR-004); a blank/whitespace/cancelled entry creates nothing (FR-007); a name containing `/` is rejected with a clear message before any request (FR-007). |
| New file overwrite confirmation | Entered name matches an existing file in that directory's known listing | A single confirmation is shown before anything is sent (FR-006); declining sends nothing. |
| New file result | `POST /api/file` responds | On success, the new file appears in the tree and opens in the editor ready for typing (FR-010). |
| New folder naming | User clicks "New folder" on a directory row | Same name-prompt rules as New file (FR-005, FR-007). |
| New folder result | `POST /api/directory` responds | On success, the (new or already-existing) subfolder appears in the tree; a name collision with an existing *file* shows a clear error and creates nothing. |
