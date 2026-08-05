---

description: "Task list template for feature implementation"
---

# Tasks: Tools Status Page

**Input**: Design documents from `/specs/024-tools-status-page/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/tools-page.md](./contracts/tools-page.md), [quickstart.md](./quickstart.md)

**Tests**: No automated test framework exists in this repo (research.md §6); verification is the manual `quickstart.md` walkthrough, not automated test tasks.

**Organization**: Tasks are grouped by user story per spec.md. As with spec 023, the underlying mechanism (the page itself, built once in User Story 1) already satisfies User Stories 2 and 3 by construction — reusing the existing owner-session gate and the existing live `isToolEnabled` check, both copied verbatim from established patterns. US2 and US3's tasks are validation-only, called out explicitly rather than padded with busywork.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Path Conventions

Single Next.js app — all paths are under `frontend/` (see plan.md's Project Structure).

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The data (tool catalog) and translated strings every user story's page depends on

**⚠️ CRITICAL**: No user story can be verified until this phase is complete

- [X] T001 [P] Create `frontend/lib/mcp-tools/catalog.ts` exporting `TOOL_CATALOG: { name: string; group: string }[]` — all 17 tools with their group (`"File & Directory"`, `"Engine"`, `"Messaging"`, `"Inbox"`, `"Tree Search"`), per [data-model.md](./data-model.md)'s Tool Catalog Entry table
- [X] T002 [P] Add a `tools` section to the `Dictionary` interface in `frontend/lib/i18n/dictionaries/types.ts` — `title`, `description`, table column labels (`name`, `group`, `status`), `active`, `disabled`, `signOut` — mirroring the shape of the existing `settings.connectedApps`/`settings.pat` sections (research.md §4)
- [X] T003 [P] Add `tools` translations to `frontend/lib/i18n/dictionaries/en.ts`
- [X] T004 [P] Add `tools` translations to `frontend/lib/i18n/dictionaries/it.ts`
- [X] T005 [P] Add `tools` translations to `frontend/lib/i18n/dictionaries/de.ts`
- [X] T006 [P] Add `tools` translations to `frontend/lib/i18n/dictionaries/es.ts`
- [X] T007 [P] Add `tools` translations to `frontend/lib/i18n/dictionaries/fr.ts`
- [X] T008 [P] Add `tools` translations to `frontend/lib/i18n/dictionaries/ru.ts`

**Checkpoint**: `TOOL_CATALOG` exists and every supported language has `tools` strings — the page can now be built

---

## Phase 2: User Story 1 - See which tools are active at a glance (Priority: P1) 🎯 MVP

**Goal**: A signed-in owner can open `/tools` and see all 17 tools listed with a clear active/disabled indicator matching the real configuration.

**Independent Test**: [quickstart.md](./quickstart.md) §2 (all active by default) and §3 (disabled tools shown, not hidden).

### Implementation for User Story 1

- [X] T009 [US1] Create `frontend/app/tools/page.tsx`: an `async` Server Component starting with the owner-session gate (`hasActiveOwnerSession()` + `redirect` to `/oauth/login?continue=%2Ftools`, copied from `frontend/app/settings/connected-apps/page.tsx:13-16` per research.md §3), then rendering one row per `TOOL_CATALOG` entry — name, group, and `isToolEnabled(name)` (`frontend/lib/mcp-tools/toolGate.ts`, spec 023) mapped to the `active`/`disabled` label from the `tools` dictionary — sorted/grouped by `group` per research.md §5 (depends on T001-T008)
- [X] T010 [US1] Run `cd frontend && npx tsc --noEmit` to confirm `page.tsx` and the dictionary additions type-check cleanly (depends on T009). Passed clean.
- [ ] T011 [US1] Follow [quickstart.md](./quickstart.md) §2 and §3 against the local dev server (`docker compose up -d`, `npm run dev`) to confirm: with no tools disabled, all 17 show active; with `send_email`/`send_telegram_message` disabled, both are still listed but marked disabled while the other 15 stay active (depends on T010) — **not run**: requires a browser session against a running dev server, left for manual verification

**Checkpoint**: The tools status page works end-to-end for a signed-in owner — this is the MVP

---

## Phase 3: User Story 2 - Only the signed-in owner can see it (Priority: P2)

**Goal**: An unauthenticated visitor is redirected to sign in and never sees any tool information; after signing in they land back on `/tools`.

**Independent Test**: [quickstart.md](./quickstart.md) §1.

**Note**: No new code — the gate built in T009 is the same two-line pattern every owner-only page in this app already uses. This task is validation only.

- [ ] T012 [US2] Follow [quickstart.md](./quickstart.md) §1: in a private/incognito window, request `/tools` with no session and confirm the redirect to `/oauth/login?continue=%2Ftools` with no tool data anywhere in the response; sign in and confirm landing back on `/tools` (depends on T011) — **not run**: same reason as T011

**Checkpoint**: Access control confirmed working via the existing, reused gate

---

## Phase 4: User Story 3 - The list always reflects the current, real configuration (Priority: P3)

**Goal**: After an operator changes `MCP_DISABLED_TOOLS` and restarts the server, the next page load shows the new status with nothing stale or phantom.

**Independent Test**: [quickstart.md](./quickstart.md) §4 (status updates after restart) and §5 (an unmatched name produces no phantom row).

**Note**: No new code — freshness follows from reusing `isToolEnabled` (which re-reads `process.env` on every call, spec 023) inside a Server Component that already can't be statically cached (research.md §3). This task is validation only.

- [ ] T013 [US3] Follow [quickstart.md](./quickstart.md) §4: disable two tools, restart, confirm they show disabled; remove the deny-list, restart again, confirm all 17 show active again with no leftover "disabled" marking (depends on T011) — **not run**: same reason as T011
- [ ] T014 [US3] Follow [quickstart.md](./quickstart.md) §5: set `MCP_DISABLED_TOOLS=send_email,not_a_real_tool`, restart, confirm exactly 17 rows with no phantom entry for the unmatched name (depends on T011) — **not run**: same reason as T011

**Checkpoint**: All three user stories independently verified — feature complete

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Keep the README's map of owner-only pages in sync with the new one

- [X] T015 [P] Add a one-line mention of `/tools` to `README.md`, near the "Disabling individual tools" paragraph added by spec 023, pointing owners to it as where to check current tool status — mirroring how `/settings/connected-apps` is already mentioned in the OAuth section

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — BLOCKS all user stories
- **User Story 1 (Phase 2)**: Depends on Phase 1 (T001-T008)
- **User Story 2 (Phase 3)**: Depends on Phase 2 completing (T011) — reuses the same page, not a separate implementation
- **User Story 3 (Phase 4)**: Depends on Phase 2 completing (T011) — same reason
- **Polish (Phase 5)**: Depends on all desired user stories being complete

### Within Phase 1 (Foundational)

- T001 (catalog) and T002 (dictionary type) are independent of each other — [P]
- T003-T008 (six language files) depend on T002 (the type they must satisfy) but are independent of each other — [P] among themselves

### Within Phase 2 (User Story 1)

- T009 (the page) depends on all of Phase 1
- T010 (typecheck) depends on T009
- T011 (manual verification) depends on T010

### Parallel Opportunities

- T001 and T002 can run in parallel
- T003, T004, T005, T006, T007, T008 can run in parallel with each other (after T002)
- T012 (Phase 3) and T013, T014 (Phase 4) can all run in parallel with each other — independent verification passes against the same already-built page, each restarting the dev server with a different `MCP_DISABLED_TOOLS` value (or none, for T012)

---

## Parallel Example: Foundational Phase

```bash
# After T002 (Dictionary type) exists, translate into all six languages together:
Task: "Add tools translations to frontend/lib/i18n/dictionaries/en.ts"
Task: "Add tools translations to frontend/lib/i18n/dictionaries/it.ts"
Task: "Add tools translations to frontend/lib/i18n/dictionaries/de.ts"
Task: "Add tools translations to frontend/lib/i18n/dictionaries/es.ts"
Task: "Add tools translations to frontend/lib/i18n/dictionaries/fr.ts"
Task: "Add tools translations to frontend/lib/i18n/dictionaries/ru.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001-T008)
2. Complete Phase 2: User Story 1 (T009-T011) — the page, gated and listing all 17 tools
3. **STOP and VALIDATE**: a signed-in owner can see every tool's real status
4. This already delivers the full FR-001/FR-002/FR-006 scope, since the mechanism (not story-specific) is complete

### Incremental Delivery

1. Foundational + User Story 1 → full MVP, page works for a signed-in owner
2. User Story 2 → same page, access-control behavior validated
3. User Story 3 → same page, freshness-after-restart behavior validated
4. Polish → README updated so operators can find the page

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Like spec 023's tasks.md, this feature's low task count per story reflects its actual shape: one page (Phase 2) built once, reusing two already-existing mechanisms (the owner gate, spec 009/021; the live status check, spec 023) whose correctness Phases 3 and 4 validate rather than re-implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
