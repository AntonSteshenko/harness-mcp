# Feature Specification: Upload and Browse Mixed File Types in Storage

**Feature Branch**: `028-file-storage-upload`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "vorrei caricare anche i file nello storage (pdf, xls, doc, jpg, png, bpmn, html, xml, css, ecc) e vederli loro con le icone, aprire solo quelli txt leggibili, non binari)" (I'd also like to upload files into storage — pdf, xls, doc, jpg, png, bpmn, html, xml, css, etc. — and see them with icons; only open the ones that are readable text, not binary ones.)

## Clarifications

### Session 2026-08-07

- Q: Should uploads be restricted to a safe allow-list of recognized types, or should any file type be accepted? → A: Restrict to an allow-list of recognized safe types (documents, spreadsheets, images, diagrams, markup, archives); reject anything else with a clear message.
- Q: Should individual (non-text) files be downloadable, given today only whole-folder zip download exists? → A: Yes — add single-file retrieval; for types the browser can natively render (PDF, images), retrieving the file also opens it directly in a new browser tab/window, not just as a forced download.
- Q: Should newly-supported readable text formats (HTML, XML, CSS, BPMN, etc.) be fully editable and savable, or read-only? → A: Fully editable and savable, the same as Markdown files today.
- Q: What per-file upload size limit should apply? → A: 25 MB per file.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload files of any common type into storage (Priority: P1)

A user browsing a folder in the file storage area wants to add documents, spreadsheets, images, and diagrams they already have — not just Markdown notes — so that storage becomes a general place to keep project files, not a notes-only space.

**Why this priority**: Today, uploading anything other than a `.md` file is silently rejected. This is the core gap the request calls out, and without it, none of the rest of the feature (icons, viewing) has anything to act on.

**Independent Test**: Can be fully tested by selecting a mix of files (e.g., a `.pdf`, a `.jpg`, a `.docx`, an `.xml`) via the existing upload action and confirming all of them appear in the folder's file listing afterward, with their content intact.

**Acceptance Scenarios**:

1. **Given** a folder in storage, **When** a user uploads a PDF, spreadsheet, word-processor document, image, BPMN diagram, HTML, XML, or CSS file (individually or as a mixed batch), **Then** each file is stored under that folder and appears in the folder's listing.
2. **Given** a user uploads a batch of files of several different types at once, **When** the upload completes, **Then** the user sees a summary of how many files were uploaded successfully and which (if any) failed, consistent with today's batch-upload feedback.
3. **Given** a user uploads a file whose content is binary (e.g., an image or a PDF), **When** the file is later downloaded or otherwise retrieved, **Then** its content is byte-for-byte identical to the original — uploading and storing a binary file must not corrupt it.
4. **Given** a user re-uploads a file with the same name as one that already exists in the target folder, **When** they confirm the overwrite (as already happens for Markdown files today), **Then** the existing file is replaced.

---

### User Story 2 - Recognize file types at a glance via icons (Priority: P2)

A user scanning a folder with a mix of file types wants to tell at a glance which entries are PDFs, images, spreadsheets, documents, diagrams, or code/markup files, without having to open each one or read the extension carefully.

**Why this priority**: Once mixed file types can be uploaded (P1), a folder listing where every entry looks identical becomes hard to scan. Distinct icons make the newly-unlocked variety of content usable day to day, but the feature already delivers value without this polish.

**Independent Test**: Can be fully tested by uploading one file of each supported type into a folder and confirming the file listing shows a visually distinct icon per type (e.g., a PDF is visually distinguishable from a JPEG, which is visually distinguishable from a spreadsheet).

**Acceptance Scenarios**:

1. **Given** a folder contains files of different recognized types, **When** the user views that folder's listing, **Then** each file shows an icon representing its type (e.g., PDF, spreadsheet, document, image, diagram, markup/code) rather than one generic file icon for everything.
2. **Given** a file's type is not one of the specifically recognized ones, **When** the user views the listing, **Then** the file still shows a sensible generic file icon rather than an error or a blank space.
3. **Given** a folder mixes recognized and unrecognized file types, **When** the user views the listing, **Then** icons remain visually consistent in size and style regardless of type.

---

### User Story 3 - Only open text files for viewing, not binary ones (Priority: P1)

A user clicks on a file in storage expecting to view or edit its contents. If the file is genuinely readable text (like `.txt`, `.md`, `.html`, `.xml`, `.css`, or similar), it opens as it does today. If the file is a binary format (like a PDF, image, or Word/Excel document), the user is told clearly that it can't be viewed here, instead of seeing corrupted or garbled content.

**Why this priority**: This is a data-integrity and trust concern, not just polish — attempting to open a binary file as text can produce nonsense on screen or, if edited and saved back, silently corrupt the file. This must hold from the moment mixed file types can be uploaded (P1), so it shares top priority.

**Independent Test**: Can be fully tested by uploading one text file (e.g., `.txt`) and one binary file (e.g., `.png`), opening each from the folder listing, and confirming the text file's content displays correctly while the binary file shows a clear "can't be viewed here" message instead of its raw content.

**Acceptance Scenarios**:

1. **Given** a readable text file (e.g., `.txt`, `.md`, `.html`, `.xml`, `.css`) in storage, **When** the user opens it from the folder listing, **Then** its text content is displayed, consistent with how Markdown files open today.
2. **Given** a binary file (e.g., `.pdf`, `.jpg`, `.png`, `.doc`, `.xls`) in storage, **When** the user clicks it in the folder listing, **Then** the system does not attempt to display its raw content, and instead shows a clear message explaining the file can't be opened for viewing here.
3. **Given** a binary file that cannot be opened for editing/viewing inline in the file browser, **When** the user still wants to access it, **Then** they can retrieve the individual file — for types the browser itself can natively display (e.g., PDF, JPG, PNG), it opens directly in a new browser tab; for other types, it downloads to their device.

---

### Edge Cases

- What happens when a user tries to upload a file type that isn't on the allowed list (e.g., an executable, script, or other unrecognized/unsafe extension)? The upload is rejected for that file with a clear message explaining the type isn't supported, while any other valid files in the same batch still succeed.
- What happens when a file has no extension, or an extension that doesn't match its actual content (e.g., an image renamed to end in `.txt`)? The system should rely on the same "does this look like text" judgment already used for the binary-open guard rather than trusting the extension alone, so mislabeled files still don't render as garbage.
- What happens when a file larger than the 25 MB per-file limit is uploaded? That file is rejected with a clear size-related error message; it is not silently truncated or corrupted, and other files in the same batch are unaffected.
- What happens when a user uploads a file with the same name as an existing file of a different type (e.g., uploading `report.pdf` when `report.pdf` already exists as a different file)? The existing overwrite-confirmation behavior applies.
- What happens when a user uploads a mixed batch where some files are valid, one is oversized, and one has a name collision? Each file in the batch should succeed or fail independently, with a clear per-file result, consistent with today's batch-upload summary.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to upload files of common document, spreadsheet, image, diagram, and markup types — including at minimum PDF, XLS/XLSX, DOC/DOCX, JPG/JPEG, PNG, BPMN, HTML, XML, and CSS — into any folder in storage, in addition to the Markdown files supported today.
- **FR-002**: The system MUST restrict uploads to an allow-list of recognized safe file types (documents, spreadsheets, images, diagrams, markup, and common archive formats), and MUST reject any file type outside that allow-list with a clear message explaining the type isn't supported.
- **FR-003**: The system MUST preserve uploaded binary file content exactly (byte-for-byte) through upload, storage, and later retrieval/download — the current text-only upload path is not sufficient for these types.
- **FR-004**: When uploading multiple files at once, the system MUST report a per-file outcome (uploaded, skipped, or failed) rather than an all-or-nothing result, consistent with existing batch-upload behavior.
- **FR-005**: The system MUST display a distinct icon for each recognized file category (at minimum: PDF, spreadsheet, word-processor document, image, diagram, and markup/code) in the folder listing.
- **FR-006**: The system MUST display a generic fallback icon for allowed file types that don't fall into one of the specific icon categories, so every stored file always has an icon.
- **FR-007**: When a user opens a file that is genuinely readable text, the system MUST display and allow editing and saving of its content, regardless of whether that file type is newly supported by this feature (e.g., `.html`, `.xml`, `.css`, `.bpmn`) or previously supported (`.md`) — the same view/edit/save capability applies uniformly to every text-readable file.
- **FR-008**: When a user attempts to open a file that is binary (not readable text), the system MUST NOT render its raw content, and MUST instead show a clear message explaining that the file can't be viewed/edited here.
- **FR-009**: The determination of whether a file is text-viewable MUST NOT rely solely on its file extension, so that a mislabeled or misidentified file does not get rendered as garbled text.
- **FR-010**: Users MUST be able to retrieve any individual file that can't be opened for editing/viewing inline in the file browser — for file types the browser can natively render (e.g., PDF, JPG, PNG), retrieval MUST open the file directly in a new browser tab/window; for other types, retrieval downloads the file to the user's device.
- **FR-011**: Existing storage operations on files (rename/move, delete, folder download as a zip) MUST continue to work unchanged for the newly supported file types.
- **FR-012**: The system MUST reject any individual uploaded file larger than 25 MB with a clear size-related error message, without discarding the rest of a batch upload.

### Key Entities

- **Stored File**: A file within a storage folder. Gains an inferred type/category (used to pick its icon and to decide whether it's text-viewable) and binary-safe content, in addition to the path, size, and last-modified attributes it already has today.
- **File Type Category**: A grouping used purely for choosing a display icon (e.g., PDF, spreadsheet, document, image, diagram, markup/code, generic/other). Distinct from the text-vs-binary judgment used to decide whether a file can be opened for viewing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully upload files of every listed type (PDF, XLS/XLSX, DOC/DOCX, JPG/JPEG, PNG, BPMN, HTML, XML, CSS), up to 25 MB each, and see them appear in the folder listing within 10 seconds of upload completing.
- **SC-002**: 100% of uploaded binary files, when downloaded afterward, are byte-for-byte identical to the originally uploaded file.
- **SC-003**: Users can visually distinguish at least 5 different file categories in a mixed folder listing by icon alone, without needing to read the file name.
- **SC-004**: 100% of attempts to open a binary file inline in the file browser result in a clear explanatory message rather than garbled or corrupted content being displayed.
- **SC-005**: 100% of attempts to open a genuinely text-readable file (of any supported type, not just Markdown) succeed in displaying its content.
- **SC-006**: Users can retrieve any uploaded binary file in under 2 seconds from the folder listing — natively-renderable types (PDF, JPG, PNG) opening directly in a new browser tab, others downloading to the device.

## Assumptions

- "Opening" a file inline (in the existing file browser/editor pane) means viewing, and where already supported, editing its content — this feature does not build a custom in-app previewer for binary formats (e.g., no bespoke PDF or image renderer embedded in the editor pane). Instead, binary files that the browser itself knows how to render (PDF, JPG, PNG, etc.) open in a new browser tab using the browser's own native viewer when retrieved; other binary types download to the user's device.
- The text-vs-binary judgment reuses and extends the same kind of content-based heuristic already used today to block opening files like images or PDFs, rather than introducing an entirely separate mechanism, so behavior stays consistent across old and new file types.
- Upload entry points, per-file batch results, and overwrite-confirmation behavior follow the same patterns as the existing Markdown-only upload feature; this feature broadens what file types flow through those existing patterns rather than redesigning the upload UX.
- "xls" and "doc" are treated as covering both legacy (`.xls`, `.doc`) and modern (`.xlsx`, `.docx`) formats, since both are binary and both are commonly meant when users say "Excel" or "Word" files.
- Icon categories are based on common file-type families (document/PDF, spreadsheet, word-processor document, image, diagram, markup/code) rather than one icon per individual extension; new extensions within an existing category reuse that category's icon.
