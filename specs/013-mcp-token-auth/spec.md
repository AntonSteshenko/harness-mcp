# Feature Specification: MCP Personal Access Token Authentication

**Feature Branch**: `[013-mcp-token-auth]`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: "aggiungiamo aurth mcp anche con token" (let's add MCP auth also with a token)

## Clarifications

### Session 2026-07-24

- Q: Must personal access tokens (and their metadata) survive an application restart, or is it acceptable for them to reset? → A: Durable — personal access tokens and their metadata survive an application restart, exactly like spec 008's OAuth tokens/grants.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect a simple MCP client using a personal access token (Priority: P1)

As the owner of the storage, I want to generate a personal access token and use it directly as a bearer credential for MCP clients that can't complete a full OAuth sign-in/consent flow (e.g. command-line tools, scripts, or simple MCP-compatible clients I configure manually), so that I can connect those tools to my MCP server without setting up an OAuth authorization each time.

**Why this priority**: This is the entire point of the feature — without it, every MCP client must go through the OAuth flow from spec 008, which some simple or local clients aren't built to do, or which is needlessly heavy for the owner's own tools.

**Independent Test**: Generate a personal access token from the settings area, configure a simple MCP client to send it as a bearer token, and confirm the client can successfully call an MCP tool (e.g. list files) immediately, with no OAuth sign-in/consent screen involved.

**Acceptance Scenarios**:

1. **Given** the owner is signed in, **When** they generate a new personal access token, **Then** the token value is shown once, in full, and the owner is told it will not be shown again.
2. **Given** a valid personal access token, **When** an MCP client sends it as a bearer token to the MCP server, **Then** the request is authenticated and the client can call MCP tools with the same access level as an OAuth-connected client (spec 008 FR-010).
3. **Given** the OAuth-based connection flow from spec 008, **When** an AI assistant connects using it instead of a personal access token, **Then** it continues to work exactly as before — the two authentication methods coexist without one affecting the other.

---

### User Story 2 - Manage and revoke personal access tokens (Priority: P2)

As the owner, I want to see all personal access tokens I've created and revoke any of them, so that I can clean up tokens I no longer use or immediately cut off access if a token is exposed.

**Why this priority**: A way to generate tokens is only safe long-term if the owner can also see and revoke them; this is the same trust model already established for connected OAuth clients (spec 008 User Story 3).

**Independent Test**: With at least one personal access token created, open the list of personal access tokens, revoke one, and confirm requests using that token's value are rejected immediately afterward.

**Acceptance Scenarios**:

1. **Given** one or more personal access tokens exist, **When** the owner opens the personal access tokens view, **Then** each token is listed with a name/label, when it was created, and when it was last used — never the token value itself.
2. **Given** a personal access token is listed, **When** the owner revokes it, **Then** that token's next use is rejected, while every other token and every OAuth-connected client continues to work unaffected.

---

### Edge Cases

- What happens when someone sends a personal access token that doesn't match any known token? The request is rejected the same way an invalid or expired OAuth access token is rejected today (spec 008 FR-001) — no data returned, no hint about which part of the credential was wrong.
- What happens when the owner creates a personal access token but navigates away before copying it? The raw value cannot be retrieved again; the owner must revoke that token and generate a new one.
- What happens when the owner revokes a personal access token that's actively in use by a running client? The very next request using that token must be rejected — the client will need to be reconfigured with a new token to keep working.
- What happens when a personal access token and an OAuth-connected client are both used against the same storage at the same time? Both work independently, each subject to its own revocation, with no interaction between them.
- What happens when the owner isn't signed in and tries to generate or view personal access tokens? They must be sent through the existing owner sign-in screen first (spec 009), exactly like the existing connected-apps management page.
- What happens when the MCP server or its host application restarts (e.g. deploy, crash recovery)? Previously generated personal access tokens must remain valid and their metadata (name, timestamps, status) must be unchanged — no token is lost or silently reset by a restart.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the signed-in owner generate a new personal access token, each with an owner-supplied name/label to tell tokens apart.
- **FR-002**: The system MUST display a newly generated token's full value to the owner exactly once, at creation time, and MUST NOT make that value retrievable again afterward through any part of the system.
- **FR-003**: The MCP server MUST accept a valid personal access token as a bearer credential and grant it the same access level as an OAuth-issued access token (spec 008 FR-010 — full use of all MCP storage tools, no separate read-only/read-write distinction in this version).
- **FR-004**: The MCP server MUST continue to accept OAuth-issued access tokens exactly as it does today (spec 008); personal access tokens are an additional, independent way to authenticate, not a replacement.
- **FR-005**: The system MUST let the owner view a list of all personal access tokens they've created, showing each one's name/label, creation time, and last-used time, without ever showing the token value itself again.
- **FR-006**: The system MUST let the owner revoke any personal access token at any time, and that revocation MUST take effect no later than that token's next use.
- **FR-007**: The system MUST treat each personal access token independently — creating or revoking one MUST NOT affect any other personal access token or any OAuth-connected client's access.
- **FR-008**: The system MUST require the owner to be signed in (the same owner sign-in used for managing OAuth-connected clients, spec 009) before generating, viewing, or revoking personal access tokens.
- **FR-009**: The system MUST record personal access token creation and revocation so the owner can audit which tokens exist and when they were created or revoked.
- **FR-010**: A personal access token MUST NOT automatically expire — it MUST remain valid until the owner explicitly revokes it (see Assumptions for rationale).
- **FR-011**: The system MUST persist personal access tokens and their metadata (name/label, creation time, last-used time, revoked status) durably, so that an application restart does not invalidate them or require the owner to regenerate them — matching spec 008's durable persistence of OAuth tokens/grants.

### Key Entities

- **Personal Access Token**: A long-lived credential the owner generates directly (without an OAuth authorization flow), identified by an owner-given name/label, tracked by creation time, last-used time, and status (active or revoked); its underlying secret value is shown to the owner only once, at creation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can generate a working personal access token and successfully call an MCP tool with it in under 1 minute, with zero OAuth sign-in/consent steps involved.
- **SC-002**: 100% of MCP requests using a revoked or unknown personal access token are rejected, with no storage data returned.
- **SC-003**: Revoking a personal access token takes effect by that token's very next use — 0 additional successful requests after revocation.
- **SC-004**: Existing OAuth-connected clients (spec 008) show no change in behavior or success rate after this feature ships.
- **SC-005**: The owner can find and revoke a specific personal access token, by name, in under 30 seconds from the personal access tokens list.

## Assumptions

- This feature is scoped to authenticating requests to the MCP server (`/mcp`) only. It does not change how the web file editor's own sign-in works (spec 009's owner session cookie) — personal access tokens are not used to sign in to the editor UI.
- Personal access tokens do not expire automatically and remain valid until the owner revokes them — consistent with the project's existing preference for simple, low-friction setup for a single-owner, self-hosted tool (e.g. spec 008's plain-text owner credential storage), and because forcing periodic re-generation would defeat the purpose of a low-friction credential for the owner's own long-running local tools.
- The owner can create more than one personal access token (e.g. one per machine or script), matching the existing "each connected client is independent" model already established for OAuth clients (spec 008 FR-008).
- A personal access token, once issued, is opaque and unguessable, generated with the same security rigor as existing OAuth access tokens (spec 008); this specification does not mandate a specific storage or hashing approach for the secret at rest.
- No limit is placed on how many personal access tokens the owner may have active at once.
