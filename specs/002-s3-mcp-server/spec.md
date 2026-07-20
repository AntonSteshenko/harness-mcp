# Feature Specification: S3 Storage MCP Server

**Feature Branch**: `002-s3-mcp-server`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "dobbiamo aggiungere mcp server per s3 storage, per creare, modificare, eliminare ecc, tutte le operazioni come file locali, anche directories."

## Clarifications

### Session 2026-07-19

- Q: How should the server handle concurrent access to the same file/directory path? → A: Single active client assumed (standard MCP session pattern); sequential handling, no explicit conflict detection — a rare true race is resolved by whichever write lands last.
- Q: Should the system impose a specific file size limit or require streaming support for large files? → A: No specific limit — support whatever the underlying storage/available memory allows; no streaming requirement in this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic file operations (Priority: P1)

As an AI agent or developer tool connected via MCP, I want to create, read, and delete files stored in the S3 storage using simple filesystem-like operations, so that I can use the storage as a general-purpose file workspace without needing to know S3-specific concepts.

**Why this priority**: This is the foundation of the feature. Without reliable create/read/delete on individual files, no other capability (directories, moves, edits) has anything to operate on.

**Independent Test**: Can be fully tested by connecting an MCP client, creating a file with given content at a path, reading that path back and confirming identical content, then deleting it and confirming it's gone.

**Acceptance Scenarios**:

1. **Given** the MCP server is connected to the local storage, **When** a file is created at a given path with some content, **Then** reading that same path returns identical content.
2. **Given** a file exists at a path, **When** it is deleted, **Then** subsequently reading that path returns a clear "not found" result rather than stale or empty content.
3. **Given** no file exists at a given path, **When** a read is attempted on it, **Then** the system returns a clear "not found" error rather than crashing or returning an ambiguous empty success.

---

### User Story 2 - Directory operations (Priority: P2)

As an AI agent or developer tool, I want to organize files into directories — creating, listing, and deleting them, including nested structures — so that I can structure stored content hierarchically, similar to a local filesystem.

**Why this priority**: Once individual files work, directories are the natural next step for any non-trivial amount of content, letting users organize and browse what they've stored.

**Independent Test**: Can be fully tested by creating a directory, creating files inside it (including a nested subdirectory), listing the directory to confirm its contents, then deleting the whole directory and confirming everything inside it is also gone.

**Acceptance Scenarios**:

1. **Given** a directory containing files and a subdirectory, **When** that directory is listed, **Then** all direct child files and the subdirectory are shown, without contents of the subdirectory being flattened into the same listing.
2. **Given** a directory path, **When** it is created, **Then** it appears when its parent directory is listed, even before any files are added to it.
3. **Given** a directory containing files and subdirectories, **When** the directory is deleted, **Then** the directory and everything inside it (files and subdirectories, recursively) are removed, with no orphaned files left behind.
4. **Given** a directory path that does not exist, **When** it is listed, **Then** the system returns a clear "not found" error rather than an empty listing.

---

### User Story 3 - Modify and reorganize (Priority: P3)

As an AI agent or developer tool, I want to modify existing files' content and move/rename files and directories, so that I can iteratively update stored content and reorganize it without deleting and recreating everything from scratch.

**Why this priority**: Editing and reorganizing are natural extensions of "treat it like local files," but a workspace is already useful with just create/read/delete/list (User Stories 1–2); this adds convenience and efficiency on top.

**Independent Test**: Can be fully tested by creating a file, modifying its content and confirming the change on read, then moving/renaming both a file and a directory and confirming each is accessible only at its new path afterward.

**Acceptance Scenarios**:

1. **Given** a file exists with some content, **When** its content is modified, **Then** reading the file afterward returns the updated content.
2. **Given** a file exists at one path, **When** it is moved/renamed to a new path, **Then** it is accessible at the new path and reading the old path returns "not found."
3. **Given** a directory containing files exists at one path, **When** it is moved/renamed to a new path, **Then** every file that was inside it is accessible under the new path, and the old path returns "not found."

---

### Edge Cases

- What happens when creating a file at a path where a directory already exists (type collision)? The system MUST reject the operation with a clear error rather than silently overwriting or corrupting either entry.
- What happens when creating a directory at a path where a file already exists? Same as above — rejected with a clear error.
- What happens when deleting a file or directory that does not already exist? The system MUST return a clear "not found" error rather than silently succeeding, so callers can distinguish "nothing to delete" from "deletion happened."
- What happens when an operation is attempted while the underlying local S3 storage service is unreachable (e.g., not started)? The system MUST return a clear connectivity error rather than hanging indefinitely or silently failing.
- What happens with very deeply nested paths or very large files? The system MUST behave consistently up to the limits of the underlying storage, without introducing artificial low limits of its own. No specific maximum file size is defined for this feature, and no streaming transfer is required — whole-file content is read/written directly, bounded only by available memory and the underlying storage.
- What happens if two operations target the same path at nearly the same time? The server assumes a single active MCP client per session (the standard MCP pattern) and handles requests sequentially, so this is expected to be rare. The system MUST still ensure the final state reflects one complete, non-corrupted operation (no partially-written files or half-deleted directories) even in that rare case — no explicit locking or conflict-rejection is required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose file and directory storage operations through the Model Context Protocol (MCP), so that any MCP-compatible client can invoke them.
- **FR-002**: System MUST allow creating a new file at a specified path with provided content.
- **FR-003**: System MUST allow reading the full current content of an existing file at a specified path.
- **FR-004**: System MUST allow modifying the content of an existing file at a specified path. Modification support is limited to whole-file overwrite (the caller supplies the complete new content); it does not include partial/in-place edit operations such as append or find-and-replace.
- **FR-005**: System MUST allow deleting an existing file at a specified path.
- **FR-006**: System MUST allow listing the direct contents (child files and child subdirectories) of a given directory path.
- **FR-007**: System MUST allow creating a directory at a specified path, and that directory MUST persist and remain listable even while it contains zero files.
- **FR-008**: System MUST allow deleting a directory; if it contains files and/or subdirectories, all of its contents MUST be deleted recursively as part of the same operation, leaving no orphaned files.
- **FR-009**: System MUST allow moving/renaming a file to a new path.
- **FR-010**: System MUST allow moving/renaming a directory, together with everything inside it, to a new path.
- **FR-011**: System MUST return a clear, distinguishable "not found" error when an operation targets a file or directory path that does not exist.
- **FR-012**: System MUST return a clear, distinguishable error when a create operation would collide with an existing entry of a different type (file vs. directory) at the same path.
- **FR-013**: System MUST operate against a single, pre-configured storage location (the project's existing local self-hosted S3 storage — see spec 001-s3-self-hosted-storage) rather than requiring the caller to select or manage multiple storage locations.
- **FR-014**: System MUST present all operations and results using filesystem terminology and structure (files, directories, paths) rather than requiring the calling client to understand S3-specific concepts (buckets, object keys, prefixes).
- **FR-015**: System MUST assume a single active MCP client per session and process operations sequentially; it does not need to implement locking or conflict-rejection for simultaneous writes to the same path.
- **FR-016**: System MUST read and write whole file content directly (no chunked/streaming transfer) and MUST NOT impose an artificial maximum file size beyond what the underlying storage and available memory allow.

### Key Entities

- **File**: Represents stored content addressable by a path; has a path, content, size, and last-modified time. Content is treated as opaque data — the system does not interpret or validate specific file formats.
- **Directory**: Represents a hierarchical grouping of files and subdirectories at a path; has a path, and contains zero or more files/subdirectories. Directories are first-class: an explicitly created directory persists and is listable even when empty.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An MCP client can complete a full create → read → modify → delete cycle on a file using only filesystem-style paths and operations, with no S3-specific concepts (buckets, keys, prefixes) required in the interaction.
- **SC-002**: Users can create and correctly navigate/list directory structures at least 5 levels deep.
- **SC-003**: Deleting a directory containing 100 files results in zero orphaned files remaining afterward, 100% of the time.
- **SC-004**: Basic file operations (create, read, modify, delete) on typical small files (a few KB) complete in under 2 seconds, so an interactively-driven agent experiences the workspace as responsive.
- **SC-005**: 100% of operations targeting a non-existent path return a clear, distinguishable error rather than an ambiguous success, empty result, or crash.

## Assumptions

- This MCP server operates against the local, self-hosted S3 storage introduced in spec 001-s3-self-hosted-storage; it is not intended to connect to arbitrary or production cloud storage accounts.
- The MCP server is used in local development contexts by AI coding agents and developer tooling that speak the Model Context Protocol; it is not exposed as a public, multi-tenant service.
- No built-in versioning or file history beyond what the underlying storage's own persistence already provides (see spec 001) — overwriting a file permanently replaces its prior content.
- Access control reuses the existing local storage credentials established in spec 001; this feature does not introduce a separate authentication/authorization layer of its own.
- "Directories" are a filesystem-style abstraction presented to MCP clients; how they are represented within the underlying object storage is an implementation detail not visible to callers.
