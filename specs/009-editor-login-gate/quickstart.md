# Quickstart: Require Owner Login for the File Editor Page

**Input**: [spec.md](spec.md), [contracts/protected-routes.md](contracts/protected-routes.md), [data-model.md](data-model.md)

This guide validates the feature end-to-end against spec.md's acceptance scenarios. It assumes `app/editor/page.tsx` has been split per plan.md, the `requireOwnerSession()` guard has been added to the five `app/api/*` route files, and `lib/editorFetch.ts` is wired into `FileTree.tsx`/`FileEditor.tsx`, per tasks.md.

## Prerequisites

1. The storage backend is running and configured per spec 007 (`docker compose up -d` from the repo root; `frontend/.env.local` set up).
2. Dependencies installed: `npm install` from `frontend/`.
3. Owner credential env vars set per spec 008 (`OAUTH_OWNER_USERNAME`, `OAUTH_OWNER_PASSWORD`) — this feature reuses them, no new env vars.
4. `npm run dev` from `frontend/`, so the app is reachable at `http://localhost:3000`.
5. Have at least one file already in storage (any earlier spec's quickstart, or `docker compose exec` your storage tool of choice) so the editor has something to show once signed in.

## 1. Editor page requires sign-in (validates User Story 1, FR-001, FR-002, FR-003, SC-001, SC-002)

1. Open a private/incognito browser window (no existing cookies) and navigate to `http://localhost:3000/editor`.
   Expected: you're redirected to `/oauth/login?continue=%2Feditor` — no file tree, file names, or editor UI is ever visible.
2. Sign in with `OAUTH_OWNER_USERNAME` / `OAUTH_OWNER_PASSWORD`.
   Expected: you land back on `/editor`, and the file tree now loads normally.

## 2. Underlying file APIs reject unauthenticated requests (validates User Story 2, FR-004, FR-007, SC-001, SC-004)

While signed out (no `oauth_owner_session` cookie — use `curl` without `-b`, or an incognito window):

```sh
curl -i http://localhost:3000/api/tree?path=
curl -i http://localhost:3000/api/file?path=notes.md
curl -i -X POST http://localhost:3000/api/directory -d '{"path":"new-folder"}'
curl -i -X POST http://localhost:3000/api/upload -F file=@somefile.txt
curl -i http://localhost:3000/api/download-zip?path=
```

Expected: every call returns `401` with the `{ "code": "unauthorized", ... }` body from contracts/protected-routes.md, and no file/folder name or content appears in any response. Repeat with a valid session cookie (copy it from a signed-in browser session) and confirm each call now succeeds as before (spec 003–005 behavior unchanged).

## 3. Signed-in owner moves freely between protected pages (validates User Story 3, FR-005, SC-003)

1. Sign in via `/settings/connected-apps` (as in spec 008's quickstart).
2. Without signing out, navigate directly to `http://localhost:3000/editor`.
   Expected: the editor loads immediately, with no further sign-in prompt.
3. Reverse the order: sign in by first hitting `/editor` while signed out, then navigate to `/settings/connected-apps`.
   Expected: it loads immediately too — same session, either direction.

## 4. Session expiry mid-use (validates spec.md Edge Cases)

1. Sign in and open the editor with a file loaded.
2. Manually expire or delete the session (e.g. delete the `.oauth/owner-sessions/{sessionId}` record in storage, or wait out the 12h TTL in a test environment with a shortened TTL).
3. Trigger any editor action that calls an API (open another file, save, list a folder).
   Expected: the browser is redirected to `/oauth/login?continue=...`, not left on a broken or silently-failing screen.
