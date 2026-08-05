---

description: "Task list template for feature implementation"
---

# Tasks: Manage Tools From The Page

**Input**: Design documents from `/specs/025-manage-tools-page/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/manage-tools-routes.md](./contracts/manage-tools-routes.md), [quickstart.md](./quickstart.md)

**Tests**: No automated test framework exists in this repo (research.md §8); verification is the manual `quickstart.md` walkthrough, not automated test tasks.

**Organization**: Tasks are grouped by user story per spec.md. The Foundational phase is unusually large for this feature because moving the source of truth from an env var to storage (research.md §6) requires touching every one of spec 023's 5 registration modules and `toolGate.ts` before any of the three user stories can be exercised at all — the actual new page/route work (User Story 1) is comparatively small. User Stories 2 and 3 add no new code beyond User Story 1's page/route work; their tasks are validation only, as in specs 023 and 024.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Path Conventions

Single Next.js app — all paths are under `frontend/` (see plan.md's Project Structure).

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Move the source of truth from `MCP_DISABLED_TOOLS` to storage everywhere it's currently read, before any UI can act on it

**⚠️ CRITICAL**: No user story can be verified until this phase is complete

- [X] T001 Create `frontend/lib/mcp-tools/store.ts`: reserved prefix `.mcp-tools/`, `getRecord`/`putRecord` over `Key = ".mcp-tools/" + relativeKey + ".json"` (copies the pattern in `frontend/lib/messaging/store.ts`, research.md §3), plus `getDisabledTools(): Promise<ReadonlySet<string>>` and `setToolDisabled(name: string, disabled: boolean): Promise<void>` operating on the Tool Status Record (data-model.md) at relative key `"status"`
- [X] T002 In `frontend/lib/storage/directories.ts`, exclude the `.mcp-tools/` prefix from `listDirectory` results, alongside the existing `OAUTH_PREFIX` exclusion (research.md §3) — protects `list_directory`/`list_directory_tree`/`find_files_by_name`/`search_file_content` since they all compose `listDirectory`
- [X] T003 In `frontend/lib/mcp-tools/toolGate.ts`, change `registerGatedTool` to take a pre-fetched `disabledTools: ReadonlySet<string>` parameter instead of reading `process.env` itself — `registerGatedTool(server, disabledTools, name, config, cb)`; remove the old synchronous `MCP_DISABLED_TOOLS` parsing (research.md §6, superseding spec 023's mechanism per spec.md FR-007/FR-011)
- [X] T004 [P] In `frontend/lib/mcp-tools/index.ts`, change `registerTools(server)` to `registerTools(server, disabledTools)`, threading `disabledTools` into all 8 `registerGatedTool` calls (depends on T003)
- [X] T005 [P] In `frontend/lib/mcp-tools/engineTools.ts`, change `registerEngineTools(server)` to `registerEngineTools(server, disabledTools)`, threading it into the `ENGINE_TOOLS` loop's `registerGatedTool` call (depends on T003)
- [X] T006 [P] In `frontend/lib/mcp-tools/messagingTools.ts`, change `registerMessagingTools(server)` to `registerMessagingTools(server, disabledTools)`, threading it into both `registerGatedTool` calls (depends on T003)
- [X] T007 [P] In `frontend/lib/mcp-tools/inboxTools.ts`, change `registerInboxTools(server)` to `registerInboxTools(server, disabledTools)`, threading it into its `registerGatedTool` call (depends on T003)
- [X] T008 [P] In `frontend/lib/mcp-tools/treeTools.ts`, change `registerTreeTools(server)` to `registerTreeTools(server, disabledTools)`, threading it into all 3 `registerGatedTool` calls (depends on T003)
- [X] T009 In `frontend/app/mcp/route.ts`, fetch `disabledTools` once via `getDisabledTools()` (T001) inside the `initializeServer` callback, before calling the 5 `register*Tools` functions, and pass it to each (depends on T001, T004-T008)
- [X] T010 Run `cd frontend && npx tsc --noEmit` to confirm all the signature changes across `toolGate.ts`, the 5 registration modules, and `route.ts` compile cleanly (depends on T009). Passed clean (the one error seen at this checkpoint was in `app/tools/page.tsx`, expected since it's updated later in T020).
- [X] T011 [P] Extend the `tools` section of the `Dictionary` interface in `frontend/lib/i18n/dictionaries/types.ts` with confirm-screen and warning-banner strings (e.g. confirmation title/body, confirm/cancel button labels, the "already-connected sessions" warning text, per FR-002/FR-004) — additive to spec 024's existing `tools` fields
- [X] T012 [P] Add the new `tools` strings to `frontend/lib/i18n/dictionaries/en.ts` (depends on T011)
- [X] T013 [P] Add the new `tools` strings to `frontend/lib/i18n/dictionaries/it.ts` (depends on T011)
- [X] T014 [P] Add the new `tools` strings to `frontend/lib/i18n/dictionaries/de.ts` (depends on T011)
- [X] T015 [P] Add the new `tools` strings to `frontend/lib/i18n/dictionaries/es.ts` (depends on T011)
- [X] T016 [P] Add the new `tools` strings to `frontend/lib/i18n/dictionaries/fr.ts` (depends on T011)
- [X] T017 [P] Add the new `tools` strings to `frontend/lib/i18n/dictionaries/ru.ts` (depends on T011)

**Checkpoint**: The live MCP server and the storage layer both run on the new, storage-backed mechanism; `MCP_DISABLED_TOOLS` is no longer consulted anywhere. User Story 1's page/route work can now begin.

---

## Phase 2: User Story 1 - Change a tool's status from the page (Priority: P1) 🎯 MVP

**Goal**: A signed-in owner can disable or re-enable any tool from `/tools`, through an explicit confirmation step, with no configuration file editing or server restart.

**Independent Test**: [quickstart.md](./quickstart.md) §1 (confirm-then-apply works, abandoning changes nothing) and §5 (an invalid tool name is rejected, not silently confirmed).

### Implementation for User Story 1

- [X] T018 [P] [US1] Create `frontend/app/tools/[name]/confirm/page.tsx`: owner-gated (same `hasActiveOwnerSession()` + redirect pattern as `/tools`), reads `to` from the query string, validates `name` against `TOOL_CATALOG` and `to` against `"active"|"disabled"` (rejecting anything else per contracts/manage-tools-routes.md), renders the pending change and the warning copy, with a form `POST`-ing to `/tools/[name]/status` and a cancel link back to `/tools` (depends on T001, T011-T017)
- [X] T019 [P] [US1] Create `frontend/app/tools/[name]/status/route.ts`: owner-gated POST (mirrors `frontend/app/settings/connected-apps/[grantId]/revoke/route.ts`'s shape — 401 JSON if no session), validates `name` and `to`, calls `setToolDisabled` (T001), and on success redirects (`303`) to `/tools?changed=<name>&to=<to>`; on validation or storage failure, reports the failure instead of redirecting as if it succeeded (depends on T001)
- [X] T020 [P] [US1] Update `frontend/app/tools/page.tsx`: replace the `isToolEnabled` read with `getDisabledTools()` (T001); add a per-row link/control to `/tools/[name]/confirm?to=<opposite status>`; read `changed`/`to` from the page's search params and render the warning banner (using T011-T017's new strings) when present (depends on T001, T011-T017)
- [X] T021 [US1] Run `cd frontend && npx tsc --noEmit` to confirm the two new routes and the updated page type-check cleanly (depends on T018, T019, T020). Passed clean, whole project.
- [ ] T022 [US1] Follow [quickstart.md](./quickstart.md) §1 and §5 against the local dev server (`docker compose up -d`, `npm run dev`) to confirm: disabling a tool requires confirmation, abandoning the confirmation screen changes nothing, submitting it applies the change, and requesting confirmation for a nonexistent tool name is rejected (depends on T021) — **not run**: requires a browser session against a running dev server, left for manual verification

**Checkpoint**: The tools status page (spec 024) is now interactive — this is the MVP

---

## Phase 3: User Story 2 - Understand that the change isn't instant everywhere (Priority: P2)

**Goal**: Every confirmed change shows a clear warning that already-connected AI assistant sessions may not see it right away.

**Independent Test**: [quickstart.md](./quickstart.md) §2.

**Note**: No new code — the banner was built as part of T020 (it's the same page). This task validates it fires on *every* change, not just the first, per spec.md FR-005.

- [ ] T023 [US2] Follow [quickstart.md](./quickstart.md) §2: confirm the warning banner appears after the first change (from US1's T022), then make a second, different change and confirm the banner appears again (depends on T022) — **not run**: same reason as T022

**Checkpoint**: The warning behavior confirmed working on every change, not just once

---

## Phase 4: User Story 3 - The change is the one true status everywhere (Priority: P3)

**Goal**: A confirmed change is what the live MCP server actually uses on the very next request, with no restart, and only an owner can make it.

**Independent Test**: [quickstart.md](./quickstart.md) §3 (live for the next `/mcp` request, persists across page reloads) and §4 (unauthenticated attempts rejected).

**Note**: No new code — this validates properties that already follow from the Foundational phase (`mcp-handler` re-registering tools per request, research.md §1) and from reusing the existing owner gate. This task is validation only.

- [ ] T024 [US3] Follow [quickstart.md](./quickstart.md) §3: with a tool disabled from US1, confirm a fresh `/mcp` `tools/list` (or an MCP client) no longer offers it, without restarting the dev server; confirm `/tools` still shows it disabled on a later, separate page load (depends on T022) — **not run**: same reason as T022
- [ ] T025 [US3] Follow [quickstart.md](./quickstart.md) §4: without an owner session, confirm both `POST /tools/[name]/status` and `GET /tools/[name]/confirm` are rejected/redirected and no status changes (depends on T022) — **not run**: same reason as T022

**Checkpoint**: All three user stories independently verified — feature complete

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Retire the documentation for the mechanism this feature supersedes

- [X] T026 [P] Update `frontend/.env.example`'s `MCP_DISABLED_TOOLS` comment (added by spec 023) to state it is no longer read by the server, and point to `/tools` instead (research.md §7)
- [X] T027 [P] Update `README.md`'s "Disabling individual tools" section (added by spec 023) to describe the new page-managed flow instead of the env-var-and-restart flow, linking to [quickstart.md](./quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — BLOCKS all user stories
- **User Story 1 (Phase 2)**: Depends on Phase 1 completing in full (T001-T017)
- **User Story 2 (Phase 3)**: Depends on Phase 2 completing (T022) — reuses the same page, not a separate implementation
- **User Story 3 (Phase 4)**: Depends on Phase 2 completing (T022) — same reason
- **Polish (Phase 5)**: Depends on all desired user stories being complete

### Within Phase 1 (Foundational)

- T001 and T002 are independent of each other
- T003 depends on T001 (uses its types) conceptually but is a separate file — sequence T001 before T003
- T004-T008 (the 5 registration modules) depend on T003 but are independent of each other — [P]
- T009 depends on T001 and all of T004-T008
- T010 (typecheck) depends on T009
- T011 (dictionary type) has no code dependency on T001-T010 — can run in parallel with the storage/registration work
- T012-T017 (six languages) depend on T011 but are independent of each other — [P]

### Within Phase 2 (User Story 1)

- T018, T019, T020 depend on Phase 1 (T001, T011-T017) but not on each other (no import relationship between them — T018's form only references T019's URL as a string) — [P]
- T021 (typecheck) depends on T018, T019, T020
- T022 (manual verification) depends on T021

### Parallel Opportunities

- T004, T005, T006, T007, T008 (Foundational) can run in parallel with each other
- T012-T017 (Foundational, six languages) can run in parallel with each other, and with T004-T009 (independent subsystems)
- T018, T019, T020 (User Story 1) can run in parallel with each other
- T023 (Phase 3) and T024, T025 (Phase 4) can all run in parallel with each other — independent verification passes against the same already-built feature

---

## Parallel Example: Foundational Phase

```bash
# After T003 (toolGate.ts signature change), update all 5 registration modules together:
Task: "Thread disabledTools into frontend/lib/mcp-tools/index.ts"
Task: "Thread disabledTools into frontend/lib/mcp-tools/engineTools.ts"
Task: "Thread disabledTools into frontend/lib/mcp-tools/messagingTools.ts"
Task: "Thread disabledTools into frontend/lib/mcp-tools/inboxTools.ts"
Task: "Thread disabledTools into frontend/lib/mcp-tools/treeTools.ts"

# After T011 (Dictionary type), translate into all six languages together:
Task: "Add new tools strings to frontend/lib/i18n/dictionaries/en.ts"
Task: "Add new tools strings to frontend/lib/i18n/dictionaries/it.ts"
Task: "Add new tools strings to frontend/lib/i18n/dictionaries/de.ts"
Task: "Add new tools strings to frontend/lib/i18n/dictionaries/es.ts"
Task: "Add new tools strings to frontend/lib/i18n/dictionaries/fr.ts"
Task: "Add new tools strings to frontend/lib/i18n/dictionaries/ru.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001-T017) — the storage-backed mechanism, wired everywhere `MCP_DISABLED_TOOLS` used to be read
2. Complete Phase 2: User Story 1 (T018-T022) — the confirm-then-apply UI
3. **STOP and VALIDATE**: an owner can change any tool's status from the page
4. This already delivers FR-001, FR-002, FR-003, FR-006, FR-007, FR-009 in full, since the mechanism isn't story-specific

### Incremental Delivery

1. Foundational + User Story 1 → full MVP, owner can manage tools from `/tools`
2. User Story 2 → same page, warning-on-every-change behavior validated
3. User Story 3 → same page, live-without-restart and access-control behavior validated
4. Polish → docs updated so operators don't think `MCP_DISABLED_TOOLS` still does anything

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- As with specs 023 and 024, User Stories 2 and 3's low task count reflects their actual shape: properties that already hold once Phase 1 and User Story 1 are done, validated rather than separately built
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
