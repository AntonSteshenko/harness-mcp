# Quickstart: Validate CSV Scrollable Table View

Manual validation guide (this project has no automated test suite — see `research.md` §4). Run these scenarios against a running `next dev` instance after implementation, covering the acceptance scenarios from `spec.md`.

## Prerequisites

- MinIO/S3-compatible storage stack running and configured (spec 001), same as required for the existing file editor.
- `frontend`: `npm install && npm run dev`, then sign in at `/editor` (spec 008/009 owner session).
- A way to create/upload `.csv` files into the configured bucket — either the editor's own "create file" (spec 005) + raw-text paste, or the upload flow (spec 004).

## Scenario 1 — Well-formed CSV renders as a table (US1, FR-001/002/003)

1. Create `sample.csv` with:
   ```csv
   name,age,city
   Alice,30,Rome
   Bob,25,Milan
   ```
2. Open `sample.csv` in the editor.
3. **Expect**: content renders as a table, not raw text; header row (`name, age, city`) is visually distinct from the two data rows; each value lands in its own column.

## Scenario 2 — Vertical + horizontal scrolling (US2, FR-004/005)

1. Create a `.csv` file with a header row plus ~200 data rows (enough to exceed the visible viewport) and at least 10 columns wide enough to exceed the visible width.
2. Open it in the editor.
3. **Expect**: scrolling down reveals additional rows while the header row stays visible/pinned; scrolling right reveals additional columns without breaking row alignment.

## Scenario 3 — Table / Raw toggle (FR-006, FR-007)

1. With any `.csv` file open in table view, switch to the raw view.
2. **Expect**: raw view shows the exact underlying text (same as `PlainTextEditor` today) and is editable; switching back to table view re-renders the (possibly edited) content as a table; no cell in the table view itself is directly editable.
3. Edit the raw text, save (existing `PUT /api/file` flow), reopen — confirm the table view reflects the saved change.

## Scenario 4 — Empty file (US3, FR-009)

1. Create an empty `sample-empty.csv` (zero bytes).
2. Open it in the editor.
3. **Expect**: a clear empty-state message, not a blank or broken table.

## Scenario 5 — Header-only file (US3, FR-010)

1. Create `sample-header-only.csv` with just: `name,age,city`
2. Open it in the editor.
3. **Expect**: header row renders, with a clear indication there is no data below it.

## Scenario 6 — Ragged rows (US3, FR-008)

1. Create a `.csv` file where some rows have fewer/more values than the header:
   ```csv
   name,age,city
   Alice,30
   Bob,25,Milan,ExtraValue
   ```
2. Open it in the editor.
3. **Expect**: both rows render without errors — the short row shows an empty cell for the missing `city` value; the long row's extra value is still visible (not silently dropped, not crashing).

## Scenario 7 — Quoted values with embedded commas/newlines (US3, FR-002)

1. Create a `.csv` file:
   ```csv
   name,note
   Alice,"Likes coffee, tea, and cocoa"
   Bob,"Multi-line
   note"
   ```
2. Open it in the editor.
3. **Expect**: `Alice`'s note renders as one cell containing commas (not split into extra columns); `Bob`'s multi-line note renders as one cell.

## Scenario 8 — Over-cap file shows a truncation notice (FR-012, SC-002)

1. Create a `.csv` file with a header row plus more than 5,000 data rows (e.g., 5,050).
2. Open it in the editor.
3. **Expect**: the table renders the first 5,000 data rows, remains scrollable/responsive, and a clear, visible notice states the table was truncated and how many total rows the file contains (e.g., "Showing 5,000 of 5,050 rows").

## Scenario 9 — Non-`.csv` file unaffected

1. Open an existing `.md` or `.txt` file.
2. **Expect**: no change in behavior from before this feature — Markdown files still show the preview/edit toggle; plain-text files still show the existing textarea. Confirms `kind` derivation only adds a new branch and doesn't regress existing kinds.
