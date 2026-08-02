# Quickstart: Validating Fast Owner Session Validation

## Prerequisites

- Local dev server running against a configured storage backend (`npm run dev` in `frontend/`, per the project's existing setup — storage env vars from `.env.local`/`.env.alpi` already configured, see specs/014-os-init-page).
- Owner credentials configured (`OAUTH_OWNER_USERNAME` / `OAUTH_OWNER_PASSWORD`).
- Two browser contexts available (e.g. a normal window + an incognito/private window, or two different browsers) to simulate "two devices" for the sign-out-everywhere scenario.

## Scenario 1 — File open has no separate session-check delay (User Story 1)

1. Sign in as the owner at `/oauth/login`.
2. Open the files editor and click into several different files in a row that haven't been opened yet this session.
3. **Expected**: each open's delay is attributable only to fetching that file's content — no additional, separate pause before the request even starts being processed. (Contrast with the pre-change behavior, where every open first paid a full S3 round trip just to validate the session.)
4. Optional deeper check: inspect server logs / request timing for `/api/file` and confirm no `GetObjectCommand` against `owner-sessions/*` fires per request (only, at most, an occasional read of `session-generation.json` when a warm instance's cache is stale).

## Scenario 2 — Sign out invalidates every session immediately (User Story 2)

1. Sign in as the owner in **Browser A**.
2. Sign in as the owner in **Browser B** (same credentials).
3. Confirm both browsers can load the editor and its files normally.
4. In **Browser A**, use the "Sign out" control (`/settings/connected-apps`) to sign out.
5. In **Browser B**, without signing in again, refresh the editor page or trigger a file API call.
6. **Expected**: Browser B is now rejected (redirected to sign-in for the page; `401` for a direct API call) — it should not still be treated as signed in. If it briefly still succeeds, it must stop succeeding well within the documented cache-TTL bound (research.md §3: 30 seconds), not after the session's full remaining natural lifetime.
7. In **Browser A**, sign in again and confirm normal access resumes with a fresh session.

## Scenario 3 — Sessions expire on their own after a short period (User Story 3)

1. Sign in as the owner.
2. Either wait past the configured expiry window, or (faster) temporarily point the session TTL constant to a very short value (e.g. a few seconds) in a local, uncommitted change for testing purposes only, and revert afterward.
3. Attempt to use the editor after the window has elapsed without any activity in between.
4. **Expected**: the request is rejected and sign-in is required again — matching FR-006.
5. Separately, confirm that *continued activity* before expiry keeps the owner signed in without an unexpected mid-task sign-out (FR-007) — e.g. stay active across roughly half the TTL window and confirm the session is still valid afterward without having to sign in again.

## Scenario 4 — Existing (pre-change) sessions are treated as invalid after deploy

1. Before deploying this change, note that a valid session cookie exists (signed in, opaque `sessionId` value).
2. Deploy the change.
3. Reload the editor using the browser that still holds the old cookie.
4. **Expected**: treated as signed out (redirect to sign-in) — the old opaque cookie fails to parse/verify under the new scheme, per spec Assumption ("a brief, one-time re-login is acceptable").

## Scenario 5 — Protection guarantees from spec 009 are unchanged

1. While signed out, directly call each file API (`GET /api/file`, `GET /api/tree`, `GET /api/directory`, upload, download-zip) without a session cookie.
2. **Expected**: every one is rejected with `401 unauthorized` and no file data returned — identical to spec 009's existing guarantee, unaffected by this change.
