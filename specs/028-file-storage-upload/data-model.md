# Phase 1 Data Model: Upload and Browse Mixed File Types in Storage

This feature adds no new persisted entity or storage location — it changes the shape of the existing **Stored File** entity's content handling and adds one purely-derived concept (**File Type Category**) used only for display/validation. Everything below extends types already defined in `lib/storage/files.ts` and `lib/storage/errors.ts`.

## Stored File (extends existing `FileMetadata`/`FileContent`)

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | Unchanged — S3 object key (spec 001/002). |
| `size` | `number` | Unchanged — byte length. |
| `lastModified` | `string` (ISO 8601) | Unchanged. |
| `etag` | `string` | Unchanged (spec 019). |
| `content` | `Buffer` (was `string`) | **Changed**: raw bytes, no longer UTF-8-decoded at the storage layer. `readFile`'s only caller that needs a JS `string` (the text-editing flow, `GET /api/file`) decodes explicitly at that boundary, after the binary guard has already confirmed the file is text-viewable. |
| `contentType` | `string` | **New**. The MIME type recorded at upload time (from the browser's `File.type`, falling back to the extension→category lookup). Absent/undefined for files written before this feature; consumers fall back to extension-based inference in that case. |

State/lifecycle is unchanged from spec 001/011: a Stored File is created, optionally updated (whole-file overwrite), soft-deleted into `Trash` or permanently deleted from within `Trash`, and optionally moved — none of those transitions change shape under this feature, only the `content`/`contentType` representation above does.

## File Type Category (new, derived — not persisted)

A pure function of a file's extension (and, as a fallback for ambiguous/mislabeled files, a peek at its content), used for exactly two purposes: which icon to render, and whether an extension is on the upload allow-list. Never stored — recomputed on demand from `path`.

| Category | Example extensions | Icon (FR-005) | Upload allow-list (FR-002) | Text-viewable (FR-007/FR-008)? |
|---|---|---|---|---|
| Document/PDF | `pdf`, `doc`, `docx` | `PdfIcon` (pdf) / `DocumentIcon` (doc/docx) | Yes | No — binary |
| Spreadsheet | `xls`, `xlsx`, `csv` | `SpreadsheetIcon` | Yes | `csv` yes (existing CSV editor); `xls`/`xlsx` no — binary |
| Image | `jpg`, `jpeg`, `png`, `gif`, `bmp`, `webp` | `ImageIcon` | Yes | No — binary |
| Diagram | `bpmn` | `DiagramIcon` | Yes | Yes — XML-based text |
| Markup/code | `html`, `xml`, `css`, `md`, `txt`, `json` | `MarkupIcon` (generic markup) / existing Markdown handling for `.md` | Yes | Yes — plain text |
| Archive | `zip` | Generic `FileIcon` (fallback — no dedicated archive icon in this feature's minimum icon set, FR-006) | Yes | No — binary |
| *(anything else)* | — | Generic `FileIcon` (fallback, FR-006) | **No** — rejected at upload (FR-002) | N/A (can't be uploaded) |

Notes:
- "Text-viewable" here is the *default* by category, but per FR-009 the actual open-time decision is never based on extension alone — the existing content-sniffing fallback in `GET /api/file` still runs for any file whose extension doesn't conclusively resolve it (e.g., no extension, or extension/content mismatch), overriding this table's default when the content itself looks binary (contains the U+FFFD replacement character after decode) or vice versa.
- The Image category's inline-open behavior (FR-010) is narrower than "Image" as a whole: only `jpg`/`jpeg`/`png` open inline in a new browser tab via `GET /api/file/download`; `gif`/`bmp`/`webp` (allowed for upload, shown with the same `ImageIcon`) download as an attachment like any other non-inline binary type, since inline-opening was clarified as scoped specifically to PDF/JPG/PNG, not "images" generically.

## Upload Batch Result (existing shape, unchanged fields, new possible values)

`UploadResult.status` gains no new literal values (`"uploaded" | "skipped" | "failed"` is unchanged), but `"failed"` now also covers two new rejection reasons surfaced via `message`:
- File type not on the allow-list (`unsupported_type`)
- File exceeds the 25 MB per-file cap (`too_large`)

Both are reported per-file within the existing batch-result array (FR-004), never aborting the rest of a batch.

## StorageErrorCode (extends existing enum in `lib/storage/errors.ts`)

| Code | HTTP status | When |
|---|---|---|
| `not_found` | 404 | Unchanged. |
| `type_mismatch` | 404 | Unchanged. |
| `already_exists` | 409 | Unchanged. |
| `storage_unreachable` | 502 | Unchanged. |
| `unsupported_type` | 415 | **New** — upload rejected: extension not on the allow-list (FR-002). |
| `too_large` | 413 | **New** — upload rejected: file exceeds 25 MB (FR-012). |
