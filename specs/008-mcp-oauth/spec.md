# Feature Specification: OAuth Authorization for the MCP Server

**Feature Branch**: `008-mcp-oauth`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "vorrei aggiungere oauth per add mcp al chatgpt claude ecc" (I want to add OAuth so the MCP server can be added to ChatGPT, Claude, etc.)

## Clarifications

### Session 2026-07-20

- Q: Is the owner credential for the new OAuth sign-in a new, dedicated credential, or does it reuse the existing S3/MinIO storage credentials? → A: New dedicated credential, separate from the S3/MinIO storage credentials.
- Q: Should authorized connections (tokens, connected-client records) survive an application restart, or is it acceptable for them to reset on restart? → A: Persist durably — tokens and connected-client records survive a restart; assistants stay connected.
- Q: Should the owner sign-in screen apply brute-force protection (lockout/rate-limiting after repeated failed attempts)? → A: Yes — apply standard lockout/rate-limiting after repeated failed sign-in attempts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect an AI assistant to the MCP server (Priority: P1)

As the owner of the storage, I want to add my MCP server as a connector inside an AI assistant (e.g. ChatGPT or Claude) by signing in and approving the request, so that the assistant can use my file storage tools without me ever handing it a raw password or API key.

**Why this priority**: This is the entire point of the feature — without it, hosted AI assistants cannot connect to the server at all, since they require an OAuth authorization flow before allowing a remote MCP connector to be added.

**Independent Test**: From an AI assistant's "add connector" flow, point it at the MCP server's URL, complete the sign-in/consent screen, and confirm the assistant can successfully call an MCP tool (e.g. list files) immediately afterward.

**Acceptance Scenarios**:

1. **Given** the MCP server is running and an AI assistant is being configured to connect to it, **When** the assistant starts the connection, **Then** the owner is shown a sign-in and consent screen before any access is granted.
2. **Given** the owner is on the consent screen, **When** they approve the request, **Then** the assistant receives access and can successfully call MCP tools on the owner's behalf.
3. **Given** the owner is on the consent screen, **When** they deny the request, **Then** the assistant receives no access and cannot call any MCP tools.

---

### User Story 2 - Unauthorized requests are rejected (Priority: P2)

As the owner, I want any request to the MCP server that isn't backed by an approved authorization to be rejected, so that my files stay private even though the server is reachable over the internet.

**Why this priority**: Adding a login screen is only meaningful if the server actually enforces it on every request; this is the security backbone the rest of the feature depends on.

**Independent Test**: Call the MCP server's tool endpoints directly with no token, and separately with an expired or revoked token, and confirm both are rejected with a clear authorization error rather than returning data.

**Acceptance Scenarios**:

1. **Given** no access token is presented, **When** an MCP tool is called, **Then** the request is rejected and no data is returned.
2. **Given** an access token that has expired or been revoked, **When** an MCP tool is called, **Then** the request is rejected and no data is returned.

---

### User Story 3 - Review and revoke connected assistants (Priority: P3)

As the owner, I want to see which AI assistants are currently connected and revoke any of them, so that I can clean up access I no longer want (e.g. after trying out a client, or if I suspect a token leaked).

**Why this priority**: Important for ongoing trust and control, but the server is still safe and usable without it on day one since access can otherwise only grow through the explicit consent screen in User Story 1.

**Independent Test**: With at least one AI assistant already connected, open the list of connected clients, revoke one, and confirm that client's next tool call is rejected.

**Acceptance Scenarios**:

1. **Given** one or more assistants are connected, **When** the owner opens the connected-clients view, **Then** each connected assistant is listed with when it was authorized and when it was last used.
2. **Given** a connected assistant is listed, **When** the owner revokes it, **Then** that assistant's access stops working on its next request.

---

### Edge Cases

- What happens when the owner denies the consent screen mid-flow? The assistant must end up with no access, and no token should exist to revoke later.
- What happens when a client's refresh token is used after the owner already revoked that client? The request must be rejected the same as any other unauthorized call.
- What happens when two different assistants (e.g. ChatGPT and Claude) are connected at the same time? Each must be tracked and revocable independently — revoking one must not affect the other.
- What happens when a client tries to reuse an authorization code a second time? The reuse attempt must be rejected and, per standard OAuth practice, should invalidate the tokens already issued from that code.
- What happens when the owner's own sign-in credential changes? Previously issued access/refresh tokens for connected assistants should remain valid unless explicitly revoked — only the owner's ability to sign in again is affected.
- What happens when a client's access token expires mid-session? The next tool call must fail with an authorization error, and the client should be able to obtain a new token via its refresh token without the owner re-approving from scratch (unless the refresh token has also expired or been revoked).
- What happens when the MCP server or its host application restarts (e.g. deploy, crash recovery)? Previously connected assistants must remain connected — their tokens and connected-client records must survive the restart rather than forcing every assistant to be re-authorized from scratch.
- What happens when someone repeatedly enters the wrong owner credential on the sign-in screen? After enough failed attempts, further attempts must be temporarily locked out or delayed rather than allowed to keep guessing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The MCP server MUST require every tool request to carry a valid, unexpired access token; requests without one MUST be rejected before any storage operation runs.
- **FR-002**: The system MUST support AI assistant clients discovering and registering themselves with the MCP server automatically, so a new assistant (ChatGPT, Claude, or any other MCP-compatible client) can be connected without the owner manually pre-registering it first.
- **FR-003**: Before granting any access, the system MUST present a sign-in and consent screen showing which client is requesting access, and MUST only issue access after the owner explicitly approves.
- **FR-004**: The system MUST let the owner deny a connection request, in which case no access is granted and no usable token is issued.
- **FR-005**: The system MUST issue access that can expire and be renewed (without requiring the owner to re-approve every time) as well as be revoked outright.
- **FR-006**: The system MUST let the owner view all currently connected clients, including when each was authorized and when each was last used.
- **FR-007**: The system MUST let the owner revoke a specific connected client's access at any time, and that revocation MUST take effect no later than that client's next request.
- **FR-008**: The system MUST treat each connected client independently — authorizing or revoking one client MUST NOT affect any other connected client's access.
- **FR-009**: The system MUST authenticate the owner via a single owner-controlled credential, created and configured specifically for this OAuth sign-in and kept separate from the existing S3/MinIO storage credentials, before letting them approve or deny a connection request or manage connected clients.
- **FR-010**: Every approved client MUST be granted the same single level of access — full use of all MCP storage tools; the system does not offer separate read-only vs. read-write grants in this version.
- **FR-011**: The system MUST record authorization grants, denials, and revocations so the owner can audit who was given access and when.
- **FR-012**: The system MUST persist connected-client records and issued tokens durably, so that an application restart does not disconnect previously authorized assistants or require the owner to re-approve them.
- **FR-013**: The system MUST apply standard lockout/rate-limiting to the owner sign-in screen after repeated failed attempts, to protect the single owner credential against brute-force guessing.

## Key Entities *(include if feature involves data)*

- **Connected Client**: An external application (e.g. ChatGPT, Claude) that has requested or been granted access; tracked by name/identifier, when it registered, when it was authorized, and its current status (pending, active, revoked).
- **Access Grant**: The outcome of the owner approving or denying a specific client's request; if approved, results in tokens the client can use until they expire or are revoked.
- **Owner Credential**: The single identity used to sign in and approve/deny connection requests and manage connected clients for this self-hosted instance; distinct from the S3/MinIO storage credentials used elsewhere in the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can go from "add connector" in an AI assistant to that assistant successfully running its first storage command in under 3 minutes, without manually copying or generating any API key.
- **SC-002**: 100% of MCP tool requests that lack a valid, unexpired, non-revoked access token are rejected.
- **SC-003**: After the owner revokes a connected client, that client's subsequent requests are rejected starting with its very next request.
- **SC-004**: The owner can, at any time, see a complete and accurate list of every currently connected client and when it was last used.
- **SC-005**: Revoking or losing access for one connected client never disrupts the other connected clients' ongoing access.

## Assumptions

- This MCP server is a single-owner, self-hosted instance (consistent with the rest of the project, which runs locally/self-hosted with no existing multi-user account system) — so OAuth authenticates one owner, not multiple distinct end users.
- AI assistant clients (ChatGPT, Claude, and other MCP-compatible clients) follow the standard Model Context Protocol authorization flow, including automatic client discovery/registration, consistent with how these products already connect to other remote MCP servers — no assistant-specific integration work is assumed beyond implementing that standard flow.
- A single all-or-nothing access grant (full use of the existing MCP storage tools) is sufficient for this version; finer-grained per-tool or read-only/read-write scopes are out of scope unless requested later.
- Standard OAuth token lifetimes apply (short-lived access tokens with longer-lived, revocable refresh tokens) rather than either permanently valid tokens or tokens that never auto-renew.
- The owner-facing sign-in and consent screens, and the connected-clients management view, are reachable from the existing web application (`frontend/`) rather than a separate admin tool.
