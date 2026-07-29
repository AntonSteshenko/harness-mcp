# Phase 0 Research: Editor File Deep Linking via URL

No `NEEDS CLARIFICATION` markers remain in the Technical Context — this feature is an additive, UI-only extension of the existing editor and its already-established `path` addressing convention (specs 001, 003), so research is limited to confirming the approach against the current codebase rather than evaluating new technology choices.

## §1. How the file path should be carried in the URL

**Decision**: The file path is a dynamic route segment, not a query parameter: `/files/notes/todo.md`. The editor's route moves from the fixed `app/editor/page.tsx` to an optional catch-all, `app/files/[[...path]]/page.tsx`.

**Rationale**: Settled by explicit product decision (spec.md FR-012) — the path should read as a direct address to the file, not a page with a hidden lookup value. Next.js's optional catch-all (`[[...path]]`) matches both `/files` (no file open) and `/files/<any/nested/path>` with one route file; `params.path` arrives as an already-decoded array of segments, so `path.join("/")` reconstructs the exact file path with no manual query-string encoding/decoding — actually simpler than the query-parameter approach for nested paths, since each segment is decoded independently by Next.js's router rather than requiring one `encodeURIComponent`/`decodeURIComponent` pass over the whole path string.

**Alternatives considered** (superseded from an earlier draft of this research):
- *Query parameter (`/editor?path=notes/todo.md`)*: this was the original decision, on the reasoning that `path` is already the query-parameter convention used by `/api/file`, `/api/tree`, etc. Superseded — the product decision (FR-012) is that the file path must be the URL's own path, not a parameter of a fixed page, so that a link visibly reads as "the address of this file" rather than "the editor page, plus a lookup key." The internal `/api/*` routes are unaffected either way and keep using `?path=` (they're not page URLs a person reads or bookmarks).
- *Hash fragment (`/files#notes/todo.md`)*: still rejected for the same reason as before — hash fragments never reach the server, so the login-gate redirect (FR-006) couldn't reconstruct the target file server-side.

## §2. Renaming the route from `/editor` to `/files`

**Decision**: `git mv app/editor app/files`, then move `page.tsx` into a new `app/files/[[...path]]/` subfolder (the sibling components — `EditorApp.tsx`, `FileTree.tsx`, etc. — stay directly under `app/files/`, imported by the nested `page.tsx` via a relative path one level up). A new redirect-only route, `app/editor/[[...path]]/page.tsx`, permanently redirects any request under the old `/editor` path to the equivalent `/files` path (FR-013).

**Rationale**: The route name itself is part of the explicit decision (spec.md's clarified Assumptions), not just an internal refactor — `/files/notes/todo.md` is the desired shareable address. Every other internal reference to the literal string `/editor` (the `/init` page's "connect an assistant, then go to..." link in `app/init/McpConnectManual.tsx`, its dictionary string in all 6 language files, and the project README) is updated in lockstep so the app is internally consistent, not just the route itself. The old route can't simply disappear, though — anyone who bookmarked or was sent the old bare `/editor` link before this feature shipped would otherwise hit a 404; a redirect (chosen as an optional catch-all matching `/editor` and any subpath, so old deep-sub-paths — if any existed — also land somewhere sensible) keeps those working, satisfying FR-013 at negligible cost.

**Alternatives considered**:
- *No redirect, just let `/editor` 404*: rejected — cheap to avoid, and this is exactly the kind of link-rot a deep-linking feature should not introduce given its whole point is making links durable and shareable.
- *Keep `/editor` as the canonical route and only add `/files` as an alias*: rejected — would leave two canonical-looking URLs for the same content indefinitely, which contradicts FR-012's point that the URL should be *the* address of the file; better to have one true home and a redirect from the old one.

## §3. Making the URL the single source of truth for the open file

**Decision**: `EditorApp`'s open file is derived from `usePathname()`: `const selectedPath = pathname === "/files" ? null : pathname.slice("/files/".length)`. `handleSelectFile(path)` calls `router.push(`/files/${path.split("/").map(encodeURIComponent).join("/")}`)`; clearing (file/folder deleted while open) calls `router.replace("/files")`.

**Rationale**: `usePathname()` is reactive to all client-side navigation, including `popstate` from the browser's back/forward buttons, exactly like `useSearchParams()` was in the query-parameter design — so this preserves the same "URL is the only source of truth, no local state to drift out of sync" property (FR-004, FR-005), just reading the path segments instead of a query value. Each path segment is individually `encodeURIComponent`-escaped before being joined with `/` when constructing a new URL, so filenames with spaces, unicode, or other special characters remain valid URLs (`params.path` on the way in is already correctly decoded per-segment by Next.js's router, so no matching decode step is needed on read).

**Alternatives considered**:
- *Pass the resolved path down as a prop from the server-component `page.tsx`*: rejected — would only capture the path at initial render; subsequent client-side navigation (selecting another file, back/forward) wouldn't update it without also wiring a `usePathname()`-driven effect anyway, so it's strictly more code for no benefit over reading `usePathname()` directly.
- *`useSearchParams()`*, unlike `usePathname()`, requires wrapping the consuming component in a `<Suspense>` boundary per Next.js's static-rendering convention. Moving off it means this feature no longer needs that `<Suspense>` wrapper in `app/files/[[...path]]/page.tsx` at all — one less moving part than the query-parameter design.

## §4. Making a deep-linked file visible in the (lazily-loaded) file tree

**Decision**: `FileTree`/`DirectoryNode` accept an `expandToPath` prop, unchanged from the original design. Each `DirectoryNode` treats itself as `defaultExpanded` if `expandToPath` starts with its own `path + "/"` (or its own path is a prefix ancestor of it), in addition to the existing root-is-always-expanded rule, and passes `expandToPath` down unchanged to any child directories it renders. This reuses the existing lazy-fetch effect (`useEffect` keyed on `expanded`) unmodified.

**Rationale**: Unaffected by the query-parameter → path-segment change — `expandToPath` is just fed `selectedPath` regardless of where that value was read from. `FileTree` already lazily fetches each directory's children only once it is expanded; auto-expanding just the ancestor chain of the deep-linked path is the minimal change that makes the target file appear. As before, no row in `FileTree` shows a distinct "currently selected" highlight style today, so "reflected as selected" (FR-003) means the file must be *visible* (its containing folders expanded), not a new highlight style.

**Alternatives considered**: unchanged from the original research — see the superseded draft's §3 for the rejected "eagerly fetch the whole tree" and "add a selection highlight" alternatives, neither of which is affected by this section's URL-shape change.

## §5. Distinguishing "folder" and "unsupported file type" links from a generic error

**Decision**: Unchanged from the original design. `FileEditor`'s existing `LoadState` error branch, in the case where `GET /api/file` responds `404` with `code: "type_mismatch"` (already returned by `readFile()` in `lib/storage/files.ts` when the path is a directory), renders the folder-specific message from FR-008 instead of the generic `error` message. The existing `422`/`unsupported` branch already satisfies FR-009.

**Rationale**: Entirely independent of how the path arrives at `FileEditor` (query parameter or path segment) — `FileEditor` only ever receives a plain `path: string` prop either way.

## §6. Preserving the requested file across the owner-login redirect (spec 009)

**Decision**: `app/files/[[...path]]/page.tsx` becomes an async server component that accepts `params: Promise<{ path?: string[] }>` and builds the `continue` redirect target as `` `/files${path?.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}` `` (re-encoding the already-decoded segments) when no owner session is active.

**Rationale**: Spec 009's `continue` mechanism is already generic (`app/oauth/login/page.tsx` reads an arbitrary `continue` param and redirects back to it) — this feature only needs to build the right target string from the catch-all's `params.path` instead of a `searchParams.path` string, same mechanism as the original design's §5.

**Alternatives considered**: unchanged from the original design's §5 — storing the target in a cookie/session slot instead of the URL was already rejected as unnecessary.

## §7. Preserving `FileTree`'s expand/collapse state across navigation

**Decision**: `EditorApp` is rendered from `app/files/layout.tsx` — a stable segment, one level *above* the `[[...path]]` catch-all that `page.tsx` sits in — not from `page.tsx` itself, and not from a layout co-located with `[[...path]]` either. `page.tsx` is reduced to a trivial component that renders `null`. Since a layout at this stable position no longer receives `params.path`, `middleware.ts` now sets an `x-pathname` request header (`request.nextUrl.pathname`, via `NextResponse.next({ request: { headers } })`, Next's documented pattern for this) on every request, which the layout reads via `headers()` to build the login-redirect target (§6, FR-006).

**Rationale**: Discovered as a regression during manual testing — after implementing §1-§6, clicking through the tree caused every previously expanded folder to collapse back to its initial state on each click, because `FileTree`'s per-folder `expanded` state (plain `useState`, no persistence mechanism of its own) was being reset. The cause is a documented Next.js App Router behavior: a **Page** component positioned at a dynamic route segment is remounted by React on every navigation to a different value of that segment, while a **Layout** persists across such navigations — but only when the layout itself sits at a segment whose *own* value is stable across those navigations. A first fix attempt moved `EditorApp` into a `layout.tsx` still co-located inside `[[...path]]/` (same segment as `page.tsx`) — this did **not** fix the regression, because that layout is still tied to the exact segment whose matched value changes on every click, so it doesn't get the persistence guarantee either. Moving the layout one level up, to `app/files/layout.tsx` — a plain, non-dynamic segment — puts it at a genuinely stable position that Next.js does not remount as its dynamic child segment changes, which is what actually fixes the regression: `EditorApp`'s component identity, and everything inside it (`FileTree`'s expand/collapse state, `isDirty`, `sidebarOpen`), now survives navigation between different `/files/<path>` values, while `selectedPath` (derived from `usePathname()`, §3) still updates correctly on each click since that's a reactive hook, not initial state.

**Alternatives considered**:
- *Layout co-located with the `[[...path]]` catch-all segment*: tried first; rejected after manual testing showed it didn't fix the regression — see Rationale.
- *Lift `expanded` state out of `DirectoryNode` into some persistent store (e.g. a ref, or state in `EditorApp` keyed by folder path)*: would have worked around the symptom without the layout fix, but doesn't address the root cause (`EditorApp`'s own state — `isDirty`, `sidebarOpen` — was equally being wiped on every click, not just `FileTree`'s). The stable-layout fix addresses the actual mechanism.
- *Read the pathname via `useSearchParams`/route interception instead of a middleware header*: rejected — the pathname isn't a query parameter, and there's no route param available at this stable segment; a request header set by middleware is the documented, minimal-footprint way to make the current path available to a Server Component that isn't itself parameterized by it.
- *Add explicit React `key` props to prevent remounting*: not applicable — the remounting here is driven by Next.js's routing layer (Page/Layout segment-stability rules), not by a React `key` mismatch in application code; there is no `key` to fix.
