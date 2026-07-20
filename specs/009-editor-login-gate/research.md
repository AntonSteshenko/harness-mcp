# Phase 0 Research: Require Owner Login for the File Editor Page

No `NEEDS CLARIFICATION` markers remain in the Technical Context — this feature is a small, additive extension of spec 008's existing owner-session mechanism, so research is limited to confirming the reuse approach against the current codebase rather than evaluating new technology choices.

## §1. How to gate a page that is currently a pure client component

**Decision**: Split `app/editor/page.tsx` into a server component (`page.tsx`) that performs the session check and `redirect()`, and a client component (`EditorApp.tsx`, the current body of `page.tsx` moved verbatim) that it renders as a child.

**Rationale**: This is the exact pattern spec 008 already established for `app/settings/connected-apps/page.tsx` (`const signedIn = await hasActiveOwnerSession(); if (!signedIn) redirect(...)`). Reusing it means no new authorization pattern enters the codebase, and it satisfies FR-007 (no file/folder data may render even transiently) because the redirect happens server-side before any client JS — including the components that fetch file data — ever mounts.

**Alternatives considered**:
- *Next.js middleware (`frontend/middleware.ts`)*: would centralize the check for both the page and API routes in one place, but spec 008 deliberately keeps `@aws-sdk/client-s3` and `crypto.scrypt`-dependent code on the Node runtime, and session lookup depends on an S3 read (`getRecord`) via `lib/oauth/store.ts` — middleware defaults to the Edge runtime, and forcing it to Node runtime is a project-wide config change out of proportion to this feature. Rejected in favor of the already-proven per-route/per-page check.
- *Client-side-only check (redirect from inside the "use client" component after mount)*: rejected outright — it cannot satisfy FR-007, since the client bundle and an initial render would ship before the redirect fires, and a user with JS disabled or a slow connection would briefly see the shell.

## §2. How to guard the five API route files without duplicating the check eight times

**Decision**: Add one new helper, `requireOwnerSession(): Promise<NextResponse | null>`, to `frontend/lib/oauth/session.ts`. It calls the existing `hasActiveOwnerSession()` and returns a `401` `NextResponse` (`{ code: "unauthorized", message: "Sign in required" }`) when there is no active session, or `null` when the caller may proceed. Each of the 8 handlers across `tree`, `directory`, `file`, `upload`, and `download-zip` starts with:

```ts
const authError = await requireOwnerSession();
if (authError) return authError;
```

**Rationale**: Matches the existing `errorResponse`/`STATUS_BY_CODE` convention already present in these same route files (see `app/api/file/route.ts`), so the guard reads as one more early-return check alongside the existing validation, not a new abstraction layer. A single shared helper avoids restating the cookie/session-lookup logic 8 times, which the project's own conventions (e.g. `errorResponse` being shared within a file) already favor over inline duplication.

**Alternatives considered**:
- *A wrapping higher-order function (`withAuth(handler)`)*: rejected as unnecessary ceremony for 8 call sites in a project with no existing HOF route-wrapping convention — a two-line guard at the top of each handler is simpler and matches the file's existing style more closely than introducing a new wrapping pattern.

## §3. What happens client-side when a session expires mid-use

**Decision**: Add a small client helper, `frontend/lib/editorFetch.ts`, that wraps `fetch()` for the editor's ~9 call sites (`FileTree.tsx`, `FileEditor.tsx`). On a `401` response it redirects the browser via `window.location.href = "/oauth/login?continue=" + encodeURIComponent(window.location.pathname)` instead of returning the response to the caller.

**Rationale**: Directly answers the spec's edge case ("session expires while editor is open mid-edit") — the next API call surfaces the expiry as a real navigation to sign-in rather than a swallowed error or a broken UI state. Centralizing it in one helper avoids duplicating the same `if (res.status === 401)` branch across 9 existing `fetch()` call sites.

**Alternatives considered**:
- *Per-call-site handling*: rejected — 9 duplicated branches for the same behavior is worse than one 6-line helper, and this project's existing files (e.g. shared `errorResponse` in `file/route.ts`) already favor small shared helpers over repetition within a feature area.
- *A global fetch interceptor / service worker*: rejected as disproportionate to a single-owner tool with no other cross-cutting fetch concerns today.

## §4. Reuse of the existing sign-in screen's `continue` redirect target

**Decision**: No change needed to `app/oauth/login/page.tsx` or `app/oauth/login/submit/route.ts`. Both already read an arbitrary `continue` query/form param and redirect back to it after a successful sign-in (default falls back to `/settings/connected-apps` today, unchanged for that entry point). The editor's server-component redirect (§1) simply sets `continue` to `/editor`, satisfying FR-002. Note the editor page has no URL-based deep-linking today — which file is open is local React state (`app/editor/page.tsx`'s `selectedPath`), never reflected in the URL — so there is no per-file location to preserve across the redirect, only the page itself.

**Rationale**: The mechanism is already generic — it was not hardcoded to the settings page — so no modification is required here, only a new caller.
