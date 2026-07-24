# Data Model: CSV Scrollable Table View

All entities below are client-side/in-memory only (parsed on demand from the same raw file string `FileEditor` already loads via `GET /api/file`); nothing here is persisted or sent to storage. No changes to storage-layer or S3 data shapes.

## CSV Document

The parsed representation of a `.csv` file's raw text.

| Field | Type | Notes |
|---|---|---|
| `headers` | `string[]` | Values of the first row (FR-003). Empty array if the file has no content. |
| `rows` | `string[][]` | One entry per data row (every line after the first); each entry is that row's parsed values, in file order. |
| `truncated` | `boolean` | `true` when the file contained more than `MAX_TABLE_ROWS` (5,000) data rows (FR-012). |
| `totalRowCount` | `number` | Total number of data rows in the file, even when `truncated` is `true` (used for the truncation notice's "N of M rows" text). |

**Derivation rules** (FR-002, FR-008, FR-012):
- Parsing splits on commas, honoring RFC 4180 double-quote escaping (a quoted field may contain commas/newlines; `""` inside a quoted field is a literal `"`).
- The first parsed row becomes `headers`; all rows after it become `rows` entries (Header Row / Data Row split, FR-003).
- Ragged rows are not rejected: a `rows` entry may have fewer or more entries than `headers.length`. Rendering (not parsing) is responsible for treating missing cells as empty and still displaying extra values (FR-008) — the data model does not pad or truncate individual rows.
- Only the first 5,000 data rows are retained in `rows`; if the file has more, `truncated` is set `true` and `totalRowCount` reflects the real total.
- An empty file (`headers` and `rows` both empty) is a valid, representable state — not an error — consumed by the "empty CSV" UI state (FR-009).

## Header Row

Not a separate runtime type — represented as `CsvDocument.headers`. Documented as a distinct entity per the spec because it plays a distinct display role (FR-003: always visible, visually distinguished, stays pinned while scrolling per US2).

## Data Row

Not a separate runtime type — represented as one entry of `CsvDocument.rows` (a `string[]`). Documented separately per the spec because it plays a distinct display role (regular table body row) from the Header Row.

## Column

Not a separate runtime type — implicitly defined by position: column *i* is `headers[i]` paired with `row[i]` across every row. No column metadata (type, width, alignment) is modeled; every column renders as plain text (Assumptions: no type-aware formatting requested).

## EditorSession (extended — `frontend/app/editor/FileEditor.tsx`)

Existing entity from spec 003, extended by this feature:

| Field | Type (before) | Type (after this feature) | Notes |
|---|---|---|---|
| `kind` | `"markdown" \| "text"` | `"markdown" \| "text" \| "csv"` | `deriveKind()` gains a `.csv` extension check, mirroring the existing `.md` check. |

No other `EditorSession` fields change. `currentContent`/`loadedContent` remain the raw file string; the CSV Document is derived from `currentContent` on render/parse, not stored as separate session state — so the existing dirty-check (`currentContent !== loadedContent`, spec 003) and save flow (`PUT /api/file`) are untouched, since edits only ever happen through the existing raw-text view (FR-007).

## View mode (new, component-local state — parallel to Markdown's `mode`)

| Value | Meaning |
|---|---|
| `"table"` | Default on open (parallel to Markdown's `"preview"` default). Read-only table rendering of the CSV Document. |
| `"raw"` | Existing `PlainTextEditor`, reused unchanged, for viewing/editing the raw text (FR-006, FR-007). |

This is local UI state inside a new `CsvTableEditor` (or held in `FileEditor` alongside the existing `mode` state, whichever keeps the `"csv"` and `"markdown"` branches symmetric) — not part of `EditorSession`, matching how Markdown's `preview`/`edit` mode is already handled today.
