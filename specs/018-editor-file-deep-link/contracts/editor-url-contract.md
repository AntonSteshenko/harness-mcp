# Contract: Editor Page URL

This feature's external interface is the editor page's URL, not a new API endpoint — no request/response schema changes to any `/api/*` route are made. This document is the contract for that URL's behavior, and for the one existing endpoint (`/oauth/login`'s `continue` param) it depends on.

## `GET /files` and `GET /files/<path>`

| Aspect | Behavior |
|---|---|
| Route | `/files` — no file open (today's default behavior, unchanged). `/files/<path>` — the file path itself, as one or more URL path segments (e.g. `/files/notes/todo.md`, each segment individually URL-encoded per normal URL rules) — **not** a query parameter (FR-012). |
| Authenticated + a file exists at `<path>` | Page loads with that file's content displayed, its containing folder(s) expanded in the tree (FR-002, FR-003). |
| Authenticated + nothing exists at `<path>` | Page loads with the tree usable; the editor pane shows a "file not found" message (FR-007). Existing `GET /api/file` `code: "not_found"` response, surfaced via existing `FileEditor` error state. |
| Authenticated + `<path>` is a folder | Page loads with that folder expanded in the tree; the editor pane shows a "this is a folder" message rather than a generic error (FR-008). Existing `GET /api/file` `code: "type_mismatch"` response (currently already returned by the API, newly distinguished by the UI — research.md §5). |
| Authenticated + `<path>` is an unsupported file type (e.g. binary) | Unchanged from today: existing `422`/`unsupported` handling (FR-009). |
| Not authenticated | Redirects to `/oauth/login?continue=%2Ffiles%2F<path>` (the full `/files/<path>` URL, URL-encoded as the `continue` value) — FR-006. On successful sign-in, the existing `continue` redirect (spec 008/009, unchanged) lands the user back on `/files/<path>`. |
| Selecting a different file in the tree while the page is open | URL updates to `/files/<new path>` via client-side navigation (`router.push`), no full page reload (FR-004). Adds one browser history entry per file opened, enabling back/forward (FR-005). |
| File/folder containing the open file is deleted (existing spec 003/005 behavior) | URL is cleared back to `/files` (`router.replace`, no new history entry) alongside the existing "close the editor" behavior. |

## `GET /editor` and `GET /editor/<path>` (new: redirect-only, FR-013)

| Aspect | Behavior |
|---|---|
| Any request under the previous `/editor` route | Permanently redirects (HTTP 308) to the equivalent `/files` URL — `/editor` → `/files`, `/editor/<path>` → `/files/<path>` — preserving any query string. Exists solely so bookmarks/links saved before this feature keep working; carries no UI of its own. |

## `GET /oauth/login?continue=<value>` (existing, spec 008/009 — unchanged, reused)

No change to this route. It already accepts an arbitrary `continue` value and redirects there after a successful sign-in (`app/oauth/login/page.tsx`, `app/oauth/login/submit/route.ts`). This feature's only dependency on it is that `continue` may now be `/files/<path>` instead of `/editor`.

## Non-goals

- No new `/api/*` route or change to any existing route's request/response shape — `/api/file`, `/api/tree`, `/api/directory`, `/api/upload`, `/api/download-zip` all keep their existing `?path=` query-parameter convention unchanged; only the *page* URL changes shape.
- No change to how a file is *stored* or *validated* server-side — `path` continues to mean exactly what it already means in `lib/storage/files.ts`.
- Folder paths are represented in the tree/expansion state, not as a separately "openable" editor document — visiting `/files/<folder>` does not create a folder-editing view.
