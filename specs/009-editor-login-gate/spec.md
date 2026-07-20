# Feature Specification: Require Owner Login for the File Editor Page

**Feature Branch**: `009-editor-login-gate`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "fare la pagina dipsonibile solo dopo login (stesso account per mcp)" (Make the page available only after login, using the same account as the MCP server)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor page requires sign-in (Priority: P1)

As the owner of the storage, I want the file editor page to be hidden behind a sign-in screen using my existing owner account, so that anyone who finds the page's URL cannot browse or read my files without my credentials.

**Why this priority**: This is the entire point of the feature — without it, the file editor remains publicly reachable and defeats the purpose of adding owner authentication elsewhere in the app.

**Independent Test**: While signed out, visit the editor page directly and confirm no files or folders are shown and the sign-in screen appears instead; after signing in with the owner credential, confirm the editor and its files load normally.

**Acceptance Scenarios**:

1. **Given** no active owner session, **When** the editor page is requested, **Then** the visitor is redirected to the existing owner sign-in screen instead of seeing any file content.
2. **Given** the visitor is on the sign-in screen after being redirected from the editor, **When** they enter the correct owner credential, **Then** they are returned to the editor page and can see and use it normally.
3. **Given** the visitor enters an incorrect credential, **When** they submit the sign-in form, **Then** they are not granted access and remain on the sign-in screen.

---

### User Story 2 - Underlying file APIs are also protected (Priority: P2)

As the owner, I want the editor's underlying file endpoints (listing folders, reading/writing files, uploading, downloading as zip) to reject requests when I'm not signed in, so that the page's protection can't be bypassed by calling those endpoints directly.

**Why this priority**: Gating only the page's initial view is not sufficient — anyone can call the underlying data endpoints directly. This closes that gap and is the security backbone the rest of the feature depends on.

**Independent Test**: While signed out, call each of the editor's file endpoints directly (list folder, read file, write file, upload, download zip) and confirm each is rejected with no file data returned; repeat while signed in and confirm each succeeds normally.

**Acceptance Scenarios**:

1. **Given** no active owner session, **When** a file-listing or file-content request is made directly, **Then** the request is rejected and no folder names, file names, or file content are returned.
2. **Given** an active, valid owner session, **When** the same requests are made, **Then** they succeed and return the expected data.

---

### User Story 3 - Signed-in owner moves freely between protected pages (Priority: P3)

As the owner, once I've signed in I want to move between the file editor and the other account-protected pages (e.g. connected-apps settings) without being asked to sign in again, since they all use the same account.

**Why this priority**: Improves day-to-day usability once the core protection (User Stories 1 and 2) is in place; the feature is already secure and usable without this, just less convenient.

**Independent Test**: Sign in from one protected page, then navigate directly to another protected page's URL and confirm it loads without a further sign-in prompt.

**Acceptance Scenarios**:

1. **Given** the owner has an active session established from any protected page, **When** they navigate to the editor page, **Then** it loads without prompting for sign-in again.
2. **Given** the owner's session has expired or was never established, **When** they navigate to any protected page, **Then** they are prompted to sign in.

---

### Edge Cases

- What happens if the owner's session expires while they are actively working in the editor (e.g. mid-edit)? The next action requiring the server (save, load a file, list a folder) must be rejected and the owner redirected to sign in, rather than silently failing or exposing stale data.
- What happens if a signed-out visitor's browser has a stale or tampered session cookie? It must be treated as unauthenticated, not granted access.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require an active owner session before rendering any file editor content (file tree, file contents, or editor UI).
- **FR-002**: System MUST redirect a signed-out visitor requesting the editor page to the existing owner sign-in screen, and after a successful sign-in return them to the editor page.
- **FR-003**: The sign-in screen and the underlying owner credential MUST be the same one already used to protect the MCP server's authorization flow and the connected-apps settings page — this feature MUST NOT introduce a new or separate account.
- **FR-004**: System MUST reject unauthenticated requests to the editor's file endpoints (directory listing, file read, file write/create/delete, upload, zip download) and MUST NOT return any file or folder data in that case.
- **FR-005**: An owner session established via sign-in from any protected page MUST be honored across all protected pages (editor and existing settings pages) without requiring the owner to sign in again, until that session expires.
- **FR-006**: System MUST apply the same session-expiry and repeated-failed-attempt lockout/rate-limiting behavior already in place for the owner sign-in screen, regardless of which protected page triggered the sign-in.
- **FR-007**: System MUST NOT expose file names, folder names, or file content to a signed-out visitor at any point, including during page load before a redirect completes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of attempts to view the editor page or fetch file/folder data while signed out are blocked, with zero file names, folder names, or file contents ever returned.
- **SC-002**: A signed-out owner who enters the correct credential reaches the editor in a single sign-in attempt, with no extra steps beyond the existing sign-in flow.
- **SC-003**: An owner who is already signed in from another protected page reaches the editor with zero additional sign-in prompts.
- **SC-004**: A security check of all editor-related endpoints confirms none can be reached successfully without an active owner session.

## Assumptions

- This feature reuses the existing owner account and sign-in mechanism introduced for the MCP server's authorization flow (see the MCP OAuth feature) — no new account, credential, or user roles are introduced.
- Only a single owner account exists; multi-user roles and permissions are out of scope.
- No sign-out/logout affordance is added by this feature, consistent with the current app, which does not yet offer one anywhere.
- Session duration, expiry, and failed-attempt lockout behavior are unchanged from the existing sign-in mechanism; this feature only extends where that mechanism is enforced.
- Endpoints required for the MCP protocol and OAuth discovery itself (already covered by the existing MCP authorization feature) are unaffected by this change; only the human-facing file editor page and its supporting file endpoints are newly protected.
