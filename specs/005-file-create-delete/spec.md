# Feature Specification: File Delete & Create

**Feature Branch**: `005-file-create-delete`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Add the ability to delete a file and to create a new file or new folder from the web file explorer (app/editor/FileTree.tsx), as a follow-on to specs 001-004. Users should be able to: (1) delete an existing file from the tree, with confirmation before it's removed from storage; (2) create a new file inside any directory in the tree, by name; (3) create a new folder inside any directory in the tree, by name. This should build on the existing spec 002 storage primitives (createFile, deleteFile, createDirectory in lib/storage/) which already exist but are not yet exposed through the web UI or API routes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete a file (Priority: P1)

A user browsing the file tree wants to remove a file they no longer need, directly from the tree, without leaving the editor.

**Why this priority**: Deleting mistaken or obsolete files is a core file-management action; without it, files can only ever accumulate.

**Independent Test**: From the tree, trigger "Delete" on a file, confirm the prompt, and verify the file disappears from the tree and is no longer readable from storage.

**Acceptance Scenarios**:

1. **Given** a file is showing in the tree, **When** the user chooses "Delete" on it and confirms the prompt, **Then** the file is removed from storage and no longer appears in the tree.
2. **Given** a file is showing in the tree, **When** the user chooses "Delete" but cancels the confirmation prompt, **Then** the file is left untouched in storage and in the tree.
3. **Given** the file currently open in the editor is the one being deleted, **When** the deletion is confirmed, **Then** the editor closes that file (no longer shows its content as if it still existed).
4. **Given** a file no longer exists in storage (e.g., removed elsewhere just before this action completes), **When** the user attempts to delete it, **Then** the user sees a clear error and the tree is refreshed to reflect current storage state.

---

### User Story 2 - Create a new file (Priority: P1)

A user browsing the file tree wants to start a new document inside a specific folder, by typing a name, instead of uploading one from their computer.

**Why this priority**: Creating content directly in the app is as fundamental as editing it, and is equally valuable as delete — together they make the tree fully self-sufficient for day-to-day file management.

**Independent Test**: From any folder in the tree, trigger "New file", enter a name, and confirm a new empty file appears in that folder and opens in the editor ready for typing.

**Acceptance Scenarios**:

1. **Given** a folder is showing in the tree, **When** the user chooses "New file" and enters a name, **Then** a new empty file with that name is created in that folder, appears in the tree, and opens in the editor.
2. **Given** a folder already contains a file with the entered name, **When** the user submits that name, **Then** the user is asked to confirm before the existing file's content is overwritten.
3. **Given** the user opens "New file" but enters no name (or cancels), **When** the prompt is dismissed, **Then** no file is created.

---

### User Story 3 - Create a new folder (Priority: P2)

A user browsing the file tree wants to organize files by first creating a new subfolder inside an existing folder, by typing a name.

**Why this priority**: Useful for organizing content, but less immediately critical than being able to delete files or create new documents — folders can also be created implicitly by other means (e.g., folder upload in spec 004).

**Independent Test**: From any folder in the tree, trigger "New folder", enter a name, and confirm a new empty subfolder appears in the tree under that folder.

**Acceptance Scenarios**:

1. **Given** a folder is showing in the tree, **When** the user chooses "New folder" and enters a name, **Then** a new empty subfolder with that name is created inside it and appears in the tree.
2. **Given** a folder already contains a subfolder with the entered name, **When** the user submits that name, **Then** the tree simply reflects the (already-existing) folder with no error and nothing is lost.
3. **Given** the entered name collides with an existing file (not folder) in that location, **When** the user submits it, **Then** the user sees a clear error and no folder is created.
4. **Given** the user opens "New folder" but enters no name (or cancels), **When** the prompt is dismissed, **Then** no folder is created.

---

### Edge Cases

- What happens when the entered file/folder name contains a path separator (e.g., "notes/today")? The system rejects the name with a clear message rather than silently creating nested paths.
- What happens when the entered name is blank or only whitespace? The system treats this the same as cancelling — nothing is created.
- What happens when the storage backend becomes unreachable during a create or delete action? The user sees a clear error message and the tree is left showing its last known state.
- What happens when a user tries to delete a folder? Not supported by this feature — delete is scoped to files only (see Assumptions).
- What happens when two users (or two browser tabs) act on the same folder at the same time? Last write wins, consistent with existing spec 001-004 single-local-developer behavior; no locking is introduced.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user delete an individual file from any folder shown in the tree.
- **FR-002**: The system MUST ask for confirmation before a file is actually removed from storage.
- **FR-003**: If the file being deleted is the one currently open in the editor, the system MUST close that editor view once deletion succeeds.
- **FR-004**: The system MUST let a user create a new, empty file by name inside any folder shown in the tree.
- **FR-005**: The system MUST let a user create a new, empty subfolder by name inside any folder shown in the tree.
- **FR-006**: The system MUST ask for confirmation before creating a file overwrites an existing file's content at the same location.
- **FR-007**: The system MUST reject file/folder names that contain a path separator, and MUST treat a blank/whitespace-only name as "nothing to create."
- **FR-008**: After a successful create or delete, the system MUST refresh the affected folder's contents in the tree so the change is immediately visible, without a full page reload.
- **FR-009**: The system MUST surface a clear, specific error to the user when a create or delete operation cannot complete (e.g., storage unreachable, name collision with a different entry type), consistent with existing error handling in specs 003-004.
- **FR-010**: A newly created file MUST open automatically in the editor so the user can start typing immediately.
- **FR-011**: Create and delete MUST reuse the existing storage access layer (`lib/storage/*`) exclusively — no second way of talking to storage (consistent with spec 003's FR-012 and spec 004's FR-011).

### Key Entities

- **Delete action**: A user-confirmed request to remove one existing file from storage; has no effect on the file's parent folder or siblings.
- **Create-file action**: A user request, by name, to add one new empty file inside a chosen folder; may require overwrite confirmation if the name collides with an existing file.
- **Create-folder action**: A user request, by name, to add one new empty subfolder inside a chosen folder.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can remove an unwanted file from the tree, including confirmation, in under 10 seconds.
- **SC-002**: A user can create a new file and begin typing its content in under 10 seconds from choosing "New file."
- **SC-003**: A user can create a new folder and see it appear in the tree in under 10 seconds from choosing "New folder."
- **SC-004**: 100% of delete actions require an explicit confirmation step before any data is removed from storage.
- **SC-005**: 100% of create actions that would silently overwrite existing file content instead prompt for confirmation first.

## Assumptions

- Delete is scoped to files only in this feature; deleting an entire folder (and its contents) is out of scope, even though the underlying storage layer already supports it — it can be added as a follow-on feature if needed.
- A newly created file's name is free-form (any extension, not limited to `.md`), consistent with the general-purpose file editor from spec 003; the `.md`-only restriction from spec 004 applies only to upload/download, not to in-app file creation.
- Creating a folder that already exists at that exact path is treated as a no-op success (idempotent), matching the existing `createDirectory` storage behavior, rather than as an error.
- Overwrite confirmation for file creation is a single confirmation dialog, consistent with the pattern already used for upload overwrite conflicts in spec 004.
- No authentication/authorization is introduced by this feature, consistent with spec 001-004's single local developer scope.
