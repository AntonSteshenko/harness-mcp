# Implementation Plan: Live File Sync in the Files Interface

**Branch**: `019-live-file-sync` | **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-live-file-sync/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Make the files interface (`frontend/app/files/*`) reflect external changes (from an MCP agent, or another tab/session) without a manual page reload, while keeping the UI fluid and never destroying unsaved edits. Replace the hand-rolled `useEffect`/`useState` fetch logic in `FileTree.tsx`'s `DirectoryNode` and `FileEditor.tsx` with [SWR](https://swr.vercel.app/) (`stale-while-revalidate`), configured with a background `refreshInterval` that SWR already pauses while the tab is hidden and resumes on focus — this gives User Stories 1 and 3 (background tree refresh, instant cached re-visits) largely as SWR's default behavior, on top of the existing React `key`-based list rendering that already limits re-renders to changed rows. For User Story 2 (the open file), full content is *not* polled on a timer (FR-010): a new lightweight `HEAD /api/file?path=...` endpoint exposes just the S3 object's `ETag`/`Last-Modified` via a `getFileMetadata()` addition to `lib/storage/files.ts` (reusing the existing `HeadObjectCommand` pattern from `lib/storage/paths.ts`), polled on its own small SWR hook; only when the polled `ETag` diverges from the one recorded at load time does the client either silently refetch content (no unsaved edits) or surface a non-blocking conflict banner offering "reload external version" / "keep mine" (unsaved edits present) — full content is fetched only on that transition, not on every poll tick.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router), React 19 (unchanged from specs 003/009/018)

**Primary Dependencies**: New dependency — `swr` (latest stable, currently 2.x), added to `frontend/package.json`. No other new runtime dependency; reuses `@aws-sdk/client-s3`'s existing `HeadObjectCommand` (already used in `lib/storage/paths.ts`'s `headObjectExists`) for the new lightweight metadata check.

**Storage**: No change to what's stored — files remain S3 objects keyed by path (spec 001/002). This feature only reads additional *metadata* (`ETag`, `LastModified`) that S3 already returns on every `HeadObjectCommand`/`GetObjectCommand` call; nothing new is persisted.

**Testing**: No automated test suite exists in this project (specs 001–018 all validate via a runnable `quickstart.md` walkthrough instead) — this feature follows the same convention; see [quickstart.md](quickstart.md). Manual validation additionally requires simulating an "external change" (e.g. editing the same file via the MCP tools or a second browser tab) while the UI is open, which `quickstart.md` documents step by step.

**Target Platform**: Node.js server (Next.js route handlers); runs locally (`npm run dev`) and deploys to Vercel — unchanged from prior specs; no runtime change

**Project Type**: Web application — single Next.js project (`frontend/`); no new project/service. Purely additive changes inside `app/files/*`, `app/api/file/route.ts`, and `lib/storage/files.ts`.

**Performance Goals**: Background tree/file-metadata polling MUST surface an external change within the SC-001 target of 30 seconds; poll interval is set to 15s (with SWR's built-in request deduping) to leave margin under that target even accounting for jitter. Polling MUST generate no requests while the tab is hidden (FR-006/SC-004) — this is SWR's documented default (`refreshWhenHidden: false`), not custom code.

**Constraints**: MUST NOT re-fetch full file content on every metadata poll tick (FR-010) — the metadata poll (`HEAD /api/file`) and the content fetch (`GET /api/file`) are two separate SWR keys/hooks, and the content key is only revalidated when the metadata poll detects an actual `ETag` change. MUST NOT silently discard unsaved edits (FR-005) — the existing `dirty` check in `FileEditor.tsx` (`currentContent !== loadedContent`) gates whether an external-change notification is silent (not dirty) or requires explicit user choice (dirty). MUST preserve the existing explicit-refresh-after-own-action behavior (FR-009, e.g. after upload/create/delete in `DirectoryNode`) — these become `mutate()` calls on the relevant SWR key instead of the current manual `refreshEntries()`/`setEntries()` calls, which is a strict improvement (an SWR `mutate()` also resets/skips the pending interval-timer tick, so an explicit refresh is never immediately followed by a redundant poll).

**Scale/Scope**: Single owner, single page (`app/files/*`), same scope as specs 003/009/018. Touches `FileTree.tsx` (`DirectoryNode`'s data-fetching internals), `FileEditor.tsx` (data-fetching internals plus new conflict-banner UI), `app/api/file/route.ts` (new `HEAD` handler, `GET` response gains an `etag` field), `lib/storage/files.ts` (new `getFileMetadata()`, `readFile()`/`updateFile()`/`createFile()` gain `etag` in their returned metadata), and a new `SWRConfig` provider wrapping the files app (in `app/files/layout.tsx`). No change to routing, auth, or the tree/file JSON contracts' existing fields (only additive fields).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still unfilled template placeholder content — no project principles have been ratified yet, so there are no gates to check against. Nothing to re-check post-design.

## Project Structure

### Documentation (this feature)

```text
specs/019-live-file-sync/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── file-sync-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── package.json                        # CHANGED: add `swr` dependency
├── app/
│   ├── files/
│   │   ├── layout.tsx                  # CHANGED: wraps children in <SWRConfig
│   │   │                                # value={{ refreshInterval: 15000,
│   │   │                                # revalidateOnFocus: true }}> so every
│   │   │                                # SWR hook in the files app shares one
│   │   │                                # polling/caching config (research.md §1)
│   │   ├── FileTree.tsx                 # CHANGED: DirectoryNode's manual
│   │   │                                # useEffect+useState(entries) fetch
│   │   │                                # replaced by useSWR(expanded ?
│   │   │                                # `/api/tree?path=...` : null, fetcher).
│   │   │                                # refreshEntries() calls become
│   │   │                                # mutate() (FR-001, FR-003, FR-007, FR-009)
│   │   ├── FileEditor.tsx               # CHANGED: content fetch becomes
│   │   │                                # useSWR(`/api/file?path=...`); adds a
│   │   │                                # second, small useSWR poll of
│   │   │                                # `HEAD /api/file?path=...` for the
│   │   │                                # open file's current ETag; a
│   │   │                                # useEffect compares it against
│   │   │                                # session.loadedEtag and either
│   │   │                                # silently mutate()s content (not
│   │   │                                # dirty) or sets a conflict-banner
│   │   │                                # state (dirty) (FR-002, FR-004,
│   │   │                                # FR-005, FR-010)
│   │   └── ExternalChangeBanner.tsx     # NEW: small presentational component
│   │                                    # for the non-blocking conflict notice
│   │                                    # ("file changed externally — Reload /
│   │                                    # Keep mine"), rendered by FileEditor
│   ├── api/
│   │   ├── file/route.ts                # CHANGED: GET response gains an
│   │   │                                # `etag` field; new `HEAD` handler
│   │   │                                # returns 200 with `ETag`/
│   │   │                                # `Last-Modified` response headers and
│   │   │                                # no body, or the existing
│   │   │                                # not_found/type_mismatch status codes
│   │   │                                # with no body (FR-002, FR-010)
│   │   └── tree/route.ts                # UNCHANGED — already returns
│   │                                    # per-file `lastModified`; no schema
│   │                                    # change needed for tree diffing
├── lib/
│   ├── storage/
│   │   └── files.ts                     # CHANGED: `FileMetadata` gains
│   │                                    # `etag: string`; `readFile()`,
│   │                                    # `createFile()`, `updateFile()`
│   │                                    # populate it from S3's `ETag`; new
│   │                                    # `getFileMetadata(path)` using
│   │                                    # `HeadObjectCommand` (mirrors
│   │                                    # `headObjectExists` in paths.ts) for
│   │                                    # the HEAD route to call
│   └── editorFetch.ts                   # UNCHANGED — SWR hooks call
│                                        # `authedFetch` as their fetcher, so
│                                        # the existing 401→/oauth/login
│                                        # redirect keeps working unmodified
```

**Structure Decision**: Single Next.js project at `frontend/` (unchanged from spec 006/009/018). No new route segments, no new page. Additive changes to two existing components, one new small presentational component, one new HTTP verb on an existing route, and one non-breaking field addition to an existing storage-layer type.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
