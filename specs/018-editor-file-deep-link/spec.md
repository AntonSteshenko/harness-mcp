# Feature Specification: Editor File Deep Linking via URL

**Feature Branch**: `018-editor-file-deep-link`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "editor: E possibile avere intero path di file in url, non solo in header? E se è inserito in url caricare proprio questo file" (Is it possible to have the full file path in the URL, not just as internal state? And if it's present in the URL, load that specific file.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a file directly via a shared link (Priority: P1)

A user receives a link (from a colleague, an email, a chat message, or a bookmark) that points at a specific file in the editor. Opening that link takes them straight into the editor with that exact file loaded and ready to view or edit, without having to manually browse the file tree to find it.

**Why this priority**: This is the core of the request — today a file can only be opened by clicking through the tree, which makes it impossible to share or bookmark a direct reference to a specific file. This is the minimum change that delivers value.

**Independent Test**: Can be fully tested by taking the URL for a known file, opening it in a fresh browser session (already authenticated), and confirming the correct file's content loads automatically with no additional clicks.

**Acceptance Scenarios**:

1. **Given** a valid file exists at a known path, **When** an authenticated user opens the editor URL containing that file's full path, **Then** the editor loads and immediately displays that file's content, with the file also shown as selected in the file tree.
2. **Given** a user is already using the editor with a different file open, **When** they open a new browser tab with a URL pointing at another valid file, **Then** the new tab loads with the correct file open, independent of the first tab's state.

---

### User Story 2 - URL stays in sync while browsing files (Priority: P2)

As a user clicks through different files — and folders — in the file tree, the browser's address bar reflects whichever file or folder is currently in view. This lets them use the browser's back/forward buttons to move between recently viewed files and folders, refresh the page without losing their place, and copy the current URL at any time to share or bookmark it.

**Why this priority**: This makes the deep link a two-way feature — useful, but secondary to simply being able to open a shared link at all (P1).

**Independent Test**: Can be fully tested by opening the editor, clicking through two or three different files in the tree, then using the browser back button and confirming each previously opened file reappears in order, and refreshing the page and confirming the last-opened file is still shown.

**Acceptance Scenarios**:

1. **Given** the editor is open with no file selected, **When** the user selects a file from the file tree, **Then** the URL updates to reference that file's path without a full page reload.
2. **Given** the user has opened several files in sequence, **When** they click the browser's back button, **Then** the editor displays the previously open file and the URL matches it.
3. **Given** a file is currently open, **When** the user refreshes the browser page, **Then** the same file reopens automatically.
4. **Given** the editor is open, **When** the user clicks a folder in the file tree, **Then** the URL updates to reference that folder's path (the same way selecting a file does), without a full page reload.

---

### User Story 3 - Graceful handling of invalid or inaccessible links (Priority: P3)

A user opens an editor link whose file path no longer exists, was mistyped, points at a folder instead of a file, or refers to a file type the editor can't display. Instead of a blank screen or a broken page, they see a clear message explaining the problem and can still get to the rest of the editor (e.g., the file tree) to find what they need.

**Why this priority**: Important for a polished experience and to avoid confusing dead links, but the feature delivers its core value (P1, P2) even with a basic error message here.

**Independent Test**: Can be fully tested by opening the editor with a URL that points at a deleted, nonexistent, or unsupported path and confirming a clear error message is shown while the rest of the editor remains usable.

**Acceptance Scenarios**:

1. **Given** a URL references a file path that does not exist, **When** the editor loads, **Then** the user sees a clear "file not found" message instead of a blank or broken editor view.
2. **Given** a URL references a path that is a folder rather than a file, **When** the editor loads, **Then** the user sees a clear message that the path is a folder, and the folder is expanded/shown in the file tree instead.
3. **Given** a URL references a file type the editor cannot display (e.g., a binary file), **When** the editor loads, **Then** the user sees a clear message explaining the file can't be shown here.

---

### Edge Cases

- What happens when the URL's file path contains characters that could be interpreted as navigating outside the user's storage area (e.g., `../` sequences)? The system must reject or normalize these rather than exposing unintended files.
- What happens when a user opens a deep link while not logged in? The system must send them through the existing login flow and then land them on the originally requested file afterward, rather than dropping the request.
- What happens when the referenced file exists but the user's session lacks permission to view it? The system must show the same access-denied handling used elsewhere in the editor, not a generic error.
- What happens when the file path is extremely long or contains unusual characters (spaces, unicode, symbols)? The link must still work if the underlying file path is valid.
- What happens if the file referenced in the URL is deleted by someone else while the user still has the link open in another tab and then refreshes?
- What happens to bookmarks/links people already saved to the editor's previous URL (before this feature introduced a new one)? They must keep working rather than breaking outright.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST support specifying a complete file path as part of its page URL, so that a specific file can be referenced directly by a link.
- **FR-002**: When the editor page is loaded and a file path is present in the URL, the system MUST automatically load and display that file's content, without requiring the user to browse or click through the file tree.
- **FR-003**: When a file referenced by the URL is successfully loaded, the system MUST also reflect it as selected/highlighted in the file tree, consistent with normal file-selection behavior.
- **FR-004**: When the user selects a different file or folder from within the editor (e.g., via the file tree), the system MUST update the URL to reference the newly selected path, without a full page reload.
- **FR-005**: The system MUST support browser back/forward navigation across previously opened files, consistent with the sequence of files the user has visited via the URL.
- **FR-006**: If a user opens a file-specific editor URL while unauthenticated, the system MUST route them through the existing login flow and then return them to the originally requested file once authenticated.
- **FR-007**: If the file path in the URL does not correspond to an existing, accessible file, the system MUST display a clear, user-friendly message explaining the file could not be opened, rather than a blank or broken page.
- **FR-008**: If the path in the URL refers to a folder rather than a file, the system MUST inform the user and show that folder's contents in the file tree instead of attempting to open it as a file.
- **FR-009**: If the path in the URL refers to a file type the editor does not support opening (e.g., binary content), the system MUST show a clear message rather than attempting to render unsupported content.
- **FR-010**: The system MUST validate and normalize file paths taken from the URL so that they cannot be used to access files or locations outside the user's permitted storage area.
- **FR-011**: Users MUST be able to copy or share the current editor URL such that any other authorized user who opens it sees the same file.
- **FR-012**: The file's path MUST appear directly in the URL itself (e.g. `/files/notes/todo.md`), not only as a query parameter — so links read as a direct address to the file, not to a page with a hidden lookup value.
- **FR-013**: Requests to the editor's previous URL (from before this feature) MUST continue to work, redirecting to the new location, so bookmarks and links saved before this change don't break.

### Key Entities

- **File Path**: The identifier for a file within the user's storage area (e.g., `notes/todo.md`). Already used internally as the storage key; this feature extends its role to also be the identifier carried in the editor's shareable URL.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user opening a valid shared link to a file sees that file's content displayed within 2 seconds, with zero additional navigation steps required.
- **SC-002**: 100% of links to existing, accessible files open the correct file on first load, verified across a representative sample of path shapes (nested folders, special characters, long names).
- **SC-003**: A user opening a link to a missing, folder, or unsupported file sees a clear explanatory message within 1 second, in place of a blank or broken screen, in 100% of cases.
- **SC-004**: Refreshing the browser while a file is open results in the same file being shown again in at least 95% of cases.
- **SC-005**: A user who opens a file-specific link while logged out is returned to that exact file immediately after completing login, with no manual re-navigation required.

## Assumptions

- Today, there is no header-based or URL-based mechanism for the editor to receive a target file when the page first loads; the currently open file exists purely as client-side state set by clicking in the file tree. This feature introduces the file's URL as the sole external mechanism for addressing a specific file.
- Only individual files (not folders) are directly "opened" via a URL for viewing/editing; a URL pointing at a folder instead surfaces that folder in the file tree.
- The file's path is carried directly in the URL's path itself (not as a query parameter) — this was an open question in an earlier draft of this spec, now settled by explicit decision (FR-012).
- Existing authorization and login-gating rules for the editor continue to apply unchanged to files opened via a deep link — a link does not grant any access a user wouldn't otherwise have.
- Existing path validation/sanitization safeguards in the storage layer are the basis for preventing path traversal via the URL; this feature does not need to invent a new access model.
