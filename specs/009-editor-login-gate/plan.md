# Implementation Plan: Require Owner Login for the File Editor Page

**Branch**: `009-editor-login-gate` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-editor-login-gate/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Gate the existing file editor page (`frontend/app/editor/page.tsx`) and its five supporting API route files (`app/api/tree`, `app/api/directory`, `app/api/file`, `app/api/upload`, `app/api/download-zip`) behind the owner session already introduced in spec 008 (`hasActiveOwnerSession`, `createOwnerSession`, the `/oauth/login` sign-in screen). No new account, credential, or session mechanism is introduced — the editor page adopts the exact server-component redirect pattern already used by `app/settings/connected-apps/page.tsx`, and each API handler adopts a new shared `requireOwnerSession()` guard so unauthenticated requests are rejected before any storage call runs.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router), Node.js 18+ (unchanged from spec 008)

**Primary Dependencies**: None new. Reuses `frontend/lib/oauth/session.ts` (`hasActiveOwnerSession`) from spec 008; no new runtime dependency.

**Storage**: No change — the owner session record already lives in the existing S3-compatible bucket under `.oauth/owner-sessions/*` (spec 008). This feature only adds read-only session checks; no new persisted data.

**Testing**: No automated test suite exists in this project (specs 001–008 all validate via a runnable `quickstart.md` walkthrough instead) — this feature follows the same convention; see [quickstart.md](quickstart.md)

**Target Platform**: Node.js server; runs locally (`npm run dev`) and deploys to Vercel — the editor page and its API routes already run on the Node runtime (they use the existing S3 storage client), so no runtime change is required

**Project Type**: Web application — single Next.js project (`frontend/`), extending its existing `app/editor` and `app/api/*` routes; no new project/service is introduced

**Performance Goals**: N/A — a single additional session lookup (already-cached S3 read pattern from spec 008) per protected request; not a scale-sensitive feature

**Constraints**: Must reuse the exact owner account/session already established in spec 008 per FR-003 — no parallel or divergent auth mechanism. Must not expose any file/folder data to an unauthenticated request even transiently (FR-007), which rules out client-side-only gating (the editor page currently renders as a pure client component with no server check).

**Scale/Scope**: Single owner; touches one page (5 subcomponents unchanged) and 5 API route files (8 HTTP handlers total: tree GET; directory POST/DELETE; file GET/PUT/POST/DELETE; upload POST; download-zip GET)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still unfilled template placeholder content — no project principles have been ratified yet, so there are no gates to check against. Nothing to re-check post-design.

## Project Structure

### Documentation (this feature)

```text
specs/009-editor-login-gate/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── protected-routes.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── editor/
│   │   ├── page.tsx                         # CHANGED: becomes an async server component that
│   │   │                                     # calls hasActiveOwnerSession() + redirect(), then
│   │   │                                     # renders the existing client UI (User Story 1)
│   │   ├── EditorApp.tsx                     # NEW: the current page.tsx client-component body,
│   │   │                                     # moved here unchanged so page.tsx can stay a server
│   │   │                                     # component (same split already used by settings/connected-apps)
│   │   ├── FileTree.tsx                      # CHANGED: fetch() call sites use the shared
│   │   │                                     # authedFetch helper (Edge Case: session expiry mid-use)
│   │   └── FileEditor.tsx                    # CHANGED: same authedFetch usage
│   ├── api/
│   │   ├── tree/route.ts                     # CHANGED: GET guarded by requireOwnerSession()
│   │   ├── directory/route.ts                 # CHANGED: POST + DELETE guarded
│   │   ├── file/route.ts                      # CHANGED: GET + PUT + POST + DELETE guarded
│   │   ├── upload/route.ts                    # CHANGED: POST guarded
│   │   └── download-zip/route.ts              # CHANGED: GET guarded
│   ├── oauth/                                 # existing (spec 008) — unchanged
│   └── settings/connected-apps/               # existing (spec 008) — unchanged; pattern reused
├── lib/
│   ├── oauth/
│   │   └── session.ts                         # CHANGED: add requireOwnerSession() helper
│   │                                          # (wraps hasActiveOwnerSession(), returns a 401
│   │                                          # NextResponse when absent) for API route reuse
│   └── editorFetch.ts                         # NEW: tiny client helper used by FileTree/FileEditor
│                                              # — on a 401 response, redirects the browser to
│                                              # /oauth/login?continue=<current path> (Edge Case)
```

**Structure Decision**: Single Next.js project at `frontend/` (unchanged from spec 006/008). This feature touches only the existing `app/editor` route tree and the five existing `app/api/*` file-data routes, plus one new small shared helper in `lib/oauth/session.ts` and one new client helper `lib/editorFetch.ts`. No new project, no new page outside `app/editor`, and no change to the OAuth/MCP authorization flow itself (spec 008's `app/oauth/*`, `app/mcp/*`, `.well-known/*` are untouched).

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
