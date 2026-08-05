# Feature Specification: Manage Tools From The Page

**Feature Branch**: `[025-manage-tools-page]`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Estendere la pagina /tools (spec 024-tools-status-page, sola lettura oggi) per permettere al proprietario, già autenticato con lo stesso login owner, di attivare/disattivare ogni singolo tool MCP direttamente dalla pagina, invece di modificare a mano la variabile d'ambiente MCP_DISABLED_TOOLS e riavviare il server. Requisiti chiave dati dall'utente: (1) il cambio di stato di un tool richiede un passaggio di conferma esplicito prima di essere applicato — non un semplice click/toggle immediato; (2) dopo la conferma, la pagina deve mostrare chiaramente un avviso che l'effetto non è istantaneo per le sessioni degli assistenti AI già connessi (potrebbero continuare a vedere il vecchio elenco tool finché non si riconnettono o richiedono di nuovo tools/list). Per rendere possibile un effetto 'vivo' senza richiedere un riavvio del server, lo stato attivo/disattivato di ciascun tool deve essere spostato dalla variabile d'ambiente MCP_DISABLED_TOOLS (letta solo all'avvio, spec 023-mcp-tool-toggle) a uno storage persistente che il server MCP legge dinamicamente ad ogni richiesta — coerente con come lo stato applicativo esistente (grant OAuth, personal access token, lingua, inbox) vive già nel bucket S3 di questa app, invece che in variabili d'ambiente. Questa feature supersede il controllo via MCP_DISABLED_TOOLS di spec 023 come meccanismo primario di attivazione/disattivazione: il nuovo storage persistente diventa la fonte di verità."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Change a tool's status from the page (Priority: P1)

The owner, already signed in and viewing the tools status page (spec 024), wants to disable or re-enable a specific tool right there — without editing an environment file and restarting the server.

**Why this priority**: This is the entire point of the feature — turning the existing read-only status view into something the owner can actually act on.

**Independent Test**: Signed in as owner, from the tools page, change one active tool to disabled, and confirm it now shows disabled; then change it back to active and confirm it shows active again — all without touching any configuration file or restarting anything.

**Acceptance Scenarios**:

1. **Given** a tool currently shown as active, **When** the owner chooses to disable it, **Then** the system asks them to explicitly confirm — naming the specific tool and the change about to be made — before anything is applied.
2. **Given** the owner confirms the change, **When** the confirmation completes, **Then** the tool's status is updated and the page immediately shows it as disabled, with no need to reload.
3. **Given** a tool currently shown as disabled, **When** the owner chooses to re-enable it and confirms, **Then** it is updated and immediately shown as active — the same confirm-then-apply flow works in both directions.
4. **Given** the owner is on the confirmation step, **When** they decide not to proceed, **Then** nothing changes — the tool's status remains exactly what it was before.

---

### User Story 2 - Understand that the change isn't instant everywhere (Priority: P2)

Right after confirming a change, the owner needs to know that any AI assistant session that was already connected before the change might not see it right away — so they don't assume an open conversation is immediately affected.

**Why this priority**: Without this, a successful-looking status change could give the owner false confidence that a currently-open assistant session has already lost (or gained) access to a tool, when it may not have yet.

**Independent Test**: Confirm a status change and verify a clear, immediate on-page notice explains that already-connected assistant sessions may keep using the previous status until they reconnect or refresh their own tool list.

**Acceptance Scenarios**:

1. **Given** the owner has just confirmed a status change, **When** the change is applied, **Then** the page clearly states that already-connected AI assistant sessions may not see this change until they reconnect.
2. **Given** the owner makes a second, different status change shortly after the first, **When** that second change is applied, **Then** the same notice appears again — it's not a one-time message the owner might have missed.

---

### User Story 3 - The change is the one true status everywhere (Priority: P3)

Once a change is confirmed, the new status must be what actually governs the tool going forward — for anyone viewing the page, and for the live MCP server deciding whether to offer that tool to a newly connecting assistant — with no separate, conflicting configuration silently taking precedence.

**Why this priority**: This is a correctness property of the feature working at all, ranked after the interactive change itself and the warning the owner directly asked for.

**Independent Test**: Change a tool's status from the page, then have a new AI assistant session connect (or reconnect) and confirm it sees exactly the new status — matching what the page shows, with nothing overriding it.

**Acceptance Scenarios**:

1. **Given** a tool's status was just changed from the page, **When** a new MCP connection is made afterward, **Then** it sees the tool exactly as the page now shows it.
2. **Given** a tool's status has been changed from the page at least once, **When** the owner reloads the page later (a different visit, possibly after other changes), **Then** it still shows the correct, latest status — not something stale or reverted.

---

### Edge Cases

- What happens if the owner tries to change a tool that no longer exists (e.g. removed from the server since the page was loaded)? The system must not crash or silently misbehave — the attempt is rejected with a clear explanation, and the rest of the page keeps working.
- What happens if the same tool is changed from two different browser tabs/sessions close together? The last confirmed change wins — the tool ends up in whichever status was confirmed most recently, and the page reflects that.
- What happens if the underlying persistent storage is temporarily unavailable when the owner confirms a change? The change must fail clearly and visibly — the owner must never be left believing a change succeeded when it didn't.
- What happens to a deployment that already had tools disabled via `MCP_DISABLED_TOOLS` before upgrading to this feature? Those exclusions are **not** carried over automatically — every tool starts active in the new store (FR-011), so a previously-disabled tool becomes active again until the owner disables it again from the page. This is a deliberate, not accidental, behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a signed-in owner change a specific tool's status (active or disabled) directly from the tools page, without editing any configuration file or manually restarting the server.
- **FR-002**: Before applying any status change, System MUST require the owner to take an explicit, separate confirmation step that names the specific tool and the change about to be made — a single click on the same control that displays current status MUST NOT by itself apply a change.
- **FR-003**: Declining or abandoning the confirmation step MUST leave the tool's status completely unchanged.
- **FR-004**: Immediately after a change is applied, System MUST clearly notify the owner that already-connected AI assistant sessions may not see the new status until they reconnect or re-request their tool list.
- **FR-005**: This notice MUST appear every time a change is applied, not only the first time in a session.
- **FR-006**: A confirmed status change MUST take effect without requiring the server to be restarted.
- **FR-007**: Every part of the system that decides a tool's status (what the page displays, and what the live MCP server offers to a connecting assistant) MUST consult the same authoritative, persisted status — no separate mechanism may silently override or conflict with it.
- **FR-008**: Only a signed-in owner (the same authentication already required to view the tools page) MUST be able to change a tool's status; an unauthenticated visitor MUST NOT be able to trigger a change.
- **FR-009**: After a change is applied, the page MUST immediately reflect the new status without requiring a manual reload.
- **FR-010**: If a requested change cannot be applied (e.g. the target tool no longer exists, or the underlying storage is temporarily unavailable), System MUST clearly report the failure to the owner rather than showing the change as successful.
- **FR-011**: On first use, every tool MUST start active in the new persisted store — System MUST NOT read or carry over any existing `MCP_DISABLED_TOOLS` (spec 023) value into it. An owner upgrading from spec 023 is responsible for re-applying any exclusions they still want, from the page.

## Key Entities

- **Tool Status Record**: The persisted, authoritative active/disabled state for one tool, identified by its name. Replaces the environment-variable-only record from spec 023 as the single source of truth (FR-007).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can change any single tool's status, in either direction, entirely from the page — without editing a configuration file or restarting the server.
- **SC-002**: 100% of status changes go through an explicit confirmation step naming the specific tool and the new status — no change is ever applied from a single, undifferentiated click.
- **SC-003**: A confirmed change is visible to the very next new tool connection/request, without a server restart.
- **SC-004**: 100% of confirmed changes display the "not instant for already-connected sessions" notice — not just the first one in a session.
- **SC-005**: 100% of unauthenticated attempts to change a tool's status are rejected, matching the existing protection on viewing the page.

## Assumptions

- On first use, the new persisted store starts with every tool active — it does **not** read or migrate any existing `MCP_DISABLED_TOOLS` value (spec 023). A deployment upgrading from spec 023 that relied on `MCP_DISABLED_TOOLS` to keep a tool disabled must re-apply that exclusion from the page after upgrading, or that tool becomes active again. This was a deliberate choice (not a default): see Edge Cases and FR-011.
- Confirmation applies identically whether the owner is disabling an active tool or re-enabling a disabled one — both directions are the same kind of deliberate change, not just the disable direction.
- The persisted status record (Key Entities) is read by both the page (for display) and the live MCP server (for registration decisions) — there is exactly one source of truth after this feature ships, not two that could disagree.
- No history/audit trail of past status changes is required — only the current status is shown or needs to be shown.
- Confirmation is a same-page interaction (e.g. a two-step control) rather than navigating away to a separate page — a presentation detail left to planning, not a product requirement.
