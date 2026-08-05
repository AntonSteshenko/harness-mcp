# Feature Specification: MCP Tool Toggle

**Feature Branch**: `[023-mcp-tool-toggle]`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Aggiungere un meccanismo per disattivare singoli MCP tool tramite variabile d'ambiente MCP_DISABLED_TOOLS (lista di nomi separati da virgola, denylist). Di default tutti i tool sono attivi. Un tool il cui nome compare nella lista non viene registrato sul server MCP (non appare nella tools/list vista dal client), invece di essere registrato e rifiutare la chiamata a runtime. Nessuna validazione dei nomi richiesta: nomi che non corrispondono a nessun tool esistente vengono semplicemente ignorati. La lista dei tool esistenti da poter disattivare copre tutti e 15 i tool attualmente registrati in frontend/lib/mcp-tools/ (index.ts: create_file, read_file, delete_file, create_directory, list_directory, delete_directory, update_file, move; engineTools.ts: get_os_engine, get_os_upgrade, get_os_init; messagingTools.ts: send_email, send_telegram_message; inboxTools.ts: get_inbox; treeTools.ts: list_directory_tree, find_files_by_name, search_file_content)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Disable a single sensitive tool (Priority: P1)

An operator running a deployment of this MCP server wants to prevent connected AI assistants from ever seeing or using one specific capability (for example, `send_email`) in a given environment, without deleting or commenting out code.

**Why this priority**: This is the core, minimum-viable version of the feature — one tool, one deployment. Every other scenario is a variation on this same mechanism.

**Independent Test**: Set the deny-list configuration to name one existing tool, start the server, connect an MCP client, and confirm that tool is absent from the client's tool listing and cannot be invoked.

**Acceptance Scenarios**:

1. **Given** the deny-list configuration names `send_email`, **When** the server starts and a client requests the list of available tools, **Then** `send_email` does not appear in that list.
2. **Given** the deny-list configuration names `send_email`, **When** a client attempts to call `send_email` anyway, **Then** the call fails the same way it would for any tool name the server has never heard of.
3. **Given** the deny-list configuration names `send_email`, **When** the same client lists or calls any other tool (e.g. `read_file`), **Then** that tool behaves exactly as it did before the deny-list existed.

---

### User Story 2 - Disable several tools at once (Priority: P2)

An operator wants to strip out an entire category of capability (e.g. both messaging tools, or every write-capable file tool) for a locked-down deployment, using one configuration value rather than one per tool.

**Why this priority**: Real deployments are more likely to want to remove a handful of related tools than exactly one; this confirms the mechanism scales to a list, not just a single name.

**Independent Test**: Set the deny-list configuration to a comma-separated list of several existing tool names, start the server, and confirm all of them — and only them — are absent from the tool listing.

**Acceptance Scenarios**:

1. **Given** the deny-list configuration names `send_email` and `send_telegram_message` together, **When** the server starts, **Then** neither tool appears in the client's tool listing, while every other tool still does.
2. **Given** the deny-list configuration names every one of the server's tools, **When** the server starts, **Then** the client's tool listing is empty and the server otherwise starts normally (no crash, no error page).

---

### User Story 3 - Unset configuration changes nothing (Priority: P3)

An existing deployment that has never heard of this feature (no configuration set) must keep working exactly as it does today after this feature ships.

**Why this priority**: Backward compatibility is what makes this feature safe to ship — every deployment that doesn't opt in must see zero behavior change.

**Independent Test**: Start the server with the deny-list configuration absent (or empty), connect a client, and confirm all currently-existing tools are present and callable.

**Acceptance Scenarios**:

1. **Given** the deny-list configuration is not set at all, **When** the server starts, **Then** every tool the server currently ships is registered and callable, identical to pre-feature behavior.
2. **Given** the deny-list configuration is set to an empty value, **When** the server starts, **Then** the result is the same as if it were not set at all.

---

### Edge Cases

- What happens when a name in the deny-list doesn't match any tool the server actually registers (typo, renamed tool, tool from a future version)? It is silently ignored — no startup error, no effect on any other tool.
- What happens when the same tool name appears more than once in the list, or with surrounding whitespace? It is treated the same as listing it once; whitespace around each name is not significant.
- What happens when a name in the list differs from the real tool name only in letter case? It does not match — tool names are matched exactly as registered (case-sensitive), since every existing tool name is already lowercase `snake_case`.
- What happens if the deny-list is changed while the server is already running? No effect until the next server start — this configuration is only read at startup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read a deny-list of tool names from a single piece of environment configuration at server startup.
- **FR-002**: When that configuration is unset or empty, System MUST register and expose every tool exactly as it does today — no opt-in required to preserve current behavior.
- **FR-003**: For every tool name present in the deny-list, System MUST NOT register that tool with the MCP server, such that it does not appear in any connected client's tool listing.
- **FR-004**: A disabled tool MUST NOT be callable; a client attempting to call it by name MUST receive the same error the server already produces for any unrecognized tool name, with no separate "tool disabled" message.
- **FR-005**: A deny-list entry that does not match any of the server's registered tool names MUST be ignored, with no startup failure and no effect on any other tool.
- **FR-006**: The mechanism MUST be able to individually address every tool the server currently exposes, by its exact existing tool name (`create_file`, `read_file`, `delete_file`, `create_directory`, `list_directory`, `delete_directory`, `update_file`, `move`, `get_os_engine`, `get_os_upgrade`, `get_os_init`, `send_email`, `send_telegram_message`, `get_inbox`, `list_directory_tree`, `find_files_by_name`, `search_file_content`).
- **FR-007**: The configuration MUST accept multiple tool names at once, separated by commas, in a single value.
- **FR-008**: A change to the deny-list MUST take effect on the next server start; the system is not required to detect or apply changes while already running.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can remove any single tool from the set of capabilities visible to connected assistants by changing one configuration value and restarting the server — no code change required.
- **SC-002**: With the configuration unset, 100% of the tools available before this feature remain available after it ships — zero regression for existing deployments.
- **SC-003**: An operator can disable anywhere from one tool up to the entire tool catalog using the same single configuration mechanism, with the server starting successfully in every case.
- **SC-004**: A misspelled or outdated tool name in the configuration has no effect on server startup and no effect on any tool other than the one it might have matched.

## Assumptions

- Tool names are the exact, stable identifiers already used when each tool is registered today (e.g. `send_email`); this feature does not introduce a separate display name or alias system.
- Whole-tool granularity is sufficient for this feature; disabling part of a tool's behavior, or toggling by category/group rather than by individual tool, is out of scope (the individual-tool mechanism can address every tool in a group by listing them all).
- Applying a configuration change via a server restart is acceptable, consistent with how this project already handles its other environment-based configuration (storage, SMTP, Telegram, bootstrap path).
- No audit trail of which tools were disabled at a given startup is required beyond what operators can already see by inspecting their own configuration.
