# Contracts: File Retrieval (open-for-editing guard + new single-file download)

## `GET /api/file` (existing route — changed behavior only)

Unchanged response shapes and status codes (`200` ready / `404` not_found / `404` type_mismatch / `422` unsupported / `502` storage_unreachable) — this feature only changes *which* files hit each branch and *how efficiently*.

**Changed behavior**:
1. The binary-vs-text determination now runs on the file's extension **before** fetching/decoding its content from storage. A file whose extension is in the (now-extended) binary set — `png, jpg, jpeg, gif, bmp, webp, ico, pdf, zip, tar, gz, 7z, rar, exe, dll, so, bin, woff, woff2, ttf, otf, mp3, mp4, mov, avi, webm, wav, doc, docx, xls, xlsx` (additions: `doc, docx, xls, xlsx`) — returns `422 { "code": "unsupported", "message": "\"<path>\" doesn't look like a text file and can't be edited here" }` immediately, without ever calling `readFile` (perf goal in plan.md — avoids decoding up to 25 MB of binary as UTF-8 just to discard it).
2. For any file whose extension does **not** conclusively indicate binary or text (e.g., no extension, or an extension outside the known lists), content is fetched and the existing content-sniffing fallback (U+FFFD replacement-character check) still applies, unchanged (FR-009 — extension alone is never the sole signal for ambiguous cases).
3. For a text-viewable file, `content` in the response is now decoded from the underlying `Buffer` to a UTF-8 `string` explicitly at this boundary (previously `readFile` did this decode itself) — the JSON response shape (`{ path, content, size, lastModified, etag }`) is unchanged.

## `GET /api/file/download` (new route)

Retrieves a single file's raw bytes for the cases `GET /api/file` can't serve inline (binary files, or any file a user wants as a plain download rather than loaded into the editor) — FR-010.

### Request

`?path=<file path>`, owner session required.

### Response

**`200 OK`** — file exists and is readable:
- **PDF, JPG/JPEG, PNG** (the clarified native-render set): `Content-Type: <real MIME type>` (from the file's stored `contentType`, or extension-based inference for pre-existing files), `Content-Disposition: inline; filename="<basename>"`. Opening this URL in a new browser tab (`window.open`, or a plain `<a target="_blank">`) renders the file using the browser's own built-in viewer — no custom in-app renderer.
- **Every other file type**: `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename="<basename>"`, `X-Content-Type-Options: nosniff`. This forces a download rather than in-browser rendering/execution — deliberate, see plan.md's security constraint and research.md §5 (a stored `.html`/`.xml`/`.svg`-adjacent file must never be served in a way a browser would parse/execute it as markup).
- Body: the file's raw bytes (`Buffer`), unchanged from what was stored — never decoded/re-encoded as text (FR-003).

**`404 Not Found`** — `{ "code": "not_found", "message": "..." }`, same convention as `GET /api/file`.

**`404 Not Found`** (`type_mismatch`) — path is a folder, same convention as `GET /api/file`.

**`502`** — `storage_unreachable`, same convention as every other route.

### Behavior notes

- This route has no size or type restriction beyond what already exists in storage — anything successfully uploaded (already passed the 25 MB / allow-list gate in `POST /api/upload`) can be retrieved here regardless of whether it's text- or binary-natured; it's the one retrieval path that works for every stored file, unlike `GET /api/file` which refuses binaries.
- `FileEditor.tsx`'s "can't be viewed here" message (unchanged, existing `422` handling from spec 003/018) gets a new companion action — an "Open" / "Download" link/button pointing at this route — so User Story 3's Acceptance Scenario 3 (binary files remain retrievable even though not previewable inline) is satisfied from the same screen the guard message appears on.
