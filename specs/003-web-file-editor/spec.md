# Feature Specification: Web File Explorer & Markdown Editor

**Feature Branch**: `003-web-file-editor`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Aggiungere una interfaccia web (nella stessa app Next.js del server MCP) per esplorare la struttura di file e cartelle dello storage S3 locale, aprire e modificare i file. L'uso principale è modificare file Markdown (.md), quindi serve un editor Markdown dedicato con anteprima live affiancata (split-view: markdown a sinistra, anteprima renderizzata a destra). Per altri tipi di file basta un editor di testo semplice come fallback. Deve riusare il layer di storage già esistente (lib/storage/*) creato per il server MCP."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and view files (Priority: P1)

As a user, I want to see the folder/file structure of my local storage in a web page and open any file to view its current content, so that I can find and inspect what's stored without using a separate command-line tool or S3 client.

**Why this priority**: This is the foundation — nothing else in this feature is reachable without a way to see what exists and open something. It also delivers standalone value: a quick, browser-based way to inspect stored content.

**Independent Test**: Can be fully tested by opening the web page, confirming the existing folder/file structure is displayed, expanding into a subfolder, and opening a file to confirm its content is shown correctly.

**Acceptance Scenarios**:

1. **Given** the storage contains folders and files, **When** the user opens the web interface, **Then** the folder/file structure is displayed as a browsable tree.
2. **Given** a folder in the tree, **When** the user expands it, **Then** its direct contents (files and subfolders) are shown, without needing a full page reload.
3. **Given** a file in the tree, **When** the user selects it, **Then** its current content is displayed in a viewing/editing area.
4. **Given** an empty folder, **When** the user expands it, **Then** it clearly shows as empty rather than looking broken or unresponsive.

---

### User Story 2 - Edit Markdown files with live preview (Priority: P2)

As a user, I want to edit a Markdown (`.md`) file in a split view — raw Markdown text on one side, its rendered preview updating live on the other — and save my changes, so that I can write and review formatted notes/documentation without switching tools.

**Why this priority**: This is the explicitly stated primary use case for the whole feature — most of the value of this feature, for this user, is here.

**Independent Test**: Can be fully tested by opening a Markdown file, typing a change (e.g., adding a heading), confirming the rendered preview updates to reflect it, saving, and reloading the file to confirm the change persisted.

**Acceptance Scenarios**:

1. **Given** a Markdown file is open, **When** the user views it, **Then** the raw Markdown text and its rendered preview are shown side by side.
2. **Given** the Markdown editor is open, **When** the user types a change, **Then** the rendered preview updates to reflect it without requiring a manual refresh or save.
3. **Given** unsaved changes exist in the editor, **When** the user saves, **Then** the new content is persisted to storage and the interface clearly indicates the save succeeded.
4. **Given** unsaved changes exist, **When** the user tries to navigate away from the file (e.g., opens a different file), **Then** the interface warns them before discarding the unsaved changes.
5. **Given** a save fails (e.g., storage temporarily unreachable), **When** the failure occurs, **Then** the user sees a clear error and their edits remain visible in the editor (not lost).

---

### User Story 3 - Edit other text files (Priority: P3)

As a user, I want to open and edit non-Markdown files in a simple plain-text editor and save my changes, so that the tool is still useful for quick edits to other text-based files, not just Markdown.

**Why this priority**: Completes the "open and modify files" ask for the general case, but is explicitly secondary to the Markdown experience that motivated this feature.

**Independent Test**: Can be fully tested by opening a non-Markdown text file, editing its content, saving, and reloading it to confirm the change persisted.

**Acceptance Scenarios**:

1. **Given** a non-Markdown file is open, **When** the user views it, **Then** it is shown in a plain-text editor (no Markdown rendering/preview).
2. **Given** unsaved changes exist in the plain-text editor, **When** the user saves, **Then** the new content is persisted to storage and the interface confirms the save succeeded.

---

### Edge Cases

- What happens when the user opens a file that isn't text (e.g., an image or other binary content)? The system MUST recognize it isn't editable as text and communicate that clearly, rather than displaying garbled content or crashing the editor.
- What happens when a file is deleted or moved (e.g., via another tool) while it's open in the editor? Attempting to save MUST surface a clear error rather than silently creating an unexpected new file or failing invisibly.
- What happens when the underlying local storage is unreachable when the user tries to browse, open, or save? The system MUST show a clear error rather than an empty tree, a stuck loading state, or a silent failure.
- What happens when two browser tabs have the same file open and both save changes? The system MUST NOT corrupt the file — the last completed save simply becomes the current content (consistent with this project's existing single-active-editor assumption; see Assumptions).
- What happens when the user opens a very large file? The system MUST remain usable (no crash), even if performance on extremely large files is not specially optimized.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the folder/file structure of the local storage as a browsable, expandable tree in a web page.
- **FR-002**: System MUST allow the user to open any file from the tree to view its current content.
- **FR-003**: System MUST provide a dedicated Markdown editing view for `.md` files, showing the raw Markdown text and a live-updating rendered preview side by side (split view).
- **FR-004**: System MUST update the rendered Markdown preview as the user types, without requiring a manual refresh or save.
- **FR-005**: System MUST allow the user to save changes to an open Markdown file, persisting the new content to storage.
- **FR-006**: System MUST provide a plain-text editing view for non-Markdown files opened for editing.
- **FR-007**: System MUST allow the user to save changes to an open non-Markdown text file, persisting the new content to storage.
- **FR-008**: System MUST visibly indicate when a file has unsaved changes, and clearly confirm when a save has succeeded.
- **FR-009**: System MUST warn the user before discarding unsaved changes (e.g., when navigating to a different file).
- **FR-010**: System MUST show a clear, specific error — without losing the user's in-progress edits — when a save fails.
- **FR-011**: System MUST detect when an opened file is not text-editable (e.g., binary/image content) and present that clearly instead of attempting to display or edit it as text.
- **FR-012**: System MUST reuse the project's existing storage operations (already built for the MCP server) for all browsing, reading, and saving — this feature does not introduce a second, separate way of talking to storage.

### Key Entities

- **File** and **Directory**: The same storage concepts already defined for this project (see spec 002-s3-mcp-server's data model) — a path-addressable piece of content and a hierarchical grouping of files/subdirectories, respectively. This feature only adds a browsing/editing surface on top of them; it does not change what they are.
- **Editor Session**: The in-browser state of a currently open file — which file, its last-loaded content, its current (possibly edited) content, and whether it has unsaved changes. Exists only in the browser; not persisted anywhere until a save occurs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from opening the web interface to viewing the content of any stored file in under 3 clicks/interactions.
- **SC-002**: When editing a Markdown file, the rendered preview reflects a typed change in under half a second, so it reads as "live."
- **SC-003**: Saving a typical file completes, with clear success confirmation, in under 2 seconds.
- **SC-004**: 100% of failed save attempts show a clear error and leave the user's edits intact in the editor (zero silent data loss).
- **SC-005**: Users can successfully open, edit, and save both Markdown and non-Markdown text files without needing any tool or knowledge beyond the web page itself.

## Assumptions

- This feature is a UI layer added to the existing project (spec 001 local storage, spec 002 storage operations); it introduces no new storage/auth model and reuses the local, single-developer, no-authentication posture already established.
- Explicit save (not autosave) is the expected interaction, consistent with the requested "IDE-style" experience — changes are only persisted when the user saves, with a clear unsaved-changes indicator in the meantime.
- Creating, deleting, and renaming files/folders from this web interface are out of scope for this feature — it covers browsing, opening, editing, and saving *existing* files. (Those operations already exist as MCP tools per spec 002 for other clients; adding a UI for them can be a future extension.)
- "Text-editable" is judged by whether the file's content can be reasonably treated/displayed as text; binary formats (images, etc.) are explicitly out of scope for viewing/editing in this feature.
- Single active editor per file is assumed, consistent with spec 002's concurrency assumption (FR-015 there) — no locking or conflict-merging between simultaneous editors of the same file.
