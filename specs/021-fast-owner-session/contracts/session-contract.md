# Contract: Owner Session Validation & Sign-Out

## `requireOwnerSession()` / `hasActiveOwnerSession()` — external behavior unchanged

Every existing call site (the editor page's server-side redirect, and the file APIs: `/api/file`, `/api/tree`, `/api/directory`, upload, download-zip — spec 009) keeps calling these same two functions with the same signatures and the same externally-observable results:

- No active/valid session → editor page redirects to sign-in; API routes return `401 { code: "unauthorized", message: "Sign in required" }`, exactly as today.
- Active, valid session → page renders / API proceeds, exactly as today.

**What changes is only internal**: validation no longer performs a `GetObjectCommand` against the session's own record on every call. Callers do not need any code changes.

## `POST /oauth/logout` — new endpoint

**Purpose**: owner-initiated sign-out that invalidates every previously issued session everywhere (User Story 2).

**Auth**: requires an active owner session (same gate as other owner-only routes) — signing out when not signed in is a no-op redirect to the sign-in page, not an error.

**Request**: `POST /oauth/logout` (no body required). Triggered by a form submit / button on `app/settings/connected-apps/page.tsx`, the same page pattern as the existing `[grantId]/revoke` action.

**Behavior**:
1. Increment `generation` in the session-generation record (`.oauth/session-generation.json`), leaving `secret` unchanged.
2. Clear the `oauth_owner_session` cookie on the response.
3. Redirect (`303`) to `/oauth/login`.

**Success response**: `303` redirect to `/oauth/login`, `Set-Cookie` clearing `oauth_owner_session`.

**Effect on other sessions**: any other browser/device holding a cookie with the pre-increment `generation` is rejected on its next request once the verifying instance's in-memory generation cache reflects the bump — immediately for any instance that fetches fresh, and within the cache TTL (30s, see research.md §3) for instances that were already warm with the old value cached.

**Not provided**: no way to revoke one specific session while leaving others valid — sign-out is all-or-nothing for the one owner account (spec Assumption).

## Cookie format (internal detail, documented for anyone implementing/debugging)

`oauth_owner_session` cookie value: `` `${base64url(JSON.stringify(payload))}.${signatureHex}` ``, where `payload` is `OwnerSessionPayload` (data-model.md) and `signatureHex` is `HMAC-SHA256(base64url(payload), currentSecret)` in hex. Same cookie attributes as today (`httpOnly`, `secure` in production, `sameSite: "lax"`, `path: "/"`), `expires` set to the payload's `expiresAt`.

A cookie that fails to parse (wrong format, e.g. a pre-migration opaque session ID), fails signature verification, has a `generation` that doesn't match the current record, or has passed its `expiresAt` is treated identically: as if no cookie were present at all.
