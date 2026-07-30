# Feature Specification: Dedicated Inbox MCP Tool

**Feature Branch**: `020-mcp-inbox-tool`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Vorrei avere uno strumento MCP dedicato per l'inbox: uno strumento che fornisce il contenuto del file inbox.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the inbox in one call (Priority: P1)

A connected assistant is running a workflow that needs to know what's in the
owner's quick-capture inbox (e.g. `daily-plan`, which folds inbox items into
today's list, or `weekly-review`, which sorts and empties it). Today it must
already know the exact file path and call the generic file-reading tool with
it. Instead, it should be able to call one dedicated, purpose-named tool and
get the inbox's current content back directly.

**Why this priority**: The inbox is read as part of core, frequently-run
skills (daily-plan, weekly-review). A dedicated tool removes a path-discovery
step from those flows and makes the assistant's intent (checking the inbox)
explicit and self-describing, mirroring how `get_os_engine` and
`send_email` already give the assistant purpose-built entry points instead of
generic file operations.

**Independent Test**: Can be fully tested by calling the new tool against a
storage account whose inbox file has known content and confirming the
returned content matches exactly, without the caller supplying any path.

**Acceptance Scenarios**:

1. **Given** an inbox file that contains one or more captured lines, **When**
   the assistant calls the inbox tool, **Then** it receives the file's full,
   current content.
2. **Given** an inbox file that exists but contains only its header (freshly
   emptied by a weekly review), **When** the assistant calls the inbox tool,
   **Then** it receives that header content, not an error.
3. **Given** the same inbox file is edited between two calls, **When** the
   assistant calls the inbox tool a second time, **Then** it receives the
   latest content, not a stale copy from the first call.

---

### User Story 2 - Clear signal when the inbox doesn't exist yet (Priority: P2)

An assistant connects to a storage account where the business OS hasn't been
set up yet (no `data/inbox.md` has been created), and calls the inbox tool
anyway.

**Why this priority**: Without a clear signal, the assistant may misreport a
missing OS as a generic failure, confusing the owner. This is secondary to
the core read path (US1) because it only affects not-yet-initialized
accounts, but it's still needed for the tool to be trustworthy.

**Independent Test**: Can be fully tested by calling the tool against a
storage account with no inbox file and confirming the tool reports a clear,
distinguishable "not found" outcome rather than an opaque error.

**Acceptance Scenarios**:

1. **Given** no inbox file exists yet, **When** the assistant calls the inbox
   tool, **Then** it receives a clear result indicating the inbox doesn't
   exist yet, distinguishable from a transient/unexpected failure.

---

### Edge Cases

- What happens when the inbox file exists but is empty (zero bytes)? The tool
  returns the empty content, not an error.
- What happens when `data/inbox.md` has been moved into Trash? The tool
  reports the same "not found" outcome as a never-created inbox, since the
  file no longer exists at its expected path.
- What happens if the underlying storage is temporarily unreachable? The tool
  reports a distinct failure outcome, not the "not found" outcome, so the
  assistant doesn't wrongly conclude the OS was never set up.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a dedicated MCP tool that returns the full,
  current content of the owner's inbox file, without requiring the caller to
  supply a file path.
- **FR-002**: The tool MUST be read-only — it MUST NOT create, modify, or
  delete the inbox file or any other file.
- **FR-003**: The tool MUST always return the latest content of the inbox
  file as of the moment it is called (no caching of a previous call's
  result).
- **FR-004**: When the inbox file does not exist, the tool MUST return a
  clearly distinguishable "not found" outcome rather than a generic or
  opaque error.
- **FR-005**: When the inbox file cannot be read for any other reason (e.g.
  the underlying storage is unreachable), the tool MUST return a failure
  outcome distinguishable from the "not found" outcome in FR-004.
- **FR-006**: The tool's description MUST make clear to a connected assistant
  when and why to call it (checking/using the quick-capture inbox), so it is
  discoverable alongside the existing generic file tools.

### Key Entities

- **Inbox**: The single, well-known quick-capture log (`data/inbox.md`) where
  the owner drops one-line, dated notes throughout the week. It is emptied
  back down to just its header during a weekly review. This feature only
  reads it; nothing about its structure or lifecycle changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An assistant can retrieve the inbox's content in a single tool
  call, with zero preceding calls needed to discover its path.
- **SC-002**: 100% of calls made against an existing inbox file return
  content that exactly matches the file's actual current content.
- **SC-003**: 100% of calls made against a storage account with no inbox file
  yet return a "not found" outcome that a caller can distinguish from other
  failures, rather than a generic error.

## Assumptions

- The inbox lives at a single, fixed, well-known path (`data/inbox.md`)
  within the business OS's existing file structure — there is no per-call
  selection of which inbox to read.
- Each connected storage account has at most one inbox; multi-inbox or
  multi-tenant selection is out of scope.
- The existing generic file-reading tool continues to work unchanged; this
  feature adds a purpose-built, read-only shortcut alongside it rather than
  replacing or restricting it.
- Writing to the inbox (capturing a new item, or emptying it during weekly
  review) continues to go through the existing generic file tools — this
  feature does not add any inbox-writing capability.
