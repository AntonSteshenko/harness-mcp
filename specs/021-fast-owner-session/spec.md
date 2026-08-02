# Feature Specification: Fast Owner Session Validation

**Feature Branch**: `021-fast-owner-session`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Replace the owner-session check for the file editor and its APIs (currently a per-request S3 GetObjectCommand lookup) with a self-contained, signed session token that can be validated locally with no network/storage round trip. Use a short TTL. Add a 'sign out everywhere' mechanism: signing out rotates/invalidates the signing secret so that all previously issued session tokens are immediately invalidated on logout, without needing to track individual sessions. Motivation: every editor API request pays a full storage round trip just to validate the owner session before doing the real work, on top of the round trip for the actual file content — this is the main contributor to a reported 2-3s delay when opening a file. Removing session checks entirely was ruled out (the whole point of the existing login gate is keeping the file editor and its data private to the owner). This spec should keep the existing protection guarantees while eliminating the per-request storage lookup."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Files open without a session-check delay (Priority: P1)

As the owner, when I click a file or navigate the editor, I want the page and its data to load without the extra wait caused by checking whether I'm signed in, so that browsing feels fast.

**Why this priority**: This is the entire motivation for the feature — a per-request storage lookup just to confirm "is this person signed in" is currently the largest contributor to the delay users feel when opening a file, on top of the unavoidable time to fetch the actual file content.

**Independent Test**: Sign in, open several files and folders in a row, and confirm that the visible delay before content appears no longer includes a separate, noticeable wait attributable to a session check (only the time to fetch the requested data remains).

**Acceptance Scenarios**:

1. **Given** an active, valid owner session, **When** any editor page or file API request is made, **Then** the request is validated without a network or storage lookup dedicated to checking session validity.
2. **Given** an active, valid owner session, **When** the owner repeatedly opens different files, **Then** each open is only as slow as fetching that file's own content — no additional, separate session-check delay is added on top.

---

### User Story 2 - Signing out immediately invalidates every session (Priority: P1)

As the owner, when I sign out, I want to be certain that no previously issued session — on this device or any other browser/device I may have signed in from — can still be used to access my files, so that logging out is a real, immediate security boundary.

**Why this priority**: Moving session validation to something that doesn't require a storage lookup only makes sense if signing out still reliably and immediately cuts off access; otherwise the change would weaken the protection the login gate exists to provide.

**Independent Test**: Sign in (optionally from more than one browser/session), sign out from one of them, and confirm that every previously issued session — including ones from other browsers — is rejected immediately on its next use, without needing to wait for it to expire on its own.

**Acceptance Scenarios**:

1. **Given** one or more active owner sessions exist, **When** the owner signs out, **Then** all of those sessions stop being accepted immediately, starting with the very next request made using any of them.
2. **Given** the owner has signed out, **When** they sign back in, **Then** they receive a new, valid session and can use the editor normally again.

---

### User Story 3 - Sessions expire on their own after a short period (Priority: P2)

As the owner, I want my session to expire automatically after a bounded, short period, so that a session isn't valid indefinitely even if I never explicitly sign out.

**Why this priority**: This bounds the exposure window of a session that's never explicitly signed out of (e.g., an abandoned browser tab), complementing sign-out-everywhere with automatic expiry. It matters less than Stories 1 and 2 because those two cover the primary "must not regress" and "must be fast" requirements.

**Independent Test**: Sign in, leave the session unused for longer than the defined expiry window, and confirm that the next request is rejected and the owner is prompted to sign in again.

**Acceptance Scenarios**:

1. **Given** an owner session was issued more than the expiry window ago, **When** a request is made using it, **Then** the request is rejected and sign-in is required again.
2. **Given** the owner is actively using the editor before the session would otherwise expire, **When** they continue working, **Then** their session remains valid without an unexpected, disruptive sign-out in the middle of active use.

---

### Edge Cases

- What happens if a session credential is tampered with (modified expiry, modified identity, forged)? It MUST be rejected, the same as a missing or expired one.
- What happens to sessions that were already active at the moment this change is deployed? They are treated as no longer valid; the owner signs in once more to get a session under the new mechanism.
- What happens if the owner's device clock is significantly wrong? The session may appear expired earlier or later than intended; this is an accepted limitation rather than something the system compensates for.
- What happens if the owner signs out while a request using the old session is already in flight? That in-flight request may complete, but any request starting after sign-out completes MUST be rejected.
- What happens if the owner never signs out and never returns? The session simply expires on its own once the expiry window elapses, per User Story 3.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST validate the owner's session for every editor page load and every underlying file API request without performing a network or storage lookup dedicated solely to that check.
- **FR-002**: The system MUST continue to reject the editor page and all underlying file APIs (listing, read, write, upload, download) for any request that lacks a valid, unexpired owner session — preserving the existing protection guarantee.
- **FR-003**: A session credential MUST be tamper-evident: any modification to it MUST cause validation to fail.
- **FR-004**: The system MUST provide a "sign out everywhere" effect: signing out MUST cause every previously issued session credential — regardless of which device or browser it was issued to — to be rejected starting immediately after sign-out.
- **FR-005**: Achieving sign-out-everywhere MUST NOT depend on tracking or looking up individual sessions; it must work by invalidating a whole class of previously issued credentials at once.
- **FR-006**: Each session MUST automatically expire on its own after a bounded, short period of validity, independent of whether the owner explicitly signs out.
- **FR-007**: The system SHOULD keep an actively-working owner signed in without disruptive, unexpected sign-outs mid-session, as long as they remain active before the session's expiry.
- **FR-008**: Any session credential issued before this change takes effect MUST be treated as invalid, requiring the owner to sign in again once.

### Key Entities

- **Owner Session Credential**: A self-contained, tamper-evident proof of the owner's signed-in state carried by the browser. Encodes its own expiry and is valid only as long as it belongs to the currently active signing generation.
- **Signing Generation**: A version marker for "currently trusted" session credentials. Rotating it (on sign-out) instantly makes every credential issued under the previous generation invalid, without needing a record of which specific sessions existed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening a file in the editor shows content with no separately perceptible delay attributable to session validation — the only wait is the time to fetch the requested data itself.
- **SC-002**: Signing out on one device makes every other active session unusable on its very next request — verified with zero propagation delay, not "eventually."
- **SC-003**: An owner who stops using the editor is required to sign in again after no more than a short, bounded period of inactivity (see Assumptions for the default duration).
- **SC-004**: Zero unauthenticated or expired-session requests succeed against the editor page or any underlying file API — the same guarantee that existed before this change.

## Assumptions

- The editor has a single owner/credential (per existing login-gate design); "sign out everywhere" means invalidating all of that one owner's sessions at once, not per-user selective revocation across many distinct accounts.
- Default session expiry window: 12 hours from issuance, renewed automatically while the owner remains actively using the editor, so normal work sessions aren't interrupted; an idle session still expires within that window.
- Losing the ability to revoke one single specific session while leaving others valid (fine-grained, per-session revocation) is an acceptable trade-off in exchange for removing the per-request storage lookup, given there is one owner and the primary need is "kill everything now," not "kill just that one."
- A brief, one-time re-login is acceptable for any owner with a session active at the moment this change ships.
