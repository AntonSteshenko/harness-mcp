# Phase 0 Research: Upload and Browse Mixed File Types in Storage

No `[NEEDS CLARIFICATION]` markers remain in the spec (all resolved during `/speckit-clarify`). The research below covers technical decisions needed to implement the clarified requirements against this codebase's existing patterns, not open product questions.

## 1. Upload transport: JSON+string vs. `multipart/form-data`

**Decision**: Switch `POST /api/upload` from a JSON body (`{ basePath, files: [{ relativePath, content: string }] }`) to `multipart/form-data`, parsed server-side via the Web-standard `request.formData()` (natively supported by Next.js Route Handlers, no new dependency). The client (`FileTree.tsx`) builds a `FormData` with a `basePath` field and one `files` entry per selected `File`, read via `.arrayBuffer()`.

**Rationale**: The current JSON contract only works because content is always UTF-8 text (`.md`). Binary content (PDF, JPG, DOC/XLS) cannot round-trip through `file.text()` → JSON string without corruption. The alternative — base64-encoding binary content into the JSON string — was rejected: it inflates payload size ~33% against the clarified 25 MB per-file cap, adds an encode/decode step on both ends for no benefit, and this endpoint has exactly one internal consumer (`FileTree.tsx`), so there's no external-contract cost to changing its shape.

**Alternatives considered**:
- Base64-in-JSON: rejected for size inflation and unnecessary complexity (see above).
- A dedicated per-file binary upload endpoint (one `PUT` per file, raw body): rejected because it would lose the existing per-file batch-result reporting (FR-004) that the current single-request batch endpoint already provides cleanly; would require re-implementing partial-failure aggregation client-side instead of server-side.

## 2. Storage layer: `string` vs. `Buffer` content

**Decision**: `lib/storage/files.ts`'s `createFile`, `updateFile`, and `readFile` switch their `content` from `string` to `Buffer`/`Uint8Array`. `PutObjectCommand`'s `Body` accepts a `Buffer` directly (already supported by `@aws-sdk/client-s3`, no new dependency); `GetObjectCommand`'s result is read via `result.Body?.transformToByteArray()` (or the SDK's byte-array helper) instead of `transformToString()`.

**Rationale**: `transformToString()` decodes bytes as UTF-8, which is lossy/corrupting for any non-text content — this is the direct cause of the byte-for-byte integrity requirement (FR-003, SC-002) not being satisfiable today. Text callers (Markdown/plain-text editor, upload preview) already have a well-defined boundary where they need a JS `string` — that decode now happens once, explicitly, at the point where a file has already been confirmed text-viewable (`GET /api/file`'s existing flow, after the binary guard passes), not inside the generic storage layer.

**Alternatives considered**: Keeping `readFile`/`createFile` string-based and adding separate `readFileBuffer`/`createFileBuffer` variants — rejected as needless duplication; every caller either wants raw bytes (upload, download, zip) or wants to interpret those bytes as text after confirming the file is text-viewable (the one text-editing code path), so a single `Buffer`-based primitive with text-decoding happening at that one call site is simpler than maintaining two parallel storage APIs.

## 3. Content-Type: infer from extension vs. store on upload

**Decision**: Store the real upload `Content-Type` in the S3 object's metadata (`PutObjectCommand`'s `ContentType`, derived from the uploaded `File`'s `type` when the browser provides one, else the extension→category lookup in the new `lib/storage/fileTypes.ts`), and read it back via `GetObjectCommand`'s `ContentType` on retrieval. Fall back to extension-based inference for any file that predates this feature (no stored `ContentType`).

**Rationale**: The new single-file retrieval route (`GET /api/file/download`) needs an accurate `Content-Type` to let a browser render a PDF/JPG/PNG inline (FR-010). Storing the real type at upload time is more correct than re-guessing from the extension on every read, and it's a small, contained change (one new field on `FileMetadata`/`FileContent`, one line at each of the two `PutObjectCommand` call sites).

**Alternatives considered**: Pure extension-based inference on every read, no stored metadata — rejected only because it's marginally less accurate (can't distinguish, e.g., a mislabeled extension) and the storage cost (one extra S3 object-metadata field) is negligible; extension-based inference remains as the necessary fallback for pre-existing files regardless.

## 4. Binary-open guard: extend vs. replace

**Decision**: Extend the existing `looksBinary()` guard in `app/api/file/route.ts` (spec 003/018) rather than building a new mechanism. Its `BINARY_EXTENSIONS` set gains `doc`, `docx`, `xls`, `xlsx` (currently absent — today a `.docx` would fall through to the content-sniffing fallback and likely still get caught, but not reliably). The extension check is reordered to run **before** the file is fetched and decoded from S3, so a known-binary extension short-circuits without ever calling `transformToString()` on up to 25 MB of binary data. The content-sniffing fallback (checking decoded content for the U+FFFD replacement character) is kept, unchanged, for files whose extension doesn't conclusively indicate either way (FR-009's "not solely by extension" requirement) — e.g., an extensionless file or a mislabeled one.

**Rationale**: This guard already exists and already produces exactly the UX the spec's User Story 3 asks for (a 422 `unsupported` response the editor renders as a clear message, not garbled content) — spec 018 built the client-side handling for it already. Reusing it keeps behavior consistent across every file type, old and new, and satisfies FR-009 by keeping the content-based fallback for ambiguous cases. Reordering the check is a correctness/performance fix made necessary by binaries now being large enough (up to 25 MB) that decoding-then-discarding would be wasteful.

**Alternatives considered**: A separate "is this upload type text or binary" table maintained independently from the open-guard's extension list — rejected because it would need to be kept in sync with `BINARY_EXTENSIONS` by hand; the plan instead has `lib/storage/fileTypes.ts` be the one place that both the upload allow-list and (indirectly, by category) the open-guard's binary/text split are derived from.

## 5. Single-file retrieval and inline-open security boundary

**Decision**: New route `GET /api/file/download?path=...`. For the three clarified natively-renderable types — PDF, JPG/JPEG, PNG — it responds with the real `Content-Type` and `Content-Disposition: inline`, so the browser opens it directly in a new tab using its own built-in viewer (no in-app renderer built by this feature — consistent with the spec's Assumptions). For every other file (including HTML/XML/CSS/BPMN, and any archive/office format), it responds with `Content-Type: application/octet-stream`, `Content-Disposition: attachment`, and `X-Content-Type-Options: nosniff`, forcing a download rather than in-browser rendering.

**Rationale**: This is a stored-XSS boundary, not just a UX choice. If an uploaded `.html` or `.xml` file were ever served same-origin with its real content type and inline disposition, a browser would render/parse it as markup — including executing any embedded `<script>` — under this application's own origin. The spec explicitly scopes native inline-opening to only PDF/JPG/PNG (Clarification session, Q2), which conveniently is also exactly the safe set: none of those three formats execute script when navigated to directly. Every other allowed type (including all the markup formats this feature adds) is treated as an inert downloadable blob by this route, even though those same types are perfectly readable/editable as *text* through the existing in-app text editor (FR-007) — that's a different code path (`GET /api/file`, which returns JSON `{content: string}` for the editor to display as text, never as rendered HTML/DOM).

**Alternatives considered**: Serving every retrievable file with its real content type and letting the browser decide — rejected outright for the XSS risk above. Sanitizing HTML/SVG content before serving it inline — rejected as unnecessary complexity given the spec's actual (narrower) requirement only calls for PDF/JPG/PNG to open inline at all.

## 6. Folder-zip download: `.md`-only filter

**Decision**: `lib/storage/directories.ts`'s `listFilesRecursive` drops its `file.path.toLowerCase().endsWith(".md")` filter, returning every file under a folder. `app/api/download-zip/route.ts` adds each file's raw `Buffer` content to the `JSZip` archive (`zip.file(entryName, buffer)`) instead of the current string content.

**Rationale**: FR-011 requires existing operations, including folder-zip download, to "continue to work... for the newly supported file types" — read as: uploading a PDF into a folder and then downloading that folder as a zip must include the PDF, not silently omit it the way today's `.md`-only filter would. This is a direct, minimal extension of an existing feature (spec 004/005's zip download), not a new one.

**Alternatives considered**: Leaving folder-zip download `.md`-only and treating it as genuinely "unchanged" (i.e., new file types simply never appear in a zip) — rejected as inconsistent with FR-011's intent and likely to surprise a user who uploads a folder of mixed documents expecting the "download as zip" action to grab everything they can see in that folder.

## 7. Allow-list scope (concrete extensions per category)

**Decision**: The allow-list (`lib/storage/fileTypes.ts`) is organized by the same categories the spec's icons use, so upload validation and icon selection share one source of truth:

| Category | Extensions |
|---|---|
| Document/PDF | `pdf`, `doc`, `docx` |
| Spreadsheet | `xls`, `xlsx`, `csv` (existing) |
| Image | `jpg`, `jpeg`, `png`, `gif`, `bmp`, `webp` |
| Diagram | `bpmn` |
| Markup/code | `html`, `xml`, `css`, `md` (existing), `txt`, `json` |
| Archive | `zip` |

**Rationale**: This is the concrete realization of the spec's Clarification Q1 (allow-list of "recognized safe types") and Assumption ("new extensions within an existing category reuse that category's icon"), covering everything FR-001 names explicitly (`pdf, xls/xlsx, doc/docx, jpg/jpeg, png, bpmn, html, xml, css`) plus the pre-existing `md`/`csv`/`txt`, plus a small number of same-family siblings (`gif`/`bmp`/`webp` alongside `jpg`/`png`; `json` alongside `html`/`xml`/`css`) that a user asking for "images" or "markup" would reasonably expect to already be covered. `svg` is deliberately excluded from this initial allow-list — standalone SVG documents can contain and execute `<script>`, and admitting it would require the same inline-vs-attachment security carve-out documented in §5 above; since the spec doesn't call for SVG specifically, it's left out rather than adding an unrequested security surface.

**Alternatives considered**: A fully open allow-list covering every extension anyone might plausibly upload — rejected per Clarification Q1 (explicit decision to restrict to a safe, recognized list). A minimal allow-list containing *only* the exact extensions FR-001 lists, with no same-family siblings — considered, but rejected as an unnecessarily strict reading that would make "upload an image" fail for a `.gif` while succeeding for a `.jpg`, contradicting the spirit of FR-001's "at minimum" phrasing.
