# Feature Specification: REST API Token Authentication

**Feature Branch**: `027-api-token-auth`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Allow REST API routes under /api (starting with /api/file) to authenticate requests using a Personal Access Token (PAT) or OAuth access token via Authorization: Bearer header, as a fallback when there is no owner session cookie. This mirrors the existing auth pattern already used by app/mcp/route.ts (verifyAccessToken(bearerToken) ?? verifyPersonalAccessToken(bearerToken)), applied to requireOwnerSession() / the REST API guard instead of only the MCP endpoint. Purpose: let an external Next.js app (deployed separately, e.g. on Vercel) read and write CSV files stored in S3 by calling this app's /api/file endpoint server-to-server, authenticating with a PAT instead of a browser session cookie."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a file from an external server-side application (Priority: P1)

An external application, running its own backend with no access to the owner's browser session, needs to fetch the contents of a file stored in this system. It authenticates the request using a Personal Access Token issued by the owner, instead of a session cookie.

**Why this priority**: This is the minimum capability needed to unblock any external integration — without read access, no external app can be built at all.

**Independent Test**: Can be fully tested by sending a request to the file API with a valid Personal Access Token in the `Authorization: Bearer` header and no session cookie, and confirming the file content is returned.

**Acceptance Scenarios**:

1. **Given** a valid, unrevoked Personal Access Token and no owner session cookie, **When** an external application requests a file's contents via the API, **Then** the file contents are returned as if an owner session were present.
2. **Given** a valid, unexpired OAuth access token and no owner session cookie, **When** an external application requests a file's contents via the API, **Then** the file contents are returned.

---

### User Story 2 - Write/update a file from an external server-side application (Priority: P2)

The same external application also needs to save edits back to a file (e.g., an updated CSV) using the same token-based authentication.

**Why this priority**: Read-only access alone does not satisfy the goal of building an external editor; write access is required to deliver the full integration, but it depends on read access (P1) already working.

**Independent Test**: Can be fully tested by sending a create/update/delete request to the file API with a valid Personal Access Token and no session cookie, and confirming the change is persisted.

**Acceptance Scenarios**:

1. **Given** a valid, unrevoked Personal Access Token and no owner session cookie, **When** an external application submits updated file content via the API, **Then** the system persists the change and responds with success, identically to how it would for an authenticated browser session.
2. **Given** a Personal Access Token that was subsequently revoked, **When** an external application attempts to update a file using that token, **Then** the request is rejected as unauthorized and no change is persisted.

---

### User Story 3 - Existing browser-based access keeps working unchanged (Priority: P3)

The owner continues to use the existing web editor in their browser, authenticated via their normal signed-in session, with no change in behavior.

**Why this priority**: This is a regression-prevention story rather than new capability — it must not break, but it is not the new value being delivered by this feature.

**Independent Test**: Can be fully tested by exercising the existing browser-based editor flows (view, create, update, delete files) with only a session cookie present (no bearer token) and confirming behavior is identical to before this feature.

**Acceptance Scenarios**:

1. **Given** a valid owner session cookie and no `Authorization` header, **When** the owner uses the web editor, **Then** all file operations succeed exactly as they did before this feature was introduced.

---

### Edge Cases

- What happens when a request has neither a valid session cookie nor a bearer token? System rejects it as unauthorized, same as current behavior.
- What happens when the bearer token is malformed, expired, or revoked, and there is no session cookie? System rejects the request as unauthorized.
- What happens when a request carries both a valid session cookie and an `Authorization` header? The request is treated as authenticated (session cookie takes effect; the specific precedence is an implementation detail, not user-observable behavior in the valid-value case).
- What happens when a bearer token is valid but of the wrong kind (e.g., a token type not recognized by either verification path)? System rejects the request as unauthorized.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow requests to the file API to authenticate via an `Authorization: Bearer <token>` header when no owner session cookie is present.
- **FR-002**: The system MUST accept both Personal Access Tokens and OAuth access tokens through this header, using the same validity rules (unexpired, unrevoked) already enforced for these token types elsewhere in the system.
- **FR-003**: The system MUST continue to accept the existing owner session cookie exactly as it does today, with no behavior change for browser-based requests that carry no bearer token.
- **FR-004**: The system MUST reject requests that present neither a valid session cookie nor a valid bearer token with an unauthorized response, consistent with current behavior.
- **FR-005**: The system MUST reject requests presenting an invalid, expired, or revoked bearer token (and no valid session cookie) with an unauthorized response.
- **FR-006**: This authentication fallback MUST apply uniformly to every REST API route that currently relies on the shared owner-session check (including, at minimum, the file read/create/update/delete API), so that a single change extends coverage consistently rather than requiring per-route updates.
- **FR-007**: The system MUST NOT require any new token-issuance or token-management UI — tokens continue to be created and revoked through the existing Personal Access Token management screen.
- **FR-008**: Successful token-authenticated requests MUST result in the exact same data operations (same file read/write behavior, same validation, same limits) as session-authenticated requests — no reduced or expanded capability based on the authentication method used.

### Key Entities

- **Personal Access Token**: An existing long-lived credential the owner can generate and revoke, now also usable to authenticate REST API file requests, not only the existing tool-calling endpoint.
- **OAuth Access Token**: An existing short-lived credential issued through the system's authorization flow, now also usable to authenticate REST API file requests.
- **Owner Session Cookie**: The existing browser-based credential; unaffected by this feature except that it is now one of two accepted authentication methods on these routes instead of the only one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An external, server-side application can read a file's contents through the API using only a Personal Access Token, with no browser session involved, on the first attempt.
- **SC-002**: An external, server-side application can create, update, or delete a file's contents through the API using only a Personal Access Token, with no browser session involved, on the first attempt.
- **SC-003**: 100% of existing browser-based (session-cookie) file operations continue to succeed with no observable change in behavior after this feature ships.
- **SC-004**: 100% of requests with a missing, invalid, expired, or revoked token and no valid session are rejected as unauthorized.

## Assumptions

- Personal Access Token creation, listing, and revocation already exist (see spec 013) and are out of scope for this feature — this feature only extends where existing tokens can be used.
- Token-authenticated requests are expected to originate from another server (server-to-server), not directly from a browser; cross-origin browser access (CORS) is out of scope.
- The permission model remains all-or-nothing "owner" access, matching the existing Personal Access Token scope — this feature does not introduce per-file or per-operation scoping.
- Transport security (HTTPS) is already provided by the deployment environment; no new transport-security work is required.
- "The file API" refers to the existing REST endpoint(s) that read and write individual files (starting with `/api/file`); any other `/api/*` route sharing the same owner-session guard is covered as a natural consequence of FR-006, not as separately scoped work.
