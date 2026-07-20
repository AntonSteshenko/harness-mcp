# Research: Markdown Upload & Folder Download

**Input**: [spec.md](./spec.md), spec 003's `research.md` (prior art for this same app)

## §1. Zip archive construction: `jszip` vs. `archiver`

**Decision**: `jszip`, generating the archive fully in memory (`generateAsync({ type: "nodebuffer" })`) and returning it as a single `NextResponse`.

**Rationale**: A Next.js Route Handler returns one `Response`; `jszip`'s buffered API matches that shape directly — build the zip, get a `Buffer`, return it. `archiver` is stream-oriented (Node `Readable`), which requires bridging a Node stream into a Web `ReadableStream`/`Response` — extra plumbing with no benefit at this feature's scale (single local developer, Markdown-only folders, typically tens of KB-scale text files per SC-002/SC-003). `jszip` is a pure, dependency-light library with no native bindings, consistent with the project's otherwise minimal dependency footprint (spec 003 research.md's own preference for a small, focused dependency set).

**Alternatives considered**:
- `archiver` — rejected: streaming complexity (Node stream → Web `Response` bridging) outweighs any benefit given the in-memory scale this feature targets.
- Node's built-in `zlib` (gzip/tar) — rejected: produces `.tar.gz`, not the `.zip` container users expect from "download folder as zip" (FR-007); would also require hand-rolling a tar writer.

## §2. Recursive listing of `.md` files under a folder

**Decision**: Add one new exported helper, `listFilesRecursive(path: string): Promise<Array<{ path: string; size: number; lastModified: string }>>`, to `lib/storage/directories.ts`. It performs a breadth-first walk using the existing `listDirectory` (calling it once per subdirectory discovered), collecting every file whose path ends in `.md` (case-insensitive) across the whole subtree.

**Rationale**: `listDirectory` (spec 002) already returns direct children (`files` + `directories`) for one path — exactly the building block needed for a walk. Composing it keeps the S3-facing logic (pagination via `ListObjectsV2Command`, delimiter-based `directories` grouping) in one place; the new helper adds only the walk/filter, no new S3 calls beyond repeated `listDirectory`. This keeps `GET /api/download-zip` a thin consumer, matching FR-011 (`lib/storage/*` is the only way to talk to storage).

**Alternatives considered**:
- Add a `recursive: boolean` flag to `listDirectory` itself — rejected: `listDirectory` is already relied on by spec 002's MCP tool and spec 003's `GET /api/tree` for one-level, lazy-expansion listings; changing its contract (or overloading its return shape) risks those existing consumers for no benefit, versus a small additive function.
- Use `ListObjectsV2Command` directly with no `Delimiter` (a flat, single-call recursive listing) inside the new API route — rejected: bypasses `lib/storage/*` and duplicates S3 pagination/prefix logic that `directories.ts` already owns, violating the "single way to talk to storage" constraint (FR-011) at the wrapper's own architecture boundary, not just the route boundary.

## §3. Reading uploaded files' content and relative paths in the browser

**Decision**: Client-side, use the native `File.text()` (or `FileReader.readAsText`) API to read each selected file's text content, and `file.webkitRelativePath` (populated automatically by browsers when a folder is picked via `webkitdirectory`) to preserve subfolder structure. Assemble one batch and `POST` it as JSON to `/api/upload`: `{ basePath: string, files: Array<{ relativePath: string, content: string }> }`.

**Rationale**: All accepted files are Markdown, i.e. small UTF-8 text — no binary handling is needed, so `File.text()` is sufficient and simplest. A single JSON POST (rather than one request per file, or `multipart/form-data`) keeps the server route trivial to parse and lets the client report one consolidated per-batch outcome (FR-005) after a single round trip. `webkitRelativePath` is the standard (if not formally spec'd) mechanism every major browser uses to expose folder structure from a `webkitdirectory` picker — no extra library needed to reconstruct it.

**Alternatives considered**:
- `multipart/form-data` — rejected: Next.js Route Handlers can parse it (`request.formData()`), but encoding/decoding relative-path metadata alongside file blobs adds complexity with no upside when every payload is already plain text small enough for a JSON body.
- One HTTP request per uploaded file — rejected: more round trips, harder to produce the single "N uploaded, M skipped" summary FR-005 requires, and no batch-level error boundary.

## §4. Picking a local folder to upload

**Decision**: `<input type="file" webkitdirectory multiple>` for "Upload folder"; a separate plain `<input type="file" accept=".md" multiple>` for "Upload files" (Story 1).

**Rationale**: `webkitdirectory` is unstandardized-but-universally-supported (Chromium, Firefox, Safari) and is the only browser-native way to let a user pick a whole local folder without a native app or drag-and-drop file-system-access API. Per spec's own Assumptions, if a browser/OS lacks support, "Upload files" (Story 1) remains available as a fallback — no feature-detection branching is required beyond offering both entry points.

**Alternatives considered**:
- File System Access API (`showDirectoryPicker`) — rejected: Chromium-only at present, would leave Firefox/Safari users with no folder-upload path at all, worse coverage than `webkitdirectory`.
- Drag-and-drop a folder (`DataTransferItem.webkitGetAsEntry`) — rejected as the *only* mechanism: more implementation surface (recursive `FileSystemDirectoryEntry` walking) for a feature that a plain file input already covers; can be layered on later without changing the upload contract, so it's not required for this spec's scope.

## §5. Overwrite confirmation before upload

**Decision**: Purely client-side gate. Before submitting a batch, compare each selected file's target filename against the already-known contents of the destination folder (the `FileTree`'s cached directory listing for that node) and, if any names collide, show one `window.confirm` naming the conflicting files — the same pattern `app/editor/page.tsx` already uses for the unsaved-changes guard. If confirmed (or there were no conflicts), POST the batch; if declined, abort with nothing sent.

**Rationale**: Inspecting `lib/storage/files.ts#createFile`, it already overwrites unconditionally at the storage layer when a file exists at the target path (its only existence check is for a *directory* occupying that path, which throws `already_exists`) — so there is no server-side "are you sure" hook to add without changing `createFile`'s established contract (used as-is by spec 002/003 elsewhere). Gating client-side, using data the tree already has in memory, needs no extra network round trip and matches the trust model already established for this single-local-developer app (research.md of spec 003, §7 on client-only dirty-state tracking).

**Alternatives considered**:
- Add an `overwrite: boolean` guard to `createFile` that throws `already_exists` when `false` and a file is already there — rejected: would change a function spec 002 and 003 both already depend on for its current "always upserts a file" semantics; introducing a route-level pre-check (fetch the target listing, compare) accomplishes the same UX guarantee without touching shared storage code.

## §6. Triggering the folder-download and handling "nothing to download"

**Decision**: The "Download folder" button calls `fetch("/api/download-zip?path=...")` rather than navigating via a plain `<a href>`. On a non-2xx JSON response (e.g. `{ code: "empty", message: "..." }` for FR-009), show the message and do not save anything. On success, read the response as a `Blob`, create an object URL, click a temporary `<a download="folder-name.zip">`, then revoke the URL.

**Rationale**: A plain link navigation can't distinguish "here's your zip" from "here's a JSON error" before the browser already started treating the response as a download — it would either save a JSON file misnamed `.zip` or show a raw JSON error page. Fetch-then-blob keeps the empty-folder path (SC-005: never produce a downloaded file when there's nothing to zip) fully under the client's control, mirroring how `app/editor/FileTree.tsx` already treats all `/api/*` calls as `fetch` + explicit error handling (spec 003 research.md §2).

**Alternatives considered**:
- Plain `<a href="/api/download-zip?path=...">` — rejected: cannot intercept an error response before the browser attempts to download it (violates FR-009/SC-005's "never produce a misleading/empty download").

## §7. Filtering non-`.md` files

**Decision**: Filter twice — once client-side before building the upload batch (so the "N skipped" count in FR-005's summary is known immediately, without a round trip), and once server-side in `POST /api/upload` (defense in depth: never trust the client exclusively, consistent with the existing binary-content guard already present in `app/api/file/route.ts`'s `GET` handler).

**Rationale**: Matches the project's existing pattern of the server never fully trusting client-side classification (spec 003's `looksBinary` check in `app/api/file/route.ts`), while still giving the user an immediate, accurate skip count without waiting on the network.

**Alternatives considered**:
- Server-side-only filtering — rejected: the client would then have to inspect the server's response to compute the skip summary, which is equivalent work with an extra round trip's worth of latency for no correctness benefit.
