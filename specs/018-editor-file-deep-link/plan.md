# Implementation Plan: Editor File Deep Linking via URL

**Branch**: `018-editor-file-deep-link` | **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-editor-file-deep-link/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Make the file editor's currently-open file addressable through the page URL instead of only through in-memory React state — and make the file's path part of the URL's *path* itself (`/files/notes/todo.md`), not a query parameter, per explicit decision (FR-012). This requires renaming the editor's route from `/editor` to `/files` and converting it to an optional catch-all dynamic segment (`app/files/[[...path]]/page.tsx`), so the URL *is* the file's address rather than a page with a hidden lookup value. `EditorApp.tsx` derives the open file from `usePathname()` (stripping the `/files/` prefix) instead of local state, making the URL the single source of truth: opening `/files/notes/todo.md` loads that file directly, selecting a different file in the tree updates the URL via `router.push` (enabling back/forward), and the existing owner-login redirect (spec 009) is extended to preserve the requested file across sign-in. `FileTree.tsx` gains the ability to auto-expand the ancestor folders of a deep-linked path so the file is visible once loaded. A redirect from the old `/editor` (and any subpath) to `/files` preserves existing bookmarks/links (FR-013). No new API routes, storage model, or authorization mechanism is introduced — file paths already are the storage key (spec 001) and already flow through `/api/file?path=...` (spec 003); this feature only exposes that same `path` externally, one layer up, as the page's own URL.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router), React 19, Node.js (unchanged from specs 003/009)

**Primary Dependencies**: `next/navigation` (`useRouter`, `usePathname`) — already part of the existing `next` dependency, no new package. No new runtime dependency.

**Storage**: No change — files continue to be addressed by the same `path` string used as the S3 object key (spec 001/002). This feature adds no new persisted data; the URL's path segments simply carry the same `path` value already used by `/api/file`, `/api/tree`, etc.

**Testing**: No automated test suite exists in this project (specs 001–009 all validate via a runnable `quickstart.md` walkthrough instead) — this feature follows the same convention; see [quickstart.md](quickstart.md)

**Target Platform**: Node.js server; runs locally (`npm run dev`) and deploys to Vercel — same as the existing editor route and its API routes; no runtime change

**Project Type**: Web application — single Next.js project (`frontend/`); the editor's route moves from `app/editor/` to `app/files/[[...path]]/`; no new project/service

**Performance Goals**: N/A — this only adds URL parsing/serialization and, for deep links into nested folders, the same lazy `GET /api/tree` calls that already happen when a user manually expands those folders one by one; no new network cost at steady state

**Constraints**: Must preserve the owner-login gate from spec 009 (FR-006) — a deep link opened while signed out must round-trip through `/oauth/login` and land back on the *same* file, not just the bare `/files` page. Must not introduce a new path-validation mechanism: the existing `/api/file` GET already rejects unreadable/nonexistent/wrong-type paths (`not_found`, `type_mismatch` — spec 003/`lib/storage/files.ts`), and `normalizeFilePath` treats the path as an opaque S3 object key (S3 keys have no directory-traversal semantics, unlike a filesystem path), so no new sanitization logic is needed beyond what already guards every other caller of that route (FR-010). Must not break existing bookmarks/links to the previous `/editor` URL (FR-013).

**Scale/Scope**: Single owner, single page. Moves `app/editor/page.tsx` → `app/files/[[...path]]/page.tsx` (its sibling components — `EditorApp.tsx`, `FileTree.tsx`, `FileEditor.tsx`, `Header.tsx`, `Icons.tsx`, `CsvTableEditor.tsx`, `MarkdownEditor.tsx`, `PlainTextEditor.tsx` — move with it to `app/files/`, unrenamed); adds a redirect route at the old `app/editor/` location; updates every internal reference to the literal string `/editor` (the `/init` page's link, its dictionary text in all 6 languages, README).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still unfilled template placeholder content — no project principles have been ratified yet, so there are no gates to check against. Nothing to re-check post-design.

## Project Structure

### Documentation (this feature)

```text
specs/018-editor-file-deep-link/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── editor-url-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── files/                          # RENAMED from app/editor/ (git mv)
│   │   ├── layout.tsx                  # NEW: stable segment (not inside
│   │   │                                # [[...path]]) — does the session check and
│   │   │                                # `/oauth/login?continue=` redirect (FR-006,
│   │   │                                # using the `x-pathname` request header set
│   │   │                                # by middleware.ts, since this segment has no
│   │   │                                # params.path of its own), and renders
│   │   │                                # `<EditorApp>`. Must sit at this stable
│   │   │                                # position — not co-located with
│   │   │                                # `[[...path]]` — for EditorApp's client
│   │   │                                # state (notably FileTree's expand/collapse
│   │   │                                # state) to survive navigation between
│   │   │                                # different `/files/<path>` values
│   │   │                                # (research.md §7).
│   │   ├── [[...path]]/
│   │   │   └── page.tsx                # NEW: trivial, renders null — all real work
│   │   │                                # is in the parent layout.tsx above
│   │   ├── EditorApp.tsx               # CHANGED: open-file path derived from
│   │   │                                # usePathname() (stripping the `/files/`
│   │   │                                # prefix) instead of local state or
│   │   │                                # useSearchParams; handleSelectFile/
│   │   │                                # handleFileDeleted/handleFolderDeleted call
│   │   │                                # router.push/replace with `/files/<path>`
│   │   │                                # (FR-002, FR-004, FR-005)
│   │   ├── FileTree.tsx                # CHANGED: accepts an optional target path to
│   │   │                                # auto-expand ancestor folders down to it, so
│   │   │                                # a deep-linked file becomes visible (FR-003)
│   │   ├── FileEditor.tsx              # CHANGED: distinguishes the existing
│   │   │                                # `type_mismatch` error code to show a
│   │   │                                # folder-specific message (FR-008) instead of
│   │   │                                # the generic error text
│   │   ├── Header.tsx                  # UNCHANGED, moved as-is
│   │   ├── Icons.tsx                   # UNCHANGED, moved as-is
│   │   ├── CsvTableEditor.tsx           # UNCHANGED, moved as-is
│   │   ├── MarkdownEditor.tsx           # UNCHANGED, moved as-is
│   │   └── PlainTextEditor.tsx          # UNCHANGED, moved as-is
│   ├── editor/
│   │   └── [[...path]]/
│   │       └── page.tsx                # NEW: thin redirect-only route — every
│   │                                    # request to `/editor` or `/editor/<path>`
│   │                                    # redirects (308, permanent) to the
│   │                                    # equivalent `/files` URL (FR-013)
│   ├── init/McpConnectManual.tsx       # CHANGED: `<a href="/editor">` → `/files`
│   ├── oauth/login/page.tsx            # UNCHANGED — its `continue` redirect target
│   │                                    # handling is already generic (spec 008/009);
│   │                                    # reused as-is
│   └── api/file/route.ts               # UNCHANGED — GET already returns not_found /
│                                        # type_mismatch / unsupported (422), which
│                                        # this feature's UI now interprets more
│                                        # specifically
├── lib/
│   ├── editorFetch.ts                  # UNCHANGED — already redirects to
│   │                                    # `${pathname}${search}` generically; works
│   │                                    # as-is once `pathname` itself carries the
│   │                                    # file path
│   └── i18n/dictionaries/*.ts          # CHANGED (all 6 languages): `goToEditor`
│                                        # string updated from "/editor" to "/files"
├── middleware.ts                       # CHANGED: sets an `x-pathname` request
│                                        # header (`request.nextUrl.pathname`) on
│                                        # every request, so `app/files/layout.tsx`
│                                        # can read the current path via `headers()`
│                                        # despite sitting at a segment with no
│                                        # `params.path` of its own (research.md §7)
└── ../README.md                        # CHANGED: `/editor` references updated to
                                         # `/files` (repo root, outside frontend/)
```

**Structure Decision**: Single Next.js project at `frontend/` (unchanged from spec 006/009). This feature renames the existing route directory (`app/editor/` → `app/files/`), converts it to an optional catch-all segment, and leaves a small redirect-only route at the old location. No new API endpoint, and no change to the OAuth/session mechanism itself (spec 008/009's session logic, cookie, and `/oauth/login` page are reused unmodified).

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
