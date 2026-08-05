# Implementation Plan: Tools Status Page

**Branch**: `024-tools-status-page` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-tools-status-page/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add an owner-only page at `/tools` that lists all 17 MCP tools with their current active/disabled status, reflecting spec 023's `MCP_DISABLED_TOOLS` mechanism live on every request. Composed entirely from three already-established patterns rather than new subsystems: a new static tool catalog (`frontend/lib/mcp-tools/catalog.ts`) supplies the full list — necessary because a disabled tool is, by spec 023's design, never registered on the live server and so can't be discovered by introspecting it; the existing `isToolEnabled` (spec 023) supplies each tool's live status; and the existing owner-session gate (spec 009/021, as already used by `/settings/connected-apps`) protects the page.

## Technical Context

**Language/Version**: TypeScript, Next.js 16 (App Router), Node.js runtime — same as the rest of `frontend/`. No new language/runtime.

**Primary Dependencies**: None new. Reuses `lib/oauth/session` (`hasActiveOwnerSession`, spec 009/021), `lib/mcp-tools/toolGate` (`isToolEnabled`, spec 023), and `lib/i18n` (`resolveLanguage`/`getDictionary`, spec 015).

**Storage**: N/A — this page reads only `process.env` (via `isToolEnabled`) and the owner session cookie; no S3 bucket access.

**Testing**: No automated test framework exists in this repo (research.md §6) and none is introduced — verification is the manual `quickstart.md` walkthrough, consistent with every other feature here.

**Target Platform**: Same as the rest of the app — a Next.js page route, deployable to Vercel or run locally; no platform-specific behavior.

**Project Type**: Web application extension — one new page and one new data file inside the existing single Next.js app (`frontend/`).

**Performance Goals**: Negligible — a 17-row table rendered server-side per request; no pagination or client-side data fetching needed.

**Constraints**: The page must never be served from a static/build-time cache — status must reflect the current server configuration on every load (spec.md FR-005, SC-004). Satisfied by construction: reading the owner session cookie (required for the auth gate itself) already opts the route out of static generation, the same way every other owner-only page in this app already behaves (research.md §3) — no separate caching directive is needed or added.

**Scale/Scope**: One static catalog of 17 entries (research.md §1); one new page; one new section added to the `Dictionary` type and all 6 supported language files (spec 015).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no project-specific principles have been ratified) — there are no gates to evaluate against. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/024-tools-status-page/
├── plan.md                    # This file (/speckit-plan command output)
├── research.md                # Phase 0 output (/speckit-plan command)
├── data-model.md              # Phase 1 output (/speckit-plan command)
├── quickstart.md              # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── tools-page.md          # Phase 1 output (/speckit-plan command)
└── tasks.md                   # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This repo has no separate backend/frontend split — everything deployable lives in the single `frontend/` Next.js app (see repo root `README.md` and spec 006-frontend-folder-structure). This feature adds one new page and one new data file, and extends the existing i18n dictionaries:

```text
frontend/
├── lib/
│   ├── mcp-tools/
│   │   ├── catalog.ts          # NEW — TOOL_CATALOG: {name, group}[], all 17 tools (research.md §1)
│   │   └── toolGate.ts         # existing (spec 023) — isToolEnabled(name) reused unchanged
│   └── i18n/
│       └── dictionaries/
│           ├── types.ts        # existing — add a `tools` section to the Dictionary interface
│           ├── en.ts           # existing — add `tools` translations
│           ├── it.ts           # existing — add `tools` translations
│           ├── de.ts           # existing — add `tools` translations
│           ├── es.ts           # existing — add `tools` translations
│           ├── fr.ts           # existing — add `tools` translations
│           └── ru.ts           # existing — add `tools` translations
└── app/
    └── tools/
        └── page.tsx             # NEW — owner-gated Server Component (mirrors app/settings/connected-apps/page.tsx)
```

**Structure Decision**: Genuinely new code is one static catalog file and one page file; every other touched file is an existing i18n dictionary gaining one new section, in the exact shape `settings.connectedApps`/`settings.pat` already use (research.md §4). No existing route, layout, or component is modified — `app/settings/connected-apps/page.tsx` is read as a pattern to copy, not changed itself.

## Complexity Tracking

*No constitution gates apply (see Constitution Check above) — this section is not needed.*
