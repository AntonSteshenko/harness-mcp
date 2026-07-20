# Data Model: Markdown Upload & Folder Download

**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

This feature introduces no new persisted storage entities — uploaded files become ordinary Files in the spec 002 data model (`lib/storage/files.ts`), written via the existing `createFile`. The two concepts below exist only for the duration of a single upload or download action, entirely client-side (upload batch composition and outcome tracking) or entirely within one request/response (zip assembly) — nothing here is persisted beyond the resulting `.md` files themselves.

## File / Directory (reused, not redefined)

Same as spec 002/003: a File is content-addressable by path; a Directory is a hierarchical grouping of Files/Directories at a path. This feature only ever creates Files (via `createFile`) and reads Files/Directories (via `readFile`, `listDirectory`, and the new `listFilesRecursive`) — it adds no fields, no new validation rules, and no new lifecycle states to either.

## Upload Batch (new, client-side only, transient)

Represents one "Upload files" or "Upload folder" action from selection through the server's response. Exists only in the browser's memory for the duration of the action; the wire form sent to `POST /api/upload` is a subset of this (`basePath` + accepted `files`).

| Field | Type | Notes |
|---|---|---|
| `basePath` | string | The destination directory in storage the batch is uploaded into — the tree node the user triggered "Upload files"/"Upload folder" from. |
| `selected` | Array<`{ relativePath: string; content: string }`> | Every file the user picked, already filtered to `.md` only (research.md §7) and read to text (research.md §3, `relativePath` is `""`/filename for a flat multi-file upload, or `webkitRelativePath`-derived for a folder upload). |
| `skippedCount` | number | Count of files the user picked that were excluded for not being `.md` — computed client-side before submission, shown in the post-upload summary (FR-005). |
| `conflicts` | Array<string> (paths) | Subset of `selected` whose target path already exists in the destination folder's currently-known listing — drives the single overwrite confirmation prompt (FR-006, research.md §5) before submission. |
| `outcome` | Array<`{ path: string; status: "uploaded" \| "failed"; message?: string }`> | Filled in from `POST /api/upload`'s response after the request completes; drives the final per-file summary shown to the user (FR-005). |

**Validation rules**: `relativePath` values are joined with `basePath` and normalized the same way every other path in this app is (`lib/storage/paths.ts#normalizeFilePath`) before being passed to `createFile` — no new path-validity rules are introduced. The `.md`-only constraint (FR-003) is enforced both when `selected` is built (client) and again inside `POST /api/upload` (server, research.md §7); anything else is rejected as "not a Markdown file", not stored.

**Lifecycle**: created when the user picks files/a folder → filtered (skip non-`.md`) → checked for conflicts against the destination folder's listing → (if conflicts) confirmed by the user → posted to `POST /api/upload` → per-file `outcome` recorded from the response → summary shown to the user → batch discarded (nothing about it is retained after the summary is dismissed; the destination folder's tree listing is refreshed from storage instead).

## Folder Download (new, request-scoped only, transient)

Represents one "Download folder" action, entirely within the lifetime of a single `GET /api/download-zip` request/response — nothing is retained after the response is sent.

| Field | Type | Notes |
|---|---|---|
| `rootPath` | string | The folder the user triggered "Download folder" from; the query param `path` on `GET /api/download-zip`. |
| `files` | Array<`{ path: string; content: string }`> | Every `.md` file found under `rootPath` (any depth), from `listFilesRecursive` + `readFile` per entry (research.md §2). |
| `archiveName` | string | Derived from `rootPath`'s last path segment (or a fixed root name when downloading the tree root) with a `.zip` extension — used as the suggested filename for the browser download (research.md §6). |

**Validation rules**: If `files` is empty (no `.md` files anywhere under `rootPath`, including the case where `rootPath` itself doesn't exist or has no Markdown content), the route returns an error response instead of a zip body (FR-009); the client never initiates a file save in that case (SC-005, research.md §6).

**Lifecycle**: assembled entirely within one request — list recursively → read each file's content → build the zip in memory (`jszip`, research.md §1) → return as the response body → nothing persisted server-side afterward.
