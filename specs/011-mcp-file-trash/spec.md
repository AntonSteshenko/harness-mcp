# Feature Specification: MCP File Trash

**Feature Branch**: `011-mcp-file-trash`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "issue 4, dobbiamo applicare a livello mcp. non eliminare i file ma spostare in cartella Trash, da li si potrà già eliminare" (Issue #4: "Delete files with a Trash concept" — `delete_file`/`delete_directory` currently remove content permanently with no way to recover an accidental deletion. Apply the fix at the MCP tool layer: instead of permanently deleting, move the item into a `Trash` folder; from inside `Trash`, deletion is already permanent.)

## Clarifications

### Session 2026-07-23

- Q: When a file/directory is soft-deleted into Trash, how should its trashed path be built so repeated deletions of the same original path don't collide? → A: Timestamped subfolder per deletion — `Trash/<deletion-timestamp>/<original-relative-path>`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Soft-delete a file (Priority: P1)

An agent or user calls the existing file-delete MCP tool on a file they no longer want in its current location. Instead of the file vanishing forever, it is moved into a reserved `Trash` folder, so a mistaken or premature deletion can still be undone.

**Why this priority**: This is the core problem from issue #4 — accidental permanent data loss on a single tool call. Fixing `delete_file` alone already removes most of the risk.

**Independent Test**: Call `delete_file` on an existing file, then verify the file no longer exists at its original path but is now readable/listable under `Trash` with its content intact.

**Acceptance Scenarios**:

1. **Given** a file exists at some path outside `Trash`, **When** `delete_file` is called on it, **Then** the file is moved into a new per-deletion timestamped subfolder under `Trash` (preserving its original relative path beneath that subfolder, e.g. `Trash/<deletion-timestamp>/<original-relative-path>`) instead of being permanently removed, and it disappears from its original path.
2. **Given** the `Trash` folder does not yet exist in storage, **When** `delete_file` is called for the first time, **Then** the system creates `Trash` (and the new timestamped subfolder) automatically and the file is moved into it.
3. **Given** a file has just been soft-deleted into `Trash`, **When** its content is read from the trashed path, **Then** the content is identical to the original file.

---

### User Story 2 - Soft-delete a directory (Priority: P1)

An agent or user calls the existing directory-delete MCP tool on a folder. Instead of the folder and everything in it being permanently removed, the whole subtree is moved into `Trash`, preserving its internal structure.

**Why this priority**: Directory deletion is just as destructive as file deletion (and affects more content at once), so it needs the same safety net to fully close the gap described in issue #4.

**Independent Test**: Call `delete_directory` on a folder containing nested files/subfolders, then verify the entire subtree is now present under `Trash` with the same relative structure, and gone from its original location.

**Acceptance Scenarios**:

1. **Given** a directory with nested files and subfolders exists outside `Trash`, **When** `delete_directory` is called on it, **Then** the entire subtree is moved into a new per-deletion timestamped subfolder under `Trash` (preserving relative paths and structure beneath that subfolder) instead of being permanently removed.
2. **Given** a directory has just been soft-deleted into `Trash`, **When** its contents are listed from the trashed path, **Then** the same files and subfolders are present as before deletion.

---

### User Story 3 - Permanently delete an already-trashed item (Priority: P1)

An agent or user calls the delete tool again, this time on an item that is already inside `Trash`. This time the deletion is real: the item is permanently removed from storage with no further move, matching the issue's requirement that "from there [Trash], deletion is already possible."

**Why this priority**: Without a way to make deletion final, `Trash` fills up forever and the feature only half-solves the problem. This is what makes soft-delete a complete, usable workflow rather than a dead end.

**Independent Test**: Soft-delete a file (moving it into `Trash`), then call `delete_file` again on its new path inside `Trash`, and verify it is now gone entirely — including from `Trash` itself.

**Acceptance Scenarios**:

1. **Given** a file exists at some path under `Trash`, **When** `delete_file` is called on that trashed path, **Then** the file is permanently removed from storage (no further move happens).
2. **Given** a directory exists at some path under `Trash`, **When** `delete_directory` is called on that trashed path, **Then** the directory and its entire contents are permanently removed from storage.
3. **Given** the `Trash` folder itself is the target, **When** `delete_directory` is called on `Trash`, **Then** everything currently in `Trash` is permanently removed, effectively emptying it in one call.

---

### User Story 4 - Inspect and recover trashed items with existing tools (Priority: P2)

An agent or user wants to see what has been soft-deleted, and pull an item back out of `Trash` to its original (or a new) location, without needing to learn any new tools.

**Why this priority**: Recoverability is the whole point of a trash concept; this story confirms the existing browse/move tools are sufficient to deliver that value without adding new surface area.

**Independent Test**: After soft-deleting a file, list the `Trash` folder to see it, then use the existing move tool to relocate it back out of `Trash` to its original path, and verify it is readable there again.

**Acceptance Scenarios**:

1. **Given** one or more items have been soft-deleted, **When** the `Trash` folder is listed using the existing directory-listing tool, **Then** all currently trashed items are visible with their trashed paths.
2. **Given** a file sitting inside `Trash`, **When** the existing move tool is used to relocate it out of `Trash` to a chosen path, **Then** the file exists at that new path with its original content, and is no longer inside `Trash`.

---

### Edge Cases

- What happens when two delete operations would otherwise produce the same per-deletion timestamped subfolder under `Trash`? The timestamp used has enough precision (e.g., sub-second resolution or a uniqueness counter) that two separate delete operations never collide in practice.
- What happens when a file at the storage root (no parent folder) is soft-deleted? It is moved directly under its deletion's timestamped subfolder using just its filename (e.g. `Trash/<deletion-timestamp>/<filename>`).
- What happens when `delete_directory` targets a subfolder that is itself inside `Trash` (e.g. one specific timestamped subfolder, or a path within one — not `Trash` as a whole)? Only that subtree is permanently removed; the rest of `Trash` is unaffected.
- What happens when an item is manually moved into `Trash` via the existing move tool (not through a delete call)? It is treated the same as any other content under `Trash` — a subsequent delete call on its path permanently removes it, regardless of whether it sits inside a timestamped subfolder.
- What happens when the storage backend becomes unreachable mid-move during a soft-delete? The operation fails with a clear error and storage is left in its last known consistent state (no partial move).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `delete_file` MCP tool MUST, when called on a path outside `Trash`, move the target file into the reserved `Trash` folder instead of permanently removing it.
- **FR-002**: The `delete_directory` MCP tool MUST, when called on a path outside `Trash`, move the target directory and its entire contents into the reserved `Trash` folder instead of permanently removing it.
- **FR-003**: When moving an item into `Trash`, the system MUST place it under a subfolder unique to that deletion operation (named from the deletion's timestamp), and preserve its original relative path beneath that subfolder, so both when it was deleted and its prior location are identifiable from within `Trash`.
- **FR-004**: The system MUST automatically create the `Trash` folder (and each new per-deletion timestamped subfolder) the first time it is needed, without requiring any separate setup step.
- **FR-005**: The `delete_file` MCP tool MUST, when called on a path already located under `Trash`, permanently remove that file from storage rather than moving it again.
- **FR-006**: The `delete_directory` MCP tool MUST, when called on a path already located under `Trash` (including `Trash` itself), permanently remove that directory and all of its contents from storage rather than moving it again.
- **FR-007**: The system MUST generate each per-deletion timestamped subfolder with enough precision (e.g., sub-second resolution or a uniqueness counter) that two separate delete operations never collide on the same `Trash` subfolder, even when their original paths are identical.
- **FR-008**: Users/agents MUST be able to view the current contents of `Trash` using the existing directory-listing MCP tool, with no new tool required.
- **FR-009**: Users/agents MUST be able to recover a trashed item to its original or another location using the existing move MCP tool, with no new tool required.
- **FR-010**: This feature applies at the MCP tool layer only; it MUST NOT require any change to the web file editor UI to function correctly.

### Key Entities

- **Trash**: A reserved top-level folder in storage that holds soft-deleted files and directories, organized into one subfolder per deletion operation, until they are either restored (moved out) or permanently deleted (deleted again from within it).
- **Trashed Item**: A file or directory currently located under `Trash`, identified by the deletion timestamp of the operation that trashed it plus the relative path it had before deletion; it behaves like any other storage object for read/list/move purposes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of files and directories removed via `delete_file`/`delete_directory` outside `Trash` remain fully recoverable afterward, until a separate, explicit deletion call targets them inside `Trash`.
- **SC-002**: A single delete call outside `Trash` never results in immediate, unrecoverable data loss.
- **SC-003**: A previously soft-deleted item can be made permanently gone with exactly one additional delete call, using a tool the caller already knows.
- **SC-004**: Anyone can inspect everything currently pending permanent deletion using only pre-existing browsing tools, with zero new tools to learn.

## Assumptions

- `Trash` is a reserved top-level folder name in the storage bucket; no pre-existing, unrelated user content is assumed to already occupy that exact path at the root.
- No dedicated `restore` tool is introduced — restoring a trashed item is accomplished with the existing move tool.
- No dedicated `empty_trash` tool is introduced — permanently emptying `Trash` is accomplished by calling `delete_directory` on the `Trash` folder itself.
- No automatic, time-based expiry of trashed content is introduced in this feature; items stay in `Trash` until explicitly deleted again.
- The web file editor UI is out of scope for this feature; it may incidentally display the `Trash` folder like any other folder, but no dedicated Trash view or UI treatment is added.
- Restoring a trashed item requires knowing (e.g. via listing) which per-deletion timestamped subfolder it lives under; no separate index/search across timestamped subfolders is introduced in this feature.
