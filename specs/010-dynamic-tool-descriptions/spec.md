# Feature Specification: Dynamic Tool Descriptions from a Single Bootstrap File

**Feature Branch**: `010-dynamic-tool-descriptions`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Dynamic tool descriptions sourced at runtime from a single source of truth (the storage's bootstrap file), so a connecting chat client learns when to use the storage tools and that it must read the bootstrap file (AGENTS.md) before acting, without hardcoding any trigger phrases in code."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connecting client learns when and how to use the storage (Priority: P1)

As a chat client (or the AI agent behind it) connecting to the MCP server, when I ask for the list of available tools, I want each tool's description to tell me what the storage is for, what kinds of user requests should send me to it, and that I must read the bootstrap file before taking any action, so that I reliably reach for the storage at the right moments instead of ignoring it or guessing.

**Why this priority**: This is the actual problem being solved — today the client has no way to know *when* to use the server, and no reminder to read the bootstrap file first. Without this, the rest of the feature has no purpose.

**Independent Test**: Connect a client to the server, request the tool list, and confirm the descriptions of the file-reading and folder-listing tools mention the storage's purpose, the situations that call for using it, and an explicit instruction to read the bootstrap file first.

**Acceptance Scenarios**:

1. **Given** the bootstrap file exists in storage and contains both the context and trigger information, **When** a client requests the tool list, **Then** the description of each entry tool (read a file, list a folder) begins with a generated sentence naming the storage's context, the situations/phrases that call for it, and an instruction to read the bootstrap file first, followed by that tool's original description text unchanged.
2. **Given** the same bootstrap file, **When** a client requests the tool list, **Then** the description of each tool that writes or changes storage content (create file, update file, move, create folder, delete folder, delete file) begins with a short reminder to consult the bootstrap file before writing, followed by that tool's original description text unchanged.

---

### User Story 2 - Owner updates guidance without a redeploy (Priority: P2)

As the owner who maintains the assistant's bootstrap instructions, I want to change the description of what the storage is for and which situations should trigger its use by editing the bootstrap file's content, so that the guidance shown to connecting clients stays accurate as my workflow evolves, without needing a code change or redeploy.

**Why this priority**: This is what makes the guidance maintainable in practice — a hardcoded description would drift out of date the moment the owner's workflow changes. It depends on User Story 1 already producing generated descriptions from the file.

**Independent Test**: Edit the context or trigger information in the bootstrap file, then request the tool list again shortly afterward (without restarting or redeploying the server) and confirm the new wording is reflected in the tool descriptions.

**Acceptance Scenarios**:

1. **Given** the server is already running, **When** the owner edits the trigger phrases in the bootstrap file, **Then** the next tool-list request (within about a minute) reflects the updated phrases in the entry tools' descriptions.
2. **Given** the server is already running, **When** the owner edits the context label in the bootstrap file, **Then** the next tool-list request reflects the updated label.

---

### User Story 3 - Tool listing never breaks, even with a missing or malformed bootstrap file (Priority: P1)

As the owner/operator of the server, I want the tool list to always be returned successfully — using each tool's plain original description — even if the bootstrap file is not configured, doesn't exist, can't be read, or doesn't contain the expected markers, so that a bootstrap-file problem never makes the storage tools disappear or the connection fail.

**Why this priority**: This is a safety requirement of equal importance to User Story 1 — a feature that can silently take down tool discovery is worse than no feature at all, since it would block every other capability of the server.

**Independent Test**: Remove the bootstrap file configuration, then point it at a non-existent file, then point it at a file with no markers, and in each case confirm the tool list is still returned successfully with each tool's original, unmodified description and no error surfaced to the client.

**Acceptance Scenarios**:

1. **Given** no bootstrap file location is configured, **When** a client requests the tool list, **Then** every tool is returned with its original description and no error occurs.
2. **Given** a bootstrap file location is configured but the file does not exist or cannot be read, **When** a client requests the tool list, **Then** every tool is returned with its original description and no error occurs.
3. **Given** the bootstrap file exists but contains neither the context nor the trigger information, **When** a client requests the tool list, **Then** every tool is returned with its original description and no error occurs.
4. **Given** the bootstrap file contains only one of the two pieces of information (context or triggers, not both), **When** a client requests the tool list, **Then** the generated guidance text uses whatever information is present and omits the missing part gracefully, without error.

---

### Edge Cases

- What happens when the bootstrap file is present but empty (zero bytes)? → Treated the same as "no markers found": tools fall back to their original descriptions.
- What happens when the trigger list is present but empty (e.g., the marker exists with no phrases after it)? → Treated as if the triggers marker were absent for the purpose of composing the sentence.
- What happens if reading the bootstrap file is slow or times out? → The tool list must still be returned promptly using original descriptions rather than waiting indefinitely.
- What happens if the bootstrap file is edited mid-request? → The next tool-list request simply reflects whichever complete version of the file was read; no partial or torn content should produce a malformed description.
- What happens if the same server instance receives many rapid tool-list requests? → Repeated reads of the bootstrap file must not meaningfully slow down or degrade tool listing; a short-lived cached copy of the file's content may be reused across requests made within a small time window.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support configuring a single location, within the existing storage, of a "bootstrap" file that acts as the sole source of truth for the guidance text added to tool descriptions.
- **FR-002**: System MUST read the current content of the bootstrap file when a client requests the list of available tools, so that edits to the file are reflected without a code change or redeploy.
- **FR-003**: System MUST recognize, within the bootstrap file, an optional piece of information identifying the "context" — a short label describing what the storage represents (e.g., "Assistant OS").
- **FR-004**: System MUST recognize, within the bootstrap file, an optional piece of information identifying the "triggers" — a list of phrases or situations describing when the storage tools should be used.
- **FR-005**: System MUST recognize both pieces of information in a form that does not visually disrupt the bootstrap file when it is rendered or read as a normal document.
- **FR-006**: System MUST, for each entry tool (reading a file, listing a folder), prepend generated guidance to the tool's description that: (a) names the context, (b) states the situations/phrases that call for using the storage, and (c) instructs the reader to first read the bootstrap file and follow it — while preserving the tool's original description text unchanged and in full.
- **FR-007**: System MUST, for each write/modify tool (creating a file, updating a file, moving an item, creating a folder, deleting a folder, deleting a file), prepend a shorter generated reminder to the tool's description that references the context and instructs the reader to follow the bootstrap file before writing — while preserving the tool's original description text unchanged and in full.
- **FR-008**: System MUST NOT change any tool's name, parameter schema, or runtime behavior as part of generating descriptions — only descriptive text is affected.
- **FR-009**: System MUST fall back to each tool's original, unmodified description whenever the bootstrap location is not configured, the file cannot be found or read, or neither piece of information is present in it — without raising an error to the client and without omitting any tool from the list.
- **FR-010**: System MUST produce a best-effort guidance sentence when only one of the two pieces of information (context or triggers) is present, using what is available rather than falling back entirely.
- **FR-011**: System SHOULD notify already-connected clients that tool descriptions have changed when the bootstrap file's relevant content changes, so clients can refresh their view without reconnecting, where the connection protocol supports such a notification.

### Key Entities

- **Bootstrap File**: A single document living in the existing storage, designated as the source of truth for tool-description guidance; owners edit it directly to change what guidance is shown.
- **Context**: An optional, short label extracted from the bootstrap file describing what the storage represents to the person or agent using it.
- **Triggers**: An optional list of phrases or situations extracted from the bootstrap file describing when the storage tools are relevant.
- **Tool Description**: The human-readable text shown to a connecting client for a given tool, made up of generated guidance (when available) followed by that tool's fixed, original description.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can change which user requests should trigger use of the storage by editing only the bootstrap file's content, with zero code changes and zero redeploys, and see the update reflected the next time a client lists tools, within about one minute.
- **SC-002**: Tool listing succeeds 100% of the time regardless of the bootstrap file's state (missing configuration, missing file, unreadable file, or file without markers) — it is never the cause of a failed or blocked tool-list request.
- **SC-003**: 100% of entry tools' descriptions include the current context and trigger guidance whenever both are present in the bootstrap file, and 100% of write tools' descriptions include the shorter reminder in the same conditions.
- **SC-004**: Every tool's name, parameters, and functional behavior are identical before and after this feature is introduced — only descriptive text differs.

## Assumptions

- "Entry tools" are the file-reading and folder-listing tools (`read_file`, `list_directory`); "write tools" are every tool that creates, changes, moves, or deletes storage content (`create_file`, `update_file`, `move`, `create_directory`, `delete_directory`, `delete_file`). The feature request's write-tool examples did not explicitly list the folder-creation tool, and did not mention the file-deletion tool at all even though it already exists alongside the other six — both are treated as write tools since they clearly belong to that category and the server must keep behaving consistently across its full existing tool set.
- The bootstrap file path is a single configured value pointing to one file within the existing storage; no new authentication or access path is required since the server already has read access to its own storage.
- A short-lived cached copy of the bootstrap file's content (on the order of tens of seconds) may be used to avoid re-reading it on every single tool-list request, as long as edits are still reflected within about a minute; this caching is a performance optimization, not a correctness requirement.
- Guidance text is generated in English, matching the language of the tools' existing descriptions.
- No new user-facing configuration surface is introduced beyond the single bootstrap-file location; there is no expectation of an admin UI for this feature.
