# Feature Specification: CSV Scrollable Table View

**Feature Branch**: `[012-csv-scrollable-table]`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: "se è un file .csv deve mostrarlo come tabella scrollabile" (if it's a .csv file, it must show it as a scrollable table)

## Clarifications

### Session 2026-07-24

- Q: For CSV files larger than the performance target, must the table remain fully scrollable for files of any size, or should rendering cap out with a notice? → A: Soft cap with a notice — render up to a defined maximum number of rows (5,000) and show a clear message if the file has more, rather than requiring unbounded virtualization or falling back entirely to the raw-text view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a CSV file as a table (Priority: P1)

A user opens a `.csv` file in the file editor. Instead of seeing raw comma-separated text, the file's contents are rendered as a structured table, with each row of the file shown as a table row and each comma-separated value shown in its own column, so the user can read and scan the data the way it was meant to be consumed.

**Why this priority**: This is the core value of the feature — without it, there is no difference from today's plain-text rendering. It is the minimum needed to deliver value.

**Independent Test**: Open any `.csv` file with multiple rows and columns; verify the content renders as a table (rows/columns) rather than as a single block of raw text.

**Acceptance Scenarios**:

1. **Given** a user opens a `.csv` file with a header row and several data rows, **When** the file finishes loading, **Then** the first row is displayed as the table's column headers and each subsequent row is displayed as a table row, with values split into columns at each comma.
2. **Given** a `.csv` file is displayed as a table, **When** the user resizes the editor or views it on a smaller screen, **Then** the table remains readable (e.g., via horizontal scrolling) rather than breaking the layout.

---

### User Story 2 - Scroll through large CSV files (Priority: P1)

A user opens a `.csv` file that has more rows than fit in the visible editor area. The table can be scrolled vertically to reveal additional rows, while staying responsive and easy to navigate.

**Why this priority**: The user's request explicitly calls out "scrollable" — a table that shows only the first screenful of rows with no way to see the rest does not satisfy the request.

**Independent Test**: Open a `.csv` file with enough rows to exceed the visible area; verify the user can scroll down to see all remaining rows, and that column headers stay visible/identifiable while scrolling.

**Acceptance Scenarios**:

1. **Given** a `.csv` file with more rows than fit on screen, **When** the user scrolls down within the table, **Then** additional rows progressively become visible and the column headers remain visible for reference.
2. **Given** a `.csv` file with more columns than fit on screen, **When** the user scrolls horizontally, **Then** additional columns become visible without breaking row alignment.

---

### User Story 3 - Fall back gracefully for non-tabular or malformed CSV content (Priority: P2)

A user opens a `.csv` file that is empty, has only a header row, or has inconsistent/malformed rows (e.g., rows with a different number of values than the header, or values containing quoted commas). The system still displays something sensible rather than failing.

**Why this priority**: Real-world CSV files are frequently imperfect. This story protects the core experience from breaking on edge-case input, but it is secondary to getting the well-formed case right.

**Independent Test**: Open an empty `.csv` file, a header-only `.csv` file, and a `.csv` file with ragged rows; verify each renders a table (or a clear empty state) without errors.

**Acceptance Scenarios**:

1. **Given** a `.csv` file that contains only a header row and no data rows, **When** the file is opened, **Then** the table displays the header with an indication that there is no data.
2. **Given** a `.csv` file that is completely empty, **When** the file is opened, **Then** the editor shows a clear empty-state message instead of an empty or broken table.
3. **Given** a `.csv` file with rows that have fewer or more values than the header row, **When** the file is opened, **Then** the table still renders every row, filling missing cells as empty and handling extra values without crashing.
4. **Given** a `.csv` file with quoted values containing commas or line breaks, **When** the file is opened, **Then** those values are treated as a single column value rather than being split incorrectly.

---

### Edge Cases

- What happens when a file has a `.csv` extension but its content is not actually comma-separated (e.g., it's plain prose, or uses a different delimiter like `;` or tab)? The system still attempts to render it as a table using comma as the delimiter; if this produces a single column, the file still displays without error.
- What happens when a `.csv` file is very large (many thousands of rows)? The table renders up to the maximum row count (5,000) and remains scrollable and responsive within that range; if the file has more rows than the maximum, a clear truncation notice is shown alongside the (partial) table (see FR-012, SC-002).
- What happens when a file has a different extension (e.g., `.txt`) but contains comma-separated data? Out of scope — table rendering is triggered by the `.csv` extension only, consistent with how the existing editor already chooses rendering by extension.
- What happens when the user needs to see or edit the exact raw text of the file (e.g., to fix a formatting problem)? See FR-006/FR-007.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect files with a `.csv` extension and render their content as a table instead of as a plain-text/raw view.
- **FR-002**: The system MUST split each line of the CSV file into columns using a comma as the field delimiter, honoring standard CSV quoting rules (a comma or line break inside double-quoted values does not split the value).
- **FR-003**: The system MUST treat the first row of the file as column headers and display it distinctly from the data rows (e.g., visually distinguished, such as bold or a different background).
- **FR-004**: The table MUST support vertical scrolling so that all rows in the file can be viewed when there are more rows than fit in the visible area.
- **FR-005**: The table MUST support horizontal scrolling (or equivalent) so that all columns can be viewed when there are more columns than fit in the visible width.
- **FR-006**: Users MUST be able to switch from the table view to a raw-text view of the same `.csv` file, and back, without losing their place in the file.
- **FR-007**: The system MUST NOT allow direct editing of cell values within the table view; content changes to a `.csv` file are made through the existing raw-text editing view. The table view is read-only.
- **FR-008**: The system MUST handle rows with a different number of values than the header row (ragged rows) by rendering them without errors — missing values shown as empty cells, extra values still visible.
- **FR-009**: The system MUST display a clear empty-state message when a `.csv` file has no content, instead of showing a blank or broken table.
- **FR-010**: The system MUST display a header-only `.csv` file (headers but no data rows) with its headers visible and a clear indication that there is no data.
- **FR-011**: The system MUST remain responsive (scrolling and initial render) for CSV files containing up to 5,000 rows without freezing the browser.
- **FR-012**: When a `.csv` file contains more than 5,000 rows, the system MUST render only the first 5,000 rows as a table and MUST display a clear, visible notice indicating the table has been truncated and how many total rows the file contains.

### Key Entities

- **CSV Document**: The parsed representation of a `.csv` file's content, made up of an ordered list of rows.
- **Header Row**: The first row of a CSV Document, used to label each column in the table.
- **Data Row**: Any row after the header row, containing one value per column.
- **Column**: A single field position across all rows, identified by its header label and its position.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a user opens a `.csv` file, the content appears as a table (not raw comma-separated text) in 100% of cases where the file has a `.csv` extension.
- **SC-002**: Users can scroll through and view every row of a `.csv` file containing up to 5,000 rows without noticeable lag or the browser becoming unresponsive; files beyond that size still open successfully, with a clear notice that the table view has been truncated.
- **SC-003**: Users can identify which row is the header row and which rows are data, without needing any explanation, in a first-glance view of the table.
- **SC-004**: Malformed CSV files (empty, header-only, or ragged rows) never produce a visible error or a blank screen — some sensible table or empty-state message is always shown.
- **SC-005**: Users can switch between the table view and the raw-text view of a `.csv` file in a single action (e.g., one click/tap).

## Assumptions

- CSV detection is based solely on the `.csv` file extension, consistent with how the existing editor already chooses rendering (e.g., `.md` triggers Markdown rendering) — no content-sniffing for other delimiters or auto-detection of CSV-like `.txt` files is required.
- Standard CSV parsing conventions apply: comma as the delimiter, double quotes for escaping values that contain commas, quotes, or line breaks.
- The first row of the file is always treated as the header row; there is no per-file setting to indicate a file has no header row.
- No new hard file-size limit is introduced beyond what the underlying storage/editor already supports for reading/opening a file; the table view itself renders at most 5,000 rows and shows a truncation notice beyond that (see FR-012), so it does not need unbounded virtualized scrolling.
- The table view is read-only, matching the "view first" pattern already used for Markdown preview; editing continues to happen through the existing raw-text view, reached via the same kind of toggle already used for Markdown preview/edit.
