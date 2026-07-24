# Research: CSV Scrollable Table View

## 1. CSV parsing approach

**Decision**: Hand-roll a small RFC 4180-style CSV parser (comma delimiter, double-quote escaping, `""` for an embedded quote, quoted fields may contain commas/newlines) as a plain TypeScript function in `frontend/lib/csv.ts`. No new npm dependency.

**Rationale**:
- The spec's parsing requirements (FR-002, FR-008) are narrow: split on commas, honor double-quote escaping, tolerate ragged rows. This is well-understood, ~50-line logic with no ambiguous edge cases left to a library's opinions.
- The project currently has zero CSV-parsing dependencies (`frontend/package.json` confirmed — CodeMirror, react-markdown, AWS SDK, MCP SDK, jszip, zod only). Adding one for this alone is disproportionate.
- Keeps bundle size and audit surface unchanged, consistent with the project's pattern so far of preferring small hand-written helpers (e.g., `frontend/lib/storage/paths.ts`) over pulling in a library for a well-scoped parsing task.

**Alternatives considered**:
- `papaparse` — most popular CSV parser, handles many real-world quirks (BOM, auto-delimiter detection) the spec explicitly puts out of scope (Assumptions: comma-only, extension-based detection). Rejected: brings a dependency (and its own edge-case surface) for capability this feature doesn't need.
- `csv-parse` — Node-oriented streaming parser; less suited to a synchronous in-browser parse of an already-fully-loaded string. Rejected for the same reason as `papaparse`, plus a heavier API for this use case.

## 2. Rendering a capped, scrollable table (up to 5,000 rows)

**Decision**: Render a plain HTML `<table>` inside a `div` with `overflow: auto` and a fixed max-height (matching the `60vh` convention already used by `MarkdownEditor`/`PlainTextEditor`), with the header row's cells set to `position: sticky; top: 0` for vertical scroll and the wrapping div handling horizontal scroll for wide tables. No virtualization library.

**Rationale**:
- The clarified row cap (FR-012: max 5,000 rendered rows, truncation notice beyond that) keeps worst-case DOM size bounded (5,000 rows × N columns), which is well within what a plain `<table>` renders and scrolls smoothly in modern browsers — virtualization exists to solve unbounded-list problems this feature no longer has.
- Sticky headers via CSS need no JS and match the "no new dependency" pattern of decision #1.
- Simpler to review/test/maintain than introducing `react-window`/`react-virtualized` (or similar) purely to shave rendering cost that isn't a proven problem at this scale.

**Alternatives considered**:
- `react-window` (windowed/virtualized list rendering) — would let the app support rendering far beyond 5,000 rows smoothly, but that capability was explicitly deferred by the clarification answer (soft cap + notice, not unbounded virtualization). Revisit only if a future spec removes the cap.
- CSS `content-visibility: auto` on rows instead of a real cap — interesting, but browser support/behavior with sticky headers and horizontal scroll is less predictable than an explicit render cap; the explicit cap is also what the spec's clarification session settled on.

## 3. Where CSV rendering plugs into the existing editor

**Decision**: Extend `EditorSession["kind"]` (`frontend/app/editor/FileEditor.tsx`) with a third value, `"csv"`, alongside the existing `"markdown" | "text"`. `deriveKind()` gains a `.csv` branch (checked the same way as the existing `.md` branch). A new `CsvTableEditor` component (parallel to `MarkdownEditor`) renders the table view or, in `"raw"` mode, reuses the existing `PlainTextEditor` for editing — mirroring the current `mode: "preview" | "edit"` toggle already implemented for Markdown, renamed `"table" | "raw"` for this kind.

**Rationale**:
- This is the exact pattern the codebase already uses for Markdown (spec 003/004): extension-based `kind` detection, a mode toggle rendered only for kinds that have more than one view, single-view-at-a-time rendering. Reusing it means no new state-management concept, and `FileEditor.tsx`'s save/dirty/error handling (already kind-agnostic) needs no changes.
- Reusing `PlainTextEditor` for the raw/edit view (rather than building a second raw-text editor) satisfies FR-006/FR-007 (edits happen in the raw view, table view is read-only) with no duplicated code.

**Alternatives considered**:
- A single component handling both parsing and raw editing internally (no shared `PlainTextEditor` reuse) — rejected, duplicates existing, working raw-text editing behavior for no benefit.
- Auto-detecting CSV-like content regardless of extension — explicitly ruled out in the spec's Assumptions (extension-only detection, matching `.md`).

## 4. Testing / validation approach

**Decision**: No automated test suite exists in this project (`frontend/package.json` has no `test` script, no Jest/Vitest/Playwright config found anywhere outside `node_modules`). Consistent with specs 001–011, validation is manual: a `quickstart.md` walkthrough against a running `next dev` instance, covering the well-formed, empty, header-only, ragged-row, and over-cap CSV cases from the spec's acceptance scenarios.

**Rationale**: Matches established project convention (see `specs/011-mcp-file-trash/plan.md` §Technical Context); introducing a test framework is out of scope for this feature and not requested.
