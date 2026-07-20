# Feature Specification: Markdown Upload & Folder Download

**Feature Branch**: `004-markdown-upload-download`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Add the ability to upload .md files (or a folder of .md files) from the web editor UI, and to download an entire folder of .md files as a zip. Scope is restricted to Markdown (.md) files only — no binary/arbitrary file upload or download. This extends the existing web file explorer/editor from spec 003 (specs/003-web-file-editor)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload one or more Markdown files (Priority: P1)

A user browsing the file tree wants to add existing Markdown notes from their computer into a folder in the storage, without retyping their content into the editor.

**Why this priority**: This is the most common single action (adding one document) and delivers value on its own even before folder upload or download exist.

**Independent Test**: From a folder in the tree, trigger "Upload files", pick one or more `.md` files from the local filesystem, and confirm they appear in the tree and open with their original content.

**Acceptance Scenarios**:

1. **Given** a folder is showing in the tree, **When** the user chooses "Upload files" and selects a single `.md` file from their computer, **Then** the file appears as a new entry in that folder with its original content preserved.
2. **Given** a folder is showing in the tree, **When** the user selects multiple `.md` files at once, **Then** all of them are added to that folder in a single action.
3. **Given** the user selects a mix of `.md` and non-`.md` files, **When** the upload is submitted, **Then** the `.md` files are uploaded, the non-`.md` files are skipped, and the user is told how many files were skipped and why.
4. **Given** a file with the same name already exists in the target folder, **When** the user uploads a `.md` file with that name, **Then** the user is asked to confirm before the existing file's content is overwritten.

---

### User Story 2 - Upload a folder of Markdown files (Priority: P2)

A user has a local folder of Markdown notes (possibly in subfolders) and wants to bring the whole structure into the storage in one action instead of uploading files one by one.

**Why this priority**: Builds directly on Story 1's upload mechanism but adds structure-preservation, which is more complex and less frequently needed than single/multi-file upload.

**Independent Test**: From a folder in the tree, trigger "Upload folder", pick a local folder containing `.md` files in nested subfolders, and confirm the same nested structure (folders and `.md` files only) appears under the target folder.

**Acceptance Scenarios**:

1. **Given** a folder is showing in the tree, **When** the user chooses "Upload folder" and picks a local folder containing `.md` files across several subfolders, **Then** the same subfolder structure is created in the target folder and each `.md` file's content is preserved.
2. **Given** the selected local folder also contains non-`.md` files, **When** the upload completes, **Then** none of the non-`.md` files were created, and the user is told how many files were skipped.
3. **Given** the selected local folder is empty or contains no `.md` files anywhere in its structure, **When** the upload is submitted, **Then** the user is told there was nothing to upload and no folders are created.

---

### User Story 3 - Download an entire folder as a zip (Priority: P1)

A user wants to get a whole folder of Markdown notes (and its subfolders) out of the storage and onto their computer in one step, instead of downloading each file individually.

**Why this priority**: Equally as valuable as single-file upload — it is the main way a user retrieves bulk content — and is independent of the upload stories.

**Independent Test**: From any folder in the tree, trigger "Download folder", and confirm a single zip file is saved locally containing every `.md` file from that folder and its subfolders, in the same structure.

**Acceptance Scenarios**:

1. **Given** a folder containing `.md` files in nested subfolders, **When** the user chooses "Download folder" on it, **Then** a single zip archive downloads to the user's computer preserving the folder/subfolder structure and every `.md` file's content.
2. **Given** a folder that contains only `.md` files (no other file types, per FR-001/FR-002), **When** the user downloads it, **Then** the zip contains exactly those files.
3. **Given** an empty folder (no files or subfolders), **When** the user chooses "Download folder" on it, **Then** the user is told there is nothing to download and no file is saved.

---

### Edge Cases

- What happens when the user tries to upload a file that isn't valid text (e.g., a corrupted or non-UTF-8 `.md` file)? The system rejects that individual file with an error message and continues with the rest of the batch.
- What happens when a folder upload would create a path that collides with an existing file at a different type (e.g., local folder "notes" would land where a file named "notes" already exists)? The system reports that specific conflict as an error for that item and continues with the rest of the batch, consistent with existing single-file behavior (spec 003/002 `type_mismatch`/`already_exists` handling).
- What happens when the user cancels an in-progress upload or download? Any files already written or downloaded up to that point remain; the operation stops without completing the remainder.
- What happens when the storage backend becomes unreachable mid-upload or mid-download? The user sees a clear error and the operation stops; partially-uploaded files already written remain (consistent with no-rollback behavior elsewhere in the app).
- What happens when downloading a very large folder? The user sees the download proceed as a single file once ready; no specific size cap is imposed by this feature beyond what the underlying storage already supports.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user upload one or more individual `.md` files from their local filesystem into a chosen folder in the tree.
- **FR-002**: The system MUST let a user upload a local folder (including nested subfolders) into a chosen folder in the tree, creating the same subfolder structure and skipping any files that are not `.md`.
- **FR-003**: The system MUST only accept files with a `.md` extension as upload content; any other file selected as part of a multi-file or folder upload MUST be skipped, not stored.
- **FR-004**: The system MUST preserve the exact text content of each uploaded `.md` file.
- **FR-005**: The system MUST tell the user, after an upload completes, how many files were uploaded and how many were skipped (and, for skipped files, why).
- **FR-006**: The system MUST ask for confirmation before an upload overwrites a `.md` file that already exists at the destination path.
- **FR-007**: The system MUST let a user download an entire folder (including nested subfolders) from the tree as a single zip archive.
- **FR-008**: The downloaded zip archive MUST preserve the relative folder/subfolder structure and MUST contain only the `.md` files from that folder tree.
- **FR-009**: The system MUST tell the user when a folder they chose to download contains nothing to download, without producing an empty or misleading zip file.
- **FR-010**: The system MUST surface a clear, specific error to the user when an upload or download operation cannot complete (e.g., storage unreachable, invalid file), consistent with existing error handling in spec 003.
- **FR-011**: Upload and download MUST reuse the existing storage access layer (`lib/storage/*`) exclusively — no second way of talking to storage (consistent with spec 003's FR-012 constraint).

### Key Entities

- **Upload batch**: A set of one or more local `.md` files (optionally organized in a local folder structure) submitted together in a single upload action; tracks per-file outcome (uploaded / skipped / overwritten / failed) for the summary shown to the user.
- **Folder download**: A request to package one existing folder (and everything nested under it) into a single zip archive for the user to save locally; scoped to `.md` files only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add an existing local `.md` file to any folder in under 15 seconds from opening the upload picker to seeing it appear in the tree.
- **SC-002**: A user can bring in a local folder of 50 nested `.md` files in a single upload action, with 100% of the `.md` files' content preserved exactly and 100% of non-`.md` files correctly excluded.
- **SC-003**: A user can retrieve an entire folder of Markdown notes as one zip file in a single action, with the extracted structure and content matching the source folder exactly.
- **SC-004**: 100% of upload attempts that include non-`.md` files clearly report to the user which files were skipped and why, with no silent data loss ambiguity.
- **SC-005**: Attempting to download an empty folder never produces a downloaded file, 100% of the time.

## Assumptions

- Only `.md` files are in scope for both upload and download; all other file types are explicitly out of scope for this feature (per user direction), even though the broader storage/editor from spec 003 handles other file types for browsing/editing.
- "Upload folder" relies on the local browser's folder-picking capability; if a user's browser/OS doesn't support picking a folder, they can still upload individual `.md` files one or many at a time (Story 1 remains available as a fallback).
- Overwrite confirmation for uploads is a single confirmation per conflicting file (or per batch, at implementation's discretion) — this spec only requires that the user is asked before any existing content is silently replaced.
- Folder download always zips the full subtree under the chosen folder; there is no partial/selective download of only some subfolders in this feature.
- This feature only adds upload/download actions to the existing spec 003 tree UI; it does not change how files are viewed or edited once present in storage.
- No authentication/authorization is introduced by this feature, consistent with spec 001-003's single local developer scope.
