# Quickstart: Editor File Deep Linking via URL

**Input**: [spec.md](spec.md), [contracts/editor-url-contract.md](contracts/editor-url-contract.md), [data-model.md](data-model.md)

This guide validates the feature end-to-end against spec.md's acceptance scenarios. It assumes the editor route lives at `app/files/[[...path]]/page.tsx` (moved from `app/editor/`), `EditorApp.tsx` derives the open file from `usePathname()` (plan.md), `FileTree.tsx` auto-expands ancestor folders of a deep-linked path, `FileEditor.tsx` distinguishes the `type_mismatch` error, the login redirect preserves the requested file's path segments, and a redirect-only route exists at the old `app/editor/` location, per tasks.md.

## Prerequisites

1. The storage backend is running and configured per spec 007 (`docker compose up -d` from the repo root; `frontend/.env.local` set up).
2. Dependencies installed: `npm install` from `frontend/`.
3. Owner credential env vars set per spec 008/009 (`OAUTH_OWNER_USERNAME`, `OAUTH_OWNER_PASSWORD`).
4. `npm run dev` from `frontend/`, so the app is reachable at `http://localhost:3000`.
5. Have at least one file already in storage at a nested path (e.g. create `docs/notes/todo.md` via the editor itself, or any earlier spec's upload flow), plus one empty folder, so both file and folder deep links can be tested.

## 1. Open a file directly via a shared link (validates User Story 1, FR-001, FR-002, FR-003, FR-012, SC-001, SC-002)

1. While signed in, navigate to `http://localhost:3000/files/docs/notes/todo.md`.
   Expected: the editor loads with `docs/notes/todo.md`'s content already displayed — no clicking through the tree required — and the `docs` and `docs/notes` folders are expanded in the sidebar so the file is visible there too. Note the path is the URL's own path, not a `?path=` query string.
2. Open the same URL in a second, fresh tab.
   Expected: the second tab also loads that file directly, independent of the first tab's state.

## 2. URL stays in sync while browsing files and folders (validates User Story 2, FR-004, FR-005, SC-004)

1. From the editor (no file open, i.e. `http://localhost:3000/files`), click one file, then a second, different file in the tree.
   Expected: the address bar updates to `/files/<file>` after each click, with no full-page reload (network tab shows only the `GET /api/file` fetch, not a document navigation).
2. Click a folder in the tree (not a file).
   Expected: the address bar updates to `/files/<folder>` too, the same way clicking a file does.
3. Click the browser's back button a few times.
   Expected: steps back through each previously viewed file/folder in order; going back past the first one returns to no path open (`/files`) — the URL and displayed content stay in lockstep at each step.
4. With a file open, refresh the browser page (full reload).
   Expected: the same file reopens automatically.
5. Copy the current URL, paste it into a new tab.
   Expected: the new tab opens with the same file (or folder) loaded.

## 3. Graceful handling of invalid or inaccessible links (validates User Story 3, FR-007, FR-008, FR-009, SC-003)

1. Navigate to `http://localhost:3000/files/does/not/exist.md` (a path with nothing at it).
   Expected: a clear "file not found" message in the editor pane; the rest of the editor (tree, header) remains usable.
2. Navigate to `http://localhost:3000/files/docs` (a path that is a folder).
   Expected: a clear message that the path is a folder, and the `docs` folder is shown expanded in the tree — not a generic error.
3. Navigate to a URL pointing at a binary/unsupported file (e.g. upload a `.png` first via the tree, then link to it).
   Expected: same "can't be shown here" message as when opening that file by clicking it in the tree today (unchanged, spec 003 behavior).

## 4. Deep link survives the owner-login gate (validates FR-006, Edge Cases)

1. Sign out (or open a private/incognito window).
2. Navigate directly to `http://localhost:3000/files/docs/notes/todo.md`.
   Expected: redirected to `/oauth/login?continue=%2Ffiles%2Fdocs%2Fnotes%2Ftodo.md` (or equivalent encoding) — not just `continue=%2Ffiles`.
3. Sign in with `OAUTH_OWNER_USERNAME` / `OAUTH_OWNER_PASSWORD`.
   Expected: lands back on `/files/docs/notes/todo.md` already open — not a bare editor with no file selected.

## 5. Path traversal / malformed path safety (validates FR-010, Edge Cases)

```sh
curl -i -b "oauth_owner_session=<a valid session cookie value>" \
  "http://localhost:3000/files/../../etc/passwd"
```

Expected: same `not_found` handling as any other nonexistent path (S3 object keys have no directory-traversal semantics — the reconstructed key is just a literal, nonexistent string) — no unexpected file content, no server error. (Note: browsers/servers typically normalize `..` segments in an actual URL path before this even reaches the app; this check confirms there's no way to smuggle a literal `..` value through regardless.)

## 6. Old `/editor` bookmarks still work (validates FR-013)

1. Navigate to `http://localhost:3000/editor` (the old, pre-feature URL).
   Expected: redirected to `http://localhost:3000/files`.
2. Navigate to `http://localhost:3000/editor/docs/notes/todo.md`.
   Expected: redirected to `http://localhost:3000/files/docs/notes/todo.md`, with that file open.
