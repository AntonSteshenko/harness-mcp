# Contract: Upload & Download API Routes

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

Two new internal Next.js Route Handlers the `app/editor/FileTree.tsx` UI calls via `fetch`, alongside the existing `GET /api/tree` and `GET`/`PUT /api/file` from spec 003 (unchanged). Both are thin wrappers around `lib/storage/*` — not a new storage API (FR-011).

## `POST /api/upload`

Creates one or more `.md` files under a destination folder from a batch read client-side (FR-001, FR-002, FR-004, research.md §3).

- **Body**: `{ basePath: string, files: Array<{ relativePath: string; content: string }> }`
- Server-side, for each entry in `files`:
  - Reject (skip, do not store) any `relativePath` that doesn't end in `.md` (case-insensitive) — defense in depth alongside the client-side filter (research.md §7).
  - Join `basePath` + `relativePath`, normalize it (`lib/storage/paths.ts#normalizeFilePath`), and call `lib/storage/files.ts#createFile(path, content)`. `createFile` already overwrites in place if a file exists there (no separate update call needed) and rejects with `already_exists` only if a *directory* occupies that exact path (data-model.md).
- **Success (200)**: `{ results: Array<{ path: string; status: "uploaded" | "skipped" | "failed"; message?: string }> }` — one entry per file the client submitted (skipped entries are for defense-in-depth non-`.md` rejections; failed entries carry the underlying storage error's message). The route always returns 200 with per-file statuses rather than failing the whole batch on one file's error, so a partial batch failure doesn't discard the files that did succeed (Edge Cases: continue the rest of the batch).
- **Errors**: `400` with `{ code: "invalid_request", message: string }` only if the request body itself is malformed (missing `basePath`, missing/non-array `files`) — not for individual file failures, which are reported per-entry in the 200 response above.

## `GET /api/download-zip`

Recursively zips every `.md` file under a folder for download (FR-007, FR-008, research.md §1–§2, §6).

- **Query params**: `path` (string, defaults to `""` for the root)
- Server-side: calls a new `lib/storage/directories.ts#listFilesRecursive(path)` (research.md §2) to collect every `.md` file under `path` at any depth, reads each with the existing `lib/storage/files.ts#readFile`, and builds a zip archive in memory with `jszip` (research.md §1), preserving each file's path relative to `path` as its entry name inside the archive.
- **Success (200)**: Binary body, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="<folder-name-or-root>.zip"`.
- **Errors**: `404` with `{ code: "not_found", message: string }` if `path` doesn't exist; `404` with `{ code: "empty", message: string }` if `path` exists but contains no `.md` files anywhere in its subtree (FR-009, SC-005) — the client MUST treat both as "nothing to save," never attempting to write a file (research.md §6); `502` with `{ code: "storage_unreachable", message: string }` if the underlying storage can't be reached.

## UI contract (`app/editor/FileTree.tsx` additions)

Not a wire protocol, but the states the tree guarantees to the user for each directory row, for validation purposes:

| State | Trigger | User-visible guarantee |
|---|---|---|
| Upload picking | User clicks "Upload files" or "Upload folder" on a directory row | The browser's native file/folder picker opens; only `.md` files are ever included in what gets sent (non-`.md` picks are counted but excluded, FR-003). |
| Overwrite confirmation | Selected batch includes filenames already present in that directory's known listing | A single confirmation naming the conflicting file(s) is shown before anything is sent (FR-006); declining sends nothing. |
| Upload result | `POST /api/upload` responds | A summary states how many files were uploaded and how many were skipped, with reasons for skips (FR-005); the directory row's listing is refreshed from storage so new files appear without a full page reload. |
| Download triggered | User clicks "Download folder" on a directory row | If the folder has no `.md` files anywhere under it, a clear "nothing to download" message is shown and no file is saved (FR-009, SC-005); otherwise a single `.zip` is saved locally with the folder's structure and `.md` content preserved (FR-007, FR-008). |
