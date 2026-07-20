# Phase 1 Data Model: Require Owner Login for the File Editor Page

This feature introduces **no new persisted entities**. It only adds authorization checks in front of existing routes and reuses the `OwnerSession` entity already defined and persisted by spec 008.

## Reused Entity (unchanged)

### OwnerSession (spec 008, `frontend/lib/oauth/session.ts`)

| Field | Type | Notes |
|---|---|---|
| `sessionId` | string | Opaque, random (32 bytes hex) |
| `createdAt` | ISO timestamp | Set at sign-in |
| `expiresAt` | ISO timestamp | `createdAt` + 12h TTL |

Stored at `.oauth/owner-sessions/{sessionId}` in the existing S3-compatible bucket; looked up via the `oauth_owner_session` httpOnly cookie (path `/`, so it is already sent on every request to the app, including `/editor` and `/api/*`).

**Relevant behavior for this feature**: `hasActiveOwnerSession()` returns `true` only while `expiresAt` is in the future — this is the single source of truth this feature's new `requireOwnerSession()` guard (research.md §2) delegates to. No new field, validation rule, or state transition is added to this entity.

## No Key Entities section in spec.md

The feature spec's Key Entities section was omitted because no new domain data is introduced — see spec.md's Assumptions ("no new account, credential, or user roles are introduced").
