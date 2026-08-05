# Feature Specification: Tools Status Page

**Feature Branch**: `[024-tools-status-page]`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Aggiungere una pagina HTML nell'app, sempre raggiungibile (non un tool MCP, una pagina web per l'operatore/proprietario), che elenca tutti i tool MCP attualmente definiti dal server (i 17 tool nei 5 moduli di frontend/lib/mcp-tools/: create_file, read_file, delete_file, create_directory, list_directory, delete_directory, update_file, move, get_os_engine, get_os_upgrade, get_os_init, send_email, send_telegram_message, get_inbox, list_directory_tree, find_files_by_name, search_file_content) e per ciascuno mostra chiaramente se è attivo o disattivato, riflettendo lo stato corrente di MCP_DISABLED_TOOLS (spec 023-mcp-tool-toggle) al momento in cui la pagina viene caricata. La pagina deve essere protetta dallo stesso login owner già usato da /files e /settings (spec 009-editor-login-gate), non pubblica, perché rivela quali capacità del server sono abilitate. Vive in un nuovo percorso /tools nell'app Next.js esistente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which tools are active at a glance (Priority: P1)

The owner of a deployment wants to open one page and immediately see every MCP tool the server can offer, with a clear indication of which ones are currently active and which are disabled — without reading environment files or source code.

**Why this priority**: This is the entire value of the feature. Everything else (where the page lives, who can see it) only matters because this core view exists.

**Independent Test**: Sign in as the owner, open the page, and confirm every tool the server defines is listed with an unambiguous active/disabled indicator that matches the deployment's actual configuration.

**Acceptance Scenarios**:

1. **Given** a deployment with no tools disabled, **When** the signed-in owner opens the page, **Then** every tool is listed and shown as active.
2. **Given** a deployment where some tools have been disabled, **When** the signed-in owner opens the page, **Then** each disabled tool is clearly marked as disabled and every other tool is marked as active — the disabled ones are still listed, not hidden.
3. **Given** the page is open, **When** the owner looks at any single tool's entry, **Then** they can tell its status without needing to compare it against other entries or consult any other source.

---

### User Story 2 - Only the signed-in owner can see it (Priority: P2)

Because the page reveals which server capabilities are exposed to connected AI assistants, an anonymous visitor must never see it — they must be sent to sign in first, the same as the existing file editor and settings pages.

**Why this priority**: This is a security boundary, not the core value, but it's required before this page can safely exist at all — it reuses an already-established pattern rather than inventing new scope.

**Independent Test**: Without an active owner session, request the page directly and confirm no tool information is shown — the visitor is redirected to sign in, and lands back on the page after signing in successfully.

**Acceptance Scenarios**:

1. **Given** no active owner session, **When** a visitor requests the page, **Then** they are redirected to sign in and see no tool names or statuses.
2. **Given** a visitor was redirected to sign in from this page, **When** they complete sign-in, **Then** they are returned to the page they originally requested.
3. **Given** an active owner session, **When** the owner requests the page, **Then** it loads directly with no sign-in interruption.

---

### User Story 3 - The list always reflects the current, real configuration (Priority: P3)

An operator changes which tools are disabled and restarts the server. The next time anyone opens the page, it must show the new, correct status — not information left over from before the change.

**Why this priority**: Without this, the page could actively mislead an operator into thinking a change took effect when it didn't, which is worse than the page not existing. Still ranked after the core view and the access boundary because it's a correctness property of those, not a separate capability.

**Independent Test**: Change which tools are disabled, restart the server, reload the page, and confirm the displayed statuses match the new configuration with no stale entries.

**Acceptance Scenarios**:

1. **Given** the page was previously loaded showing a tool as active, **When** that tool is subsequently disabled and the server restarted, **Then** reloading the page shows it as disabled.
2. **Given** the deny-list configuration names something that doesn't match any real tool (spec 023 edge case), **When** the owner views the page, **Then** no extra or phantom entry appears for it — every real tool's status is exactly what the configuration implies, and nothing else.

---

### Edge Cases

- What happens when every tool is disabled? The page still loads successfully and lists all of them, each marked disabled — not an empty or broken page.
- What happens when the deny-list is empty or unset? Every tool shows as active — identical to how the page looks before this deny-list mechanism was ever configured.
- What happens if the owner's session expires while the page is already open? Consistent with how every other owner-only page in this app already handles an expired session (out of scope to change here).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated, stable page that lists every MCP tool the server can register.
- **FR-002**: For each listed tool, the page MUST clearly and unambiguously indicate whether it is currently active or disabled.
- **FR-003**: The page MUST be visible only to a signed-in owner; a visitor without an active owner session MUST be redirected to sign in before seeing any tool name or status.
- **FR-004**: After completing sign-in from a redirect triggered by this page, the visitor MUST be returned to this page.
- **FR-005**: The active/disabled status shown for each tool MUST reflect the server's real, current configuration at the time the page is loaded — not information cached from an earlier server start or an earlier page load.
- **FR-006**: Every tool the server can register MUST appear on the page regardless of its status — a disabled tool is still listed and labeled disabled, never omitted.
- **FR-007**: The page MUST require no additional per-tool setup by the operator beyond what already exists (the tool's own definition in code and the existing deny-list configuration) — it is a read-only view over information that already exists.

## Key Entities

- **Tool Status Entry**: Represents one MCP tool's listing on the page — the tool's name and its current active/disabled state, derived from whether it appears in the existing deny-list configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in owner can determine which tools are active or disabled within a few seconds of opening the page, without consulting any configuration file or source code.
- **SC-002**: 100% of the tools the server can register appear on the page, whether active or disabled.
- **SC-003**: 100% of requests to the page without an active owner session are redirected to sign in — no tool information is ever shown to an unauthenticated visitor.
- **SC-004**: After an operator changes the deny-list and restarts the server, the very next page load reflects the new status with no manual workaround or noticeable delay beyond a normal page load.

## Assumptions

- "Active" and "disabled" mean exactly what spec 023-mcp-tool-toggle's deny-list mechanism already defines — this feature is a read-only view over that existing configuration, not a new way to change it.
- The sign-in gate reused here is the same owner session mechanism already protecting `/files` and `/settings` (spec 009-editor-login-gate) — no new authentication method is introduced.
- The page is read-only: it does not let the owner toggle a tool's status from within the page itself — changing status remains an environment-variable-and-restart operation, unchanged by this feature.
- No historical or audit view is required — the page always shows only the current, live status, not a history of past changes.
- Visual grouping or ordering of tools on the page (e.g. by category vs. alphabetically) is a presentation detail left to planning, not a product requirement.
