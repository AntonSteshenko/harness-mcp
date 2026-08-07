# Contract: `POST /api/upload`

Batch-uploads one or more files under a folder, validating each against the allow-list and size cap (FR-001, FR-002, FR-004, FR-012, data-model.md). **Breaking change** from the current JSON contract — this endpoint has exactly one consumer (`FileTree.tsx`), updated in the same change.

## Request

`Content-Type: multipart/form-data`, owner session required (`requireOwnerSession`, unchanged from every existing route).

| Field | Type | Notes |
|---|---|---|
| `basePath` | text field | Folder to upload into (unchanged meaning from today's `basePath`). |
| `files` | one or more file fields, same field name `files` | Each is an uploaded file; the browser-supplied filename (and, for a folder upload, its relative path) is preserved exactly as `FileTree.tsx` does today for `.md` uploads. |

## Response

`200 OK` (always — per-file outcome, never all-or-nothing, unchanged from today):

```json
{
  "results": [
    { "path": "docs/report.pdf", "status": "uploaded" },
    { "path": "docs/malware.exe", "status": "failed", "message": "File type \".exe\" isn't supported here" },
    { "path": "docs/huge-scan.pdf", "status": "failed", "message": "\"huge-scan.pdf\" is larger than the 25 MB upload limit" },
    { "path": "docs/notes.md", "status": "uploaded" }
  ]
}
```

`status` is unchanged (`"uploaded" | "skipped" | "failed"`); `"skipped"` is retained for any client-side pre-filtering the UI still does (e.g., a user cancels the file picker), `"failed"` now also covers `unsupported_type` and `too_large` rejections, each with a human-readable `message` (FR-002, FR-012).

`400 Bad Request` — malformed request (missing `basePath`, no `files` field at all): same shape as today, `{ "code": "invalid_request", "message": "..." }`.

## Behavior notes

- Each file's extension is checked against the allow-list (data-model.md's category table) before anything is written to storage; a rejected file never reaches `createFile` (FR-002).
- Each file's size (from the `multipart/form-data` part, no need to buffer first) is checked against 25 MB before storage is touched (FR-012).
- Overwrite-confirmation (existing `window.confirm` flow in `FileTree.tsx`, client-side, unchanged) still happens before the request is sent — the server continues to overwrite unconditionally on a name collision, as it does today for `.md` uploads.
- Binary content is passed through as a `Buffer` (from each file part's bytes) to `createFile`, never decoded as text (FR-003).
