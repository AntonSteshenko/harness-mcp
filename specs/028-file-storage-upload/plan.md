# Implementation Plan: Upload and Browse Mixed File Types in Storage

**Branch**: `028-file-storage-upload` | **Date**: 2026-08-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/028-file-storage-upload/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Broaden the file browser's upload/storage/view pipeline — today hard-wired to Markdown-only, text-only content — to a safe allow-list of common document, spreadsheet, image, diagram, and markup types (PDF, XLS/XLSX, DOC/DOCX, JPG/JPEG, PNG, BPMN, HTML, XML, CSS, plus the existing MD/TXT/CSV), while keeping binary content byte-for-byte intact end to end. This requires switching the upload transport from JSON-with-string-content to `multipart/form-data` (binary-safe, no base64 inflation) and switching storage reads/writes from string-based to `Buffer`-based throughout `lib/storage/files.ts`, so a file's real bytes survive upload → S3 → download unchanged (FR-003, SC-002). The existing binary-detection guard in `GET /api/file` (spec 003's extension list + content heuristic) is reordered to check the extension *before* fetching/decoding content, extended to cover the newly-allowed binary types (doc/docx/xls/xlsx), and continues to gate inline editing exactly as it does today for images/PDFs (FR-007, FR-008, FR-009) — no new mechanism, this feature only widens its extension list and its efficiency. A new `GET /api/file/download` route serves an individual file's raw bytes: PDFs/JPGs/PNGs (the clarified native-render set) with `Content-Disposition: inline` so they open in a new browser tab using the browser's own viewer; everything else downloads as an attachment (FR-010). The folder-zip download (`GET /api/download-zip`) is broadened from its current `.md`-only filter to include every stored file, using the same binary-safe `Buffer` path. The file tree gains a small extension→category lookup (`Icons.tsx`) driving one new icon per category (PDF, spreadsheet, document, image, diagram, markup/code, generic fallback) instead of today's single generic icon (FR-005, FR-006). The upload entry point itself (`FileTree.tsx`'s "Upload files"/"Upload folder" menu items) keeps its existing UX shape — same menu items, same per-file batch-result summary, same overwrite-confirmation flow — just widens what it accepts and validates against the new allow-list and the 25 MB per-file cap (FR-001, FR-002, FR-004, FR-012) instead of `.md` alone.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router), React 19, Node.js (unchanged from specs 001–019)

**Primary Dependencies**: `@aws-sdk/client-s3` (existing — `PutObjectCommand`/`GetObjectCommand` switch from string `Body`/`transformToString()` to `Buffer`), `jszip` (existing — folder zip switches to binary `Buffer` file entries instead of string content), Web `FormData`/`Request.formData()` (native to the Next.js Route Handler runtime — no new package) replaces the current JSON-body upload contract. No new runtime dependency is introduced.

**Storage**: No change to the storage backend or addressing scheme — files remain S3 objects keyed by their `path` (spec 001/002). This feature changes *how* content moves through `lib/storage/files.ts` (`Buffer` instead of `string`) and adds a `contentType` field to `FileMetadata`/`FileContent`, set from the upload's real MIME type via `PutObjectCommand`'s `ContentType` and read back via `GetObjectCommand`'s `ContentType` (falling back to extension-based inference for files uploaded before this feature, which have no stored content type).

**Testing**: No automated test suite exists in this project (specs 001–019 all validate via a runnable `quickstart.md` walkthrough instead) — this feature follows the same convention; see [quickstart.md](quickstart.md). Per user instruction, tests are not run as part of this work.

**Target Platform**: Node.js server; runs locally (`npm run dev`, storage via `docker compose` + MinIO) and deploys to Vercel — same as every existing API route; no runtime change. The 25 MB per-file cap (FR-012, clarified) is transmitted as real binary bytes via `multipart/form-data` (not base64, which would inflate ~33%), keeping individual upload requests comfortably within modern serverless request-body limits.

**Project Type**: Web application — single Next.js project (`frontend/`); no new project/service. All changes are within existing routes/components under `app/files/`, `app/api/`, and `lib/storage/`.

**Performance Goals**: Uploads and single-file retrieval of files up to 25 MB complete within a few seconds on a typical connection (SC-001, SC-006). The binary-detection guard on `GET /api/file` must reject known-binary extensions (pdf/jpg/png/doc/xls/etc.) without first fetching and decoding the full object as text — today it decodes every file's content before checking, which would waste time and memory once binaries up to 25 MB flow through this same route.

**Constraints**: Must preserve binary content byte-for-byte through upload → storage → retrieval/download (FR-003, SC-002) — no lossy string round-tripping anywhere in the path a binary file travels. Must not weaken the existing binary-open guard (FR-008, FR-009): the extension list it checks must include every newly-allowed binary type, and the content-sniffing fallback (for mislabeled/extensionless files) must still run for anything not conclusively identified by extension. Must not introduce a stored-XSS vector: only the three clarified natively-renderable types (PDF, JPG, PNG) are ever served with `Content-Disposition: inline` and their real `Content-Type`; every other retrieved file (including HTML, which this feature otherwise treats as plain, non-executed text in the existing text editor) is served as `Content-Type: application/octet-stream` with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`, so an uploaded `.html`/`.xml` file can never be served in a way a browser would execute or auto-render as markup. Must reuse the existing owner-session gate (`requireOwnerSession`) on every new/changed route, exactly as every existing `app/api/*` route already does — no new authorization mechanism.

**Scale/Scope**: Single owner, single storage bucket, per-file uploads up to 25 MB (FR-012). Touches: `app/files/FileTree.tsx` (upload transport + icon lookup), `app/files/Icons.tsx` (new category icons), `app/api/upload/route.ts` (multipart parsing, allow-list + size validation), `app/api/file/route.ts` (binary guard reorder/extension), `app/api/download-zip/route.ts` (drop the `.md`-only filter, binary-safe zip entries), `lib/storage/directories.ts` (`listFilesRecursive`'s `.md` filter), `lib/storage/files.ts` (`Buffer`-based read/write, `contentType` field), `lib/storage/errors.ts` (two new `StorageErrorCode` values: `unsupported_type`, `too_large`). One new route: `app/api/file/download/route.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still unfilled template placeholder content — no project principles have been ratified yet, so there are no gates to check against. Nothing to re-check post-design.

## Project Structure

### Documentation (this feature)

```text
specs/028-file-storage-upload/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── upload-contract.md
│   └── file-retrieval-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── files/
│   │   ├── FileTree.tsx                # CHANGED: upload input `accept` widens
│   │   │                                # from ".md" to the full allow-list;
│   │   │                                # handleUpload switches from
│   │   │                                # file.text()+JSON to FormData
│   │   │                                # (binary-safe); per-row icon lookup
│   │   │                                # replaces the single <FileIcon />
│   │   │                                # (FR-001, FR-002, FR-004, FR-005)
│   │   ├── Icons.tsx                    # CHANGED: adds PdfIcon, SpreadsheetIcon,
│   │   │                                # DocumentIcon, ImageIcon, DiagramIcon,
│   │   │                                # MarkupIcon alongside the existing
│   │   │                                # generic FileIcon (fallback) (FR-005,
│   │   │                                # FR-006); plus a small
│   │   │                                # extension→category helper
│   │   ├── FileEditor.tsx               # CHANGED: adds an explicit "Open" /
│   │   │                                # "Download" action wired to the new
│   │   │                                # /api/file/download route, shown
│   │   │                                # alongside the existing "can't be
│   │   │                                # viewed here" message (FR-010)
│   │   └── (Markdown/PlainText/Csv      # UNCHANGED — already generic text
│   │       Editor.tsx)                  # renderers; newly-allowed text types
│   │                                    # (html/xml/css/bpmn) flow through
│   │                                    # PlainTextEditor exactly as any other
│   │                                    # non-.md/.csv text file does today
│   ├── api/
│   │   ├── upload/route.ts              # CHANGED: parses multipart/form-data
│   │   │                                # instead of JSON; validates each
│   │   │                                # entry against the allow-list and the
│   │   │                                # 25 MB cap; passes a Buffer to
│   │   │                                # createFile (FR-001, FR-002, FR-003,
│   │   │                                # FR-004, FR-012)
│   │   ├── file/route.ts                # CHANGED: GET reorders the binary
│   │   │                                # check to run on the extension first
│   │   │                                # (before fetching/decoding content);
│   │   │                                # BINARY_EXTENSIONS gains doc, docx,
│   │   │                                # xls, xlsx (FR-008, FR-009, perf goal)
│   │   ├── file/download/route.ts       # NEW: GET returns an individual
│   │   │                                # file's raw bytes; inline
│   │   │                                # Content-Disposition + real
│   │   │                                # Content-Type only for pdf/jpg/png,
│   │   │                                # attachment + octet-stream otherwise
│   │   │                                # (FR-010, security constraint above)
│   │   └── download-zip/route.ts        # CHANGED: drops the `.md`-only
│   │                                    # filter (via listFilesRecursive),
│   │                                    # zips every file's real Buffer
│   │                                    # content instead of string content
│   │                                    # (FR-011)
├── lib/
│   ├── storage/
│   │   ├── files.ts                     # CHANGED: createFile/updateFile take
│   │   │                                # Buffer (not string); readFile
│   │   │                                # returns Buffer content plus the new
│   │   │                                # contentType field; PutObjectCommand
│   │   │                                # sets ContentType on write (FR-003)
│   │   ├── directories.ts               # CHANGED: listFilesRecursive drops
│   │   │                                # its `.endsWith(".md")` filter
│   │   │                                # (FR-011)
│   │   ├── errors.ts                    # CHANGED: StorageErrorCode gains
│   │   │                                # "unsupported_type" and "too_large"
│   │   │                                # (FR-002, FR-012)
│   │   └── fileTypes.ts                 # NEW: shared allow-list + extension→
│   │                                    # category table used by both the
│   │                                    # upload route (validation) and
│   │                                    # Icons.tsx (icon selection), so the
│   │                                    # two never drift apart
│   └── i18n/dictionaries/*.ts           # CHANGED (all languages): upload
│                                        # menu strings/messages generalized
│                                        # from "Markdown (.md)" wording to the
│                                        # new allow-list; new strings for the
│                                        # unsupported-type/too-large errors
│                                        # and the new Open/Download action
└── ../README.md                         # CHANGED: upload section note updated
                                         # to reflect the broader file-type
                                         # support (no longer ".md only")
```

**Structure Decision**: Single Next.js project at `frontend/` (unchanged from spec 006). No new route segments beyond one new API route (`app/api/file/download/route.ts`); every other change is inside existing files. The one new shared module, `lib/storage/fileTypes.ts`, exists purely to keep the upload allow-list (server-side validation) and the icon category lookup (client-side display) defined once instead of duplicated.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
