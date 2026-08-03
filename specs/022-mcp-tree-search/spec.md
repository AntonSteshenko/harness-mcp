# Feature Specification: MCP Tree Search Tools

**Feature Branch**: `022-mcp-tree-search`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "Recursive directory listing and file search tools for the MCP file storage server. Right now `list_directory` only returns direct children one level at a time, so an assistant navigating a deep tree (os/, os/skills/, data/, policies/, etc.) has to issue one list_directory call per level to find something. Add: (1) a recursive/tree option so a whole subtree can be returned in a single call, and (2) a way to find files by name (and ideally by content, for Markdown) across the tree without manual traversal. Goal: make it fast for a connected assistant to locate a specific skill/file/folder inside a large Company OS structure with minimal round trips, without collapsing the existing per-verb tool set (create_file/read_file/update_file/delete_file/create_directory/list_directory/delete_directory/move) into a generic dispatch tool."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a whole subtree in one call (Priority: P1)

A connected AI assistant needs to understand the layout of a directory that contains many nested subdirectories (e.g. `os/`, which holds `os/skills/`, `os/policies/`, etc.). Instead of calling the one-level directory listing repeatedly for every subdirectory it discovers, it makes a single call and receives the entire nested structure — every descendant file and directory, at every depth — in one response.

**Why this priority**: This is the direct fix for the reported problem: today, mapping a tree with N nested directories costs N round trips. It is useful on its own even before any search capability exists.

**Independent Test**: Can be fully tested by pointing the new capability at a known multi-level directory (e.g. `os/`) and confirming the single response lists every file and subdirectory at every depth below it, matching what repeated one-level listings would have produced.

**Acceptance Scenarios**:

1. **Given** a directory containing files and nested subdirectories several levels deep, **When** the caller requests the full subtree for that directory, **Then** the response includes every descendant file and directory at every depth, each clearly marked as a file or a directory.
2. **Given** an empty directory, **When** the caller requests its full subtree, **Then** the response indicates the directory exists and has no descendants, without error.
3. **Given** a path that does not exist, **When** the caller requests its full subtree, **Then** the response reports the same "not found" outcome as the existing one-level listing does today.
4. **Given** a path that points to a file rather than a directory, **When** the caller requests its full subtree, **Then** the response reports the same "wrong kind of entry" outcome as the existing one-level listing does today.

---

### User Story 2 - Find a file or folder by name without knowing its path (Priority: P2)

A connected AI assistant is asked to open or modify something described only by name or partial name (e.g. "the invoicing skill", "the todo file") and does not know which subdirectory it lives in. Instead of manually walking the tree level by level guessing where it might be, it searches by name across the whole structure and gets back the matching path(s) directly.

**Why this priority**: Builds directly on User Story 1's traversal capability to solve the actual end goal — locating something specific — rather than just viewing structure. It's the more common real-world request ("find X"), but depends conceptually on tree traversal existing first.

**Independent Test**: Can be fully tested by searching for a known file's exact and partial name from the root and confirming its full path is returned, and by searching for a name that does not exist and confirming an empty, non-error result.

**Acceptance Scenarios**:

1. **Given** a file named `invoicing.md` nested several directories deep, **When** the caller searches by the name `invoicing`, **Then** the result includes that file's full path.
2. **Given** multiple files/directories whose names contain the search term, **When** the caller searches by that term, **Then** the result includes all of them with their full paths.
3. **Given** no file or directory name matches the search term anywhere in the tree, **When** the caller searches, **Then** the result is an empty match list, not an error.

---

### User Story 3 - Find Markdown files by their content (Priority: P3)

A connected AI assistant is asked to find "the skill that talks about refunds" or similar, where the relevant word appears inside a file's content rather than in its name. It searches across the tree's Markdown files by keyword and gets back the matching file paths.

**Why this priority**: Highest value for discovery in a Markdown-heavy structure ("skills, policies, etc." per the feature description), but it's the most expensive capability to run (reading file contents rather than just names) and is explicitly called out as a "nice to have" in the request, so it ships last.

**Independent Test**: Can be fully tested by searching for a keyword known to appear in one Markdown file's body (but not in any filename) and confirming that file's path is returned, and by searching for a keyword present in no file and confirming an empty, non-error result.

**Acceptance Scenarios**:

1. **Given** a Markdown file whose content contains a specific keyword, **When** the caller searches by that keyword, **Then** the result includes that file's path.
2. **Given** a keyword that appears in no file's content, **When** the caller searches, **Then** the result is an empty match list, not an error.
3. **Given** a non-Markdown (or binary) file whose raw bytes happen to contain the keyword, **When** the caller searches by content, **Then** that file is not included in the results (content search is Markdown-only).

---

### Edge Cases

- What happens when the requested subtree (User Story 1) or the whole tree (User Stories 2-3) is very large (thousands of entries)? The response is capped (see Assumptions) and clearly indicates when results were truncated, rather than silently omitting entries or timing out.
- What happens when a search (by name or content) is run from a subdirectory rather than the root? It only searches within that subdirectory's own subtree.
- What happens when the same name matches both a file and a directory? Both are returned, each labeled with its kind.
- What happens when content search encounters a file that looks like Markdown by extension but fails to decode as text? It is skipped rather than causing the whole search to fail.
- Does search include the Trash directory? No by default (see Assumptions), since Trash holds deleted items awaiting permanent removal and would clutter "find my file" results.
- What happens when the search term is empty or whitespace-only? The tool reports a validation error rather than returning the entire tree unfiltered.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a caller to retrieve, in a single request, the complete nested contents (all descendant files and directories, at every depth) of a given directory path.
- **FR-002**: Each entry in a full-subtree result MUST be distinguishable as a file or a directory, consistent with the existing one-level directory listing's output shape.
- **FR-003**: Full-subtree retrieval MUST report the same `not_found` and `type_mismatch` error outcomes as the existing one-level directory listing, for the same conditions (missing path, path is a file).
- **FR-004**: System MUST allow a caller to search for files and directories by name (matching on partial, case-insensitive name text) across an entire directory subtree in a single request.
- **FR-005**: Name search results MUST include the full path and kind (file or directory) of every match.
- **FR-006**: System MUST allow a caller to search the content of Markdown files for a keyword or phrase across an entire directory subtree in a single request, returning the path of every Markdown file whose content contains a match.
- **FR-007**: Content search MUST only inspect Markdown files; it MUST NOT attempt to interpret binary or non-Markdown file content, and MUST skip any file it cannot decode as text without failing the overall search.
- **FR-008**: Both search capabilities (by name and by content) MUST accept an optional starting path to scope the search to a subtree, defaulting to the whole storage root when omitted.
- **FR-009**: Both search capabilities MUST return an empty match list (not an error) when nothing matches.
- **FR-010**: Both search capabilities MUST reject an empty or whitespace-only search term with a validation error rather than returning unfiltered results.
- **FR-011**: Full-subtree retrieval and both search capabilities MUST exclude the Trash directory from results by default.
- **FR-012**: When the number of matching/descendant entries exceeds the response cap (see Assumptions), the response MUST clearly indicate that results were truncated rather than silently dropping entries.
- **FR-013**: These new capabilities MUST be added as additional, purpose-named tools alongside the existing per-verb tools (`create_file`, `read_file`, `update_file`, `delete_file`, `create_directory`, `list_directory`, `delete_directory`, `move`) — none of the existing tools are removed, renamed, or merged into a generic dispatch tool.

### Key Entities

- **Tree Entry**: One file or directory discovered during a full-subtree retrieval or a name search — has a full path, a kind (file/directory), and, for files, the same metadata (size, last-modified) the existing file/directory tools already expose.
- **Content Match**: One Markdown file found during a content search — has a full path and enough surrounding text (a snippet) to show the caller why it matched, without requiring a separate read of the whole file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A caller can map the complete structure of a directory tree ten or more levels deep, and dozens of subdirectories wide, in a single request instead of one request per level.
- **SC-002**: A caller can locate a specific file or folder anywhere in the tree by a partial name in one request, without first discovering or guessing its parent path.
- **SC-003**: A caller can locate a Markdown file by a word or phrase from its body in one request, without first opening candidate files one by one.
- **SC-004**: For a tree of a few hundred entries, both traversal and search complete quickly enough to feel like a single interactive step to a connected assistant, not a multi-step investigation.
- **SC-005**: None of the eight existing file/directory tools change their name, input, or output shape as a result of this feature.

## Assumptions

- The storage tree in real use is Markdown-heavy (skills, policies, identity docs, notes) and moderate in size (hundreds, not millions, of entries) — the response cap and "Markdown-only" content search scope follow from this.
- A reasonable response cap (e.g. a few hundred entries) is applied to full-subtree and search results to bound response size and latency, with a clear truncation indicator when hit; the exact number is a planning/implementation detail, not a product decision.
- Name matching is case-insensitive substring matching (not glob/regex patterns), matching the simplicity of the rest of the tool surface.
- Content search only inspects files that are Markdown (by extension), consistent with this storage being described elsewhere as "a Markdown store."
- Trash is excluded from traversal/search results by default, with no requirement in this feature to add an option to include it (that can be a later, separate enhancement if needed).
- These capabilities are read-only: they do not create, modify, move, or delete anything.
