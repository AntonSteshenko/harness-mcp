---

description: "Task list template for feature implementation"
---

# Tasks: Root Dashboard Page

**Input**: Design documents from `/specs/026-root-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present; no `contracts/` — this feature adds no API)

**Tests**: Not requested in spec.md and no automated test suite exists in this repo (plan.md Technical Context). Each story instead carries a manual browser-verification task against `quickstart.md`.

**Organization**: Tasks are grouped by user story (spec.md: US1 P1, US2 P2, US3 P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to the repository root (`/develop/harness-mcp`)

## Phase 1: Setup

Not applicable — this feature adds one page and dictionary entries to an already-configured Next.js project (no new dependencies, tooling, or scaffolding required). Proceeding directly to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared i18n dictionary contract with a `dashboard` namespace so the page built in every subsequent user story has translated strings to render in all six supported languages (data-model.md `DashboardLink.labelKey` validation rule).

**⚠️ CRITICAL**: No user story work can begin until T001 is complete (T002–T007 implement the shape T001 defines).

- [X] T001 Add a `dashboard` namespace to the `Dictionary` interface in `frontend/lib/i18n/dictionaries/types.ts`, with shape `{ title: string; description: string; links: { files: string; tools: string; settingsConnectedApps: string; settingsPersonalAccessTokens: string } }`, matching the style of the existing `tools` namespace in the same file.
- [X] T002 [P] Add the `dashboard` translations (English) to `frontend/lib/i18n/dictionaries/en.ts`, satisfying the shape from T001.
- [X] T003 [P] Add the `dashboard` translations (Italian) to `frontend/lib/i18n/dictionaries/it.ts`, satisfying the shape from T001.
- [X] T004 [P] Add the `dashboard` translations (Spanish) to `frontend/lib/i18n/dictionaries/es.ts`, satisfying the shape from T001.
- [X] T005 [P] Add the `dashboard` translations (French) to `frontend/lib/i18n/dictionaries/fr.ts`, satisfying the shape from T001.
- [X] T006 [P] Add the `dashboard` translations (German) to `frontend/lib/i18n/dictionaries/de.ts`, satisfying the shape from T001.
- [X] T007 [P] Add the `dashboard` translations (Russian) to `frontend/lib/i18n/dictionaries/ru.ts`, satisfying the shape from T001.

**Checkpoint**: `Dictionary` interface and all six locale files compile with the new `dashboard` namespace — TypeScript will fail the build if any locale is missing a key (data-model.md validation rule). User story implementation can now begin.

---

## Phase 3: User Story 1 - Land on a dashboard with links to every page (Priority: P1) 🎯 MVP

**Goal**: Visiting `/` (with storage configured) renders a dashboard listing one clickable link per existing top-level page (Files, Tools, Settings › Connected Apps, Settings › Personal Access Tokens), and each link works.

**Independent Test**: Navigate to `/` with storage configured; confirm the page renders (no 404) and shows four labeled, clickable links; click each and confirm it lands on the right page (spec.md US1 Acceptance Scenarios; quickstart.md steps 1–4).

### Implementation for User Story 1

- [X] T008 [US1] Create `frontend/app/page.tsx` as a Server Component: define a local `DashboardLink[]` array with the four fixed entries from data-model.md (`{ href: "/files", labelKey: "files" }`, `{ href: "/tools", labelKey: "tools" }`, `{ href: "/settings/connected-apps", labelKey: "settingsConnectedApps" }`, `{ href: "/settings/personal-access-tokens", labelKey: "settingsPersonalAccessTokens" }`); resolve `dict = getDictionary(await resolveLanguage()).dashboard`; render `dict.title`/`dict.description` and one `<a href>` per array entry labeled via `dict.links[labelKey]`; use inline `CSSProperties` matching `frontend/app/tools/page.tsx` (`<main>` with `maxWidth`/`margin`/`fontFamily`) — no new auth check in this file (research.md §3). Depends on: T001–T007.
- [X] T009 [US1] Manually verify quickstart.md steps 1–4 in a running dev server: `/` renders without a 404, shows exactly the four expected links with no link to `/editor`, `/init`, `/oauth/*`, or `/tools/*/confirm`, and each link navigates to and loads its target page. Depends on: T008.

**Checkpoint**: User Story 1 is fully functional and independently testable — the dashboard exists and every top-level page is one click away.

---

## Phase 4: User Story 2 - Dashboard stays accurate as pages are added or removed (Priority: P2)

**Goal**: The dashboard's link list lives in one obvious, centrally-maintained place, so adding or removing a top-level page is a single-file edit rather than a separately-tracked update step.

**Independent Test**: Add a link entry for a hypothetical new page to the array from T008, confirm it appears on the dashboard, then remove it — confirming the entire update happens in one file (spec.md US2 Acceptance Scenarios).

### Implementation for User Story 2

- [X] T010 [US2] Add a one-line comment directly above the `DashboardLink[]` array in `frontend/app/page.tsx` stating that this array is the single place to update when a top-level page is added or removed (FR-007; research.md §4 explains why this is manual rather than auto-scanned). Depends on: T008.
- [X] T011 [US2] Manually verify: temporarily add a fifth entry to the array (e.g. pointing at an existing route) and confirm it appears on the dashboard as a fifth link, then remove it and confirm the dashboard returns to its original four links, with no other file requiring a change. Depends on: T010.

**Checkpoint**: Both User Story 1 and User Story 2 work — the dashboard renders correctly and its maintenance story is confirmed to be a single, obvious edit.

---

## Phase 5: User Story 3 - Dashboard respects existing storage-setup and language behavior (Priority: P3)

**Goal**: `/` keeps behaving consistently with every other route: redirect to `/init` while storage is unconfigured, and render in the visitor's resolved language.

**Independent Test**: With storage unconfigured, confirm `/` still redirects to `/init` instead of showing the dashboard; with a confirmed language preference set, confirm the dashboard's text renders in that language (spec.md US3 Acceptance Scenarios; quickstart.md steps 5–7).

### Implementation for User Story 3

No new code: `frontend/middleware.ts` already redirects every path (including `/`) to `/init` while storage is unconfigured, and `frontend/app/page.tsx` (T008) already sources its text via `resolveLanguage()`/`getDictionary()`, the same mechanism every other page uses. This story is verification-only.

- [X] T012 [US3] Manually verify quickstart.md steps 5–7 in a running dev server: unset a required storage env var and confirm `/` redirects to `/init` (then restore it); with a confirmed language preference, confirm the dashboard's labels render in that language; while signed out, click an owner-session-gated link from the dashboard (e.g. Tools) and confirm redirect to `/oauth/login?continue=...` with the correct target, matching the behavior of navigating there directly. Depends on: T008.

**Checkpoint**: All three user stories are independently functional — the dashboard exists, stays maintainable, and inherits the product's existing cross-cutting behaviors correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 Run the full `quickstart.md` walkthrough (all 7 steps) end-to-end as a final sign-off after T009, T011, and T012 are individually complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Not applicable — no tasks.
- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories (T008 needs `dict.dashboard` to exist and type-check).
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion.
  - US1 (T008–T009) has no dependency on US2 or US3.
  - US2 (T010–T011) depends on T008 (edits the same file US1 created).
  - US3 (T012) depends on T008 (verifies the page US1 created); has no dependency on US2.
- **Polish (Phase 6)**: Depends on T009, T011, and T012 all being complete.

### Within Each User Story

- US1: T008 (implementation) before T009 (verification).
- US2: T010 (comment) before T011 (verification) — both after T008.
- US3: T012 (verification only) — after T008.

### Parallel Opportunities

- T002–T007 (six locale files) can run in parallel once T001 defines the shape.
- Once Phase 2 completes, T008 is the only implementation task; US2 and US3 both build on it but are otherwise independent of each other and could be verified in either order (or in parallel by different people) once T008 lands.

---

## Parallel Example: Foundational Phase

```bash
# After T001 (types.ts) is committed, launch all six locale updates together:
Task: "Add dashboard translations (English) to frontend/lib/i18n/dictionaries/en.ts"
Task: "Add dashboard translations (Italian) to frontend/lib/i18n/dictionaries/it.ts"
Task: "Add dashboard translations (Spanish) to frontend/lib/i18n/dictionaries/es.ts"
Task: "Add dashboard translations (French) to frontend/lib/i18n/dictionaries/fr.ts"
Task: "Add dashboard translations (German) to frontend/lib/i18n/dictionaries/de.ts"
Task: "Add dashboard translations (Russian) to frontend/lib/i18n/dictionaries/ru.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T007).
2. Complete Phase 3: User Story 1 (T008–T009).
3. **STOP and VALIDATE**: confirm the dashboard renders and all four links work.
4. This alone satisfies the feature's core request ("default page '/' should be a dashboard with links to all existing pages").

### Incremental Delivery

1. Foundational → dictionary shape ready across all six languages.
2. Add User Story 1 → dashboard exists and is fully usable (MVP).
3. Add User Story 2 → confirm the link list's maintainability (documentation-level change).
4. Add User Story 3 → confirm inherited storage/language behavior is unbroken.
5. Polish → one final full quickstart pass.

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- This is a small, single-developer-shaped feature (one new page, one dictionary namespace) — the "parallel team" pattern from the template isn't meaningfully applicable beyond the six locale files in Phase 2.
- Commit after each task or logical group.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
