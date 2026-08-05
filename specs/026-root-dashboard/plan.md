# Implementation Plan: Root Dashboard Page

**Branch**: `026-root-dashboard` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-root-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

`/` currently has no `app/page.tsx`, so it 404s once storage is configured. Add a server-rendered dashboard at `frontend/app/page.tsx` that lists a link to every existing top-level page (Files, Tools, Settings › Connected Apps, Settings › Personal Access Tokens), following the same conventions already used by `app/tools/page.tsx` and the settings pages (inline styles, `resolveLanguage()` + `getDictionary()` for text, no new auth gate of its own — each link's destination continues to enforce its own existing session check). The link list is a small, centrally-maintained array co-located with the page rather than an automatically generated route scan, since Next.js App Router has no runtime API to enumerate pages.

## Technical Context

**Language/Version**: TypeScript 5.9.3, React 19.2.7

**Primary Dependencies**: Next.js 16.2.10 (App Router, Server Components); existing `lib/i18n` (`resolveLanguage`, `getDictionary`) and `lib/oauth/session` (`hasActiveOwnerSession`, used by linked pages, not by the dashboard itself)

**Storage**: N/A — the dashboard's link list is static data in code; no persisted state is read or written

**Testing**: No automated test suite is configured in this repository (no test runner in `frontend/package.json`); validation is manual via `quickstart.md`, consistent with existing features in this repo

**Target Platform**: Web — server-rendered page in the existing self-hosted Next.js frontend (harness-mcp)

**Project Type**: Web application — single Next.js app under `frontend/` (no separate backend project; API routes live inside the same app)

**Performance Goals**: None beyond standard page-load expectations for a static server-rendered link list (no data fetching beyond language resolution)

**Constraints**: Must reuse existing UI conventions (inline styles matching `app/tools/page.tsx` and `app/settings/*`) rather than introducing a new design system; must not duplicate or bypass each linked page's existing access control

**Scale/Scope**: One new page, four link entries (Files, Tools, Settings › Connected Apps, Settings › Personal Access Tokens), plus one new `dashboard` namespace across the six existing locale dictionaries (`en`, `it`, `es`, `fr`, `de`, `ru`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no principles have been ratified for this project). There are no project-specific gates to evaluate; this plan follows the repository's observed conventions instead (see Technical Context and research.md).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── page.tsx                       # NEW — dashboard at "/"
│   ├── tools/page.tsx                 # existing — link target, pattern reference
│   ├── settings/
│   │   ├── connected-apps/page.tsx    # existing — link target
│   │   └── personal-access-tokens/page.tsx  # existing — link target
│   ├── files/[[...path]]/page.tsx     # existing — link target (files + editor, spec 018)
│   └── editor/[[...path]]/page.tsx    # existing — legacy redirect to /files, NOT linked
└── lib/
    └── i18n/dictionaries/
        ├── types.ts                   # UPDATED — add `dashboard` namespace to Dictionary
        ├── en.ts / it.ts / es.ts / fr.ts / de.ts / ru.ts   # UPDATED — add `dashboard` strings
        └── index.ts                   # existing — no change
```

**Structure Decision**: Single Next.js App Router project (`frontend/`), matching every prior spec in this repo (001–025). No backend/frontend split and no new top-level directory are needed — this feature is one new page file plus dictionary additions in the existing `lib/i18n` module.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
No violations — the Constitution Check identified no gates to satisfy, and this feature adds a single page plus dictionary entries with no new project, service, or architectural pattern.
