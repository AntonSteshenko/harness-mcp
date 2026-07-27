---

description: "Task list template for feature implementation"
---

# Tasks: Split the OS Engine From Business Bootstrap, With Versioned Upgrades

**Input**: Design documents from `/specs/016-os-engine-split/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mcp-resources.md, contracts/init-skeleton.md, quickstart.md

**Tests**: No automated test suite in this project (specs 001-015, plan.md Testing) — validation tasks below run `quickstart.md`'s manual scenarios instead of writing test code.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are exact, relative to the repo root

## Path Conventions

Single Next.js app (`frontend/`), per plan.md's Project Structure — no `backend/`/`api/` split.

---

## Phase 1: Setup

**Purpose**: Create the three engine-resource source files as valid placeholders so Phase 2's resource registration has something safe to read; content is filled in per-story in Phase 3+.

- [X] T001 [P] Create `frontend/lib/os/engine/engine.md` with YAML front matter `os-engine-version: 1`, an empty `## Changelog` with a `### v1` heading, and section headings for the build/repair rules to come (content authored in T013)
- [X] T002 [P] Create `frontend/lib/os/engine/os-upgrade.md` with a section heading for the upgrade-check flow to come (content authored in T015)
- [X] T003 [P] Create `frontend/lib/os/engine/init.md` with section headings for the interview/decision-table/write-instructions to come (content authored in T020)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wires the three engine files into the MCP server as resources, and updates the `/init` skeleton write so every story's quickstart scenario starts from a consistent, correct bucket state.

**⚠️ CRITICAL**: No user story work can be validated end-to-end until this phase is complete (T001-T003 must also be done first).

- [X] T004 Implement `registerResources(server)` in `frontend/lib/mcp-tools/resources.ts` — reads `frontend/lib/os/engine/{engine,os-upgrade,init}.md` once at module load (mirrors `frontend/lib/os/init.ts`'s existing `SKELETON_TEMPLATES` pattern) and registers them via `server.registerResource()` as `engine` (`os-engine://engine`), `os-upgrade` (`os-engine://os-upgrade`), and `init` (`os-engine://init`), each returning a single `text/markdown` content block, per `contracts/mcp-resources.md`
- [X] T005 Wire `registerResources(server)` into `frontend/app/mcp/route.ts` alongside the existing `registerTools(server)` call passed to `createMcpHandler`
- [X] T006 Modify `initializeCompanyOs()` in `frontend/lib/os/init.ts` to stop writing `os/skills/init.md`; keep `os/`, `data/`, the `AGENTS.md` stub, and `os/language` writes unchanged, per `contracts/init-skeleton.md`
- [X] T007 [P] Reword the stub in `frontend/lib/os/templates/en/AGENTS.md` to point at the assistant's MCP connection instead of `os/skills/init.md`, then delete `frontend/lib/os/templates/en/init.md`
- [X] T008 [P] Reword the stub in `frontend/lib/os/templates/it/AGENTS.md` to point at the assistant's MCP connection instead of `os/skills/init.md`, then delete `frontend/lib/os/templates/it/init.md`
- [X] T009 [P] Reword the stub in `frontend/lib/os/templates/ru/AGENTS.md` to point at the assistant's MCP connection instead of `os/skills/init.md`, then delete `frontend/lib/os/templates/ru/init.md`
- [X] T010 [P] Reword the stub in `frontend/lib/os/templates/fr/AGENTS.md` to point at the assistant's MCP connection instead of `os/skills/init.md`, then delete `frontend/lib/os/templates/fr/init.md`
- [X] T011 [P] Reword the stub in `frontend/lib/os/templates/de/AGENTS.md` to point at the assistant's MCP connection instead of `os/skills/init.md`, then delete `frontend/lib/os/templates/de/init.md`
- [X] T012 [P] Reword the stub in `frontend/lib/os/templates/es/AGENTS.md` to point at the assistant's MCP connection instead of `os/skills/init.md`, then delete `frontend/lib/os/templates/es/init.md`

**Checkpoint**: Foundation ready — MCP resources are registered and reachable, `/init` writes the correct stub-only skeleton in all six languages, no `os/skills/init.md` is written anywhere.

---

## Phase 3: User Story 1 - AGENTS.md is built and repaired by a non-editable engine (Priority: P1) 🎯 MVP

**Goal**: The engine's rules (build/repair `AGENTS.md`, record its version) live only in the `engine` MCP resource, never in the bucket.

**Independent Test**: Connect an assistant to a fresh bucket (post-Phase 2), ask it to build the OS's control file, and verify `AGENTS.md` is created with a recorded `os-engine-version` — with no engine-rules file anywhere in the bucket (spec.md Story 1 Independent Test).

### Implementation for User Story 1

- [X] T013 [US1] Author the full content of `frontend/lib/os/engine/engine.md`: Rule Zero equivalent and write-semantics/"nevers" rules (the mechanics-only subset of today's `frontend/lib/os/templates/en/init.md`), instructions to build `AGENTS.md` from the stub (write the router body plus `os-engine-version` front matter, pointing to `os/routing.md` rather than an inline routing table), instructions to repair a damaged `AGENTS.md`, and — inline, self-contained (not deferred to `os-upgrade.md`) — the confirm-before-change gate: when the recorded version is behind the current one, describe the net difference from the `## Changelog` and proceed only after confirmation (FR-006a); when it already matches, rebuild directly with no gate (FR-006b) (data-model.md, contracts/mcp-resources.md `engine`)

### Validation for User Story 1

- [ ] T014 [US1] Run `quickstart.md` Scenario A (fresh build) and Scenario D (repair with version behind vs. already current) and confirm every expectation holds

**Checkpoint**: User Story 1 is independently functional — a fresh or damaged `AGENTS.md` is built/repaired entirely through the `engine` resource, with the confirm-gate behavior in place.

---

## Phase 4: User Story 2 - Owner is offered an upgrade when the engine has moved on (Priority: P1)

**Goal**: An owner can explicitly ask whether their Company OS is behind the current engine, see what would change, and confirm before anything is touched.

**Independent Test**: Manually set `AGENTS.md`'s recorded `os-engine-version` behind the current one, ask the assistant to check for an upgrade, and confirm it describes the change and only rebuilds after agreement (spec.md Story 2 Independent Test).

### Implementation for User Story 2

- [X] T015 [US2] Author the full content of `frontend/lib/os/engine/os-upgrade.md`: on an explicit "check for an OS upgrade" request, run the same version-compare-describe-confirm procedure `engine.md` already defines for repairs (T013), translate the changelog summary into `os/language` before presenting it (FR-015), and report "nothing changed" with no bucket write when already current (FR-006) (contracts/mcp-resources.md `os-upgrade`)

### Validation for User Story 2

- [ ] T016 [US2] Run `quickstart.md` Scenario B (nothing new) and Scenario C (upgrade available: describe → decline → still offered again → confirm → version updated) and confirm every expectation holds

**Checkpoint**: User Stories 1 and 2 both work independently — repair and explicit upgrade share one confirm gate, never two independent paths.

---

## Phase 5: User Story 3 - Pre-existing Company OS instances are picked up without data loss (Priority: P2)

**Goal**: A Company OS built before this feature (no recorded `os-engine-version`, routing embedded inline in `AGENTS.md`) is treated as version 0 and migrated without losing its routing information.

**Independent Test**: Take a bucket fixture resembling a pre-feature Company OS, ask the assistant to repair or upgrade it, and confirm the previously-embedded routing entries reappear intact in `os/routing.md` afterward (spec.md Story 3 Independent Test).

### Implementation for User Story 3

- [X] T017 [US3] Extend `frontend/lib/os/engine/engine.md`'s build/repair instructions (T013) to treat a missing `os-engine-version` as version 0, not an error (FR-007), and — before rebuilding such an `AGENTS.md` — extract every row of its inline routing table into `os/routing.md`, preserving all of them, rather than discarding them on overwrite (FR-008)
- [X] T018 [P] [US3] Create `specs/016-os-engine-split/fixtures/legacy-agents-v0.md`: a sample pre-feature `AGENTS.md` body (no `os-engine-version` front matter, an inline routing table in the shape today's `en/init.md` Phase 3 produces) for repeatable use in Scenario E, referenced from `quickstart.md`

### Validation for User Story 3

- [ ] T019 [US3] Run `quickstart.md` Scenario E using the `legacy-agents-v0.md` fixture (T018) and confirm zero routing entries are lost and business data (`data/*`, `os/identity.md`, etc.) is untouched throughout (SC-002, FR-014)

**Checkpoint**: A pre-existing Company OS can be safely brought onto the new system on its first touch, with no forced/background migration.

---

## Phase 6: User Story 4 - Business setup and routing live apart from the engine (Priority: P2)

**Goal**: The interview-driven business bootstrap (and everything it produces) is owned by the `init` resource, self-triggering when business data is missing, independent of the engine.

**Independent Test**: Connect an assistant to a bucket with a valid `AGENTS.md` but no business data, confirm the business-setup flow triggers on its own, runs the interview, and produces `data/`, identity, policies, domain skills, and an editable routing file (spec.md Story 4 Independent Test).

### Implementation for User Story 4

- [X] T020 [US4] Author the interview and activity-type decision table in `frontend/lib/os/engine/init.md` (company info, activity type, who's involved, tone, pricing/product as applicable, out-of-scope; the `data/`-subdirs/domain-skills-by-activity-type table) and the write instructions for `os/identity.md`, `os/policies/*`, domain skill files, and `os/templates/*` — ported from today's `frontend/lib/os/templates/en/init.md` Phases 1-3, minus the mechanics now in `engine.md` (FR-011, FR-013, FR-015)
- [X] T021 [US4] Add to `frontend/lib/os/engine/init.md`: check `data/` via the existing `list_directory` tool as the first step of every task, not cached for the session, and offer the interview before proceeding if it's missing/empty (FR-012, FR-012a)
- [X] T022 [US4] Add to `frontend/lib/os/engine/init.md`: create and later update `os/routing.md` (a Markdown table of task/skill description → skill file path) as part of the interview's writes and whenever a skill is added/removed afterward, independent of any `AGENTS.md` change (FR-009, FR-010, FR-014, SC-004)

### Validation for User Story 4

- [ ] T023 [US4] Run `quickstart.md` Scenario F (self-triggered setup, runs exactly once) and Scenario G (routing edits never touch `AGENTS.md`) and confirm every expectation holds

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final sign-off across all stories together.

- [ ] T024 [P] Run the complete `quickstart.md` walkthrough (Scenarios A-G) end-to-end in one continuous session against a single Company OS, confirming no scenario regresses another
- [X] T025 [P] Confirm `engine`, `os-upgrade`, and `init` are listed via the MCP connection's `resources/list` but are never reachable via `list_directory`/`read_file` against a live bucket (SC-003) — verified statically: `frontend/lib/os/engine/*.md` is read only by `resources.ts`'s `readFileSync`, never passed to `createFile`/`updateFile` anywhere in the codebase (grep confirmed); live `resources/list` vs. bucket-listing behavior follows from the MCP resource primitive itself. **Not confirmed against a running server** — no live MCP session in this environment.
- [X] T026 Review `frontend/app/mcp/route.ts`'s `serverInfo.description` ("read assistant/AGENTS.md") for continued accuracy now that resources exist alongside tools; update if it undersells or misdescribes the new surface — updated to mention the engine/os-upgrade/init resources (T005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001-T003 must exist before T004 reads them) — BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational (Phase 2) completion
  - US1 (P1) and US2 (P1) should be done first — US2's `os-upgrade.md` (T015) explicitly reuses the procedure US1's `engine.md` (T013) defines, so **T013 must precede T015**
  - US3 (P2) extends the same `engine.md` file US1 authored (T017 depends on T013) — sequential, not parallel, on that file
  - US4 (P2) is independent of US1/US2/US3's file (`init.md` vs `engine.md`/`os-upgrade.md`) and could proceed in parallel with them once Foundational is done
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only. No dependency on other stories.
- **User Story 2 (P1)**: Foundational, **and** US1's T013 (reuses its confirm-gate procedure) — otherwise independent.
- **User Story 3 (P2)**: Foundational, **and** US1's T013 (extends the same file) — otherwise independent; does not depend on US2.
- **User Story 4 (P2)**: Foundational only. Fully independent of US1/US2/US3 — different file (`init.md`), different bucket paths (`data/*`, `os/identity.md`, `os/routing.md` vs. `AGENTS.md`).

### Within Each User Story

- Implementation before validation
- `engine.md`-touching stories (US1, US3) are sequential on that one file; US2 (`os-upgrade.md`) and US4 (`init.md`) touch different files and can proceed in parallel with each other and with US1/US3 once T013 has landed

### Parallel Opportunities

- T001, T002, T003 (Setup) — different files
- T007-T012 (Foundational, six languages) — different files
- Once T013 (US1) lands: US2 (T015-T016) and US4 (T020-T023) can proceed in parallel; US3 (T017, T019) is sequential after T013 on the same file, but T018 (fixture) can run in parallel with T017
- T024, T025 (Polish) — independent checks

---

## Parallel Example: Foundational Phase

```bash
# Launch all six per-language stub rewords together, after T006:
Task: "Reword the stub in frontend/lib/os/templates/en/AGENTS.md ... delete en/init.md"
Task: "Reword the stub in frontend/lib/os/templates/it/AGENTS.md ... delete it/init.md"
Task: "Reword the stub in frontend/lib/os/templates/ru/AGENTS.md ... delete ru/init.md"
Task: "Reword the stub in frontend/lib/os/templates/fr/AGENTS.md ... delete fr/init.md"
Task: "Reword the stub in frontend/lib/os/templates/de/AGENTS.md ... delete de/init.md"
Task: "Reword the stub in frontend/lib/os/templates/es/AGENTS.md ... delete es/init.md"
```

## Parallel Example: After User Story 1 Lands

```bash
# US2 and US4 can proceed together once T013 (engine.md) is done:
Task: "Author frontend/lib/os/engine/os-upgrade.md (T015, US2)"
Task: "Author the interview/decision-table section of frontend/lib/os/engine/init.md (T020, US4)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `quickstart.md` Scenarios A and D independently
5. This alone already satisfies SC-001's prerequisite (a versioned, non-editable engine) and SC-003 — ship it before layering the upgrade/migration/business-setup stories on top

### Incremental Delivery

1. Setup + Foundational → foundation ready, `/init` and MCP resources correct in all six languages
2. Add US1 → validate independently → engine builds/repairs `AGENTS.md` (MVP)
3. Add US2 → validate independently → explicit upgrade checks work, sharing US1's confirm gate
4. Add US3 → validate independently → pre-existing Company OS instances migrate safely
5. Add US4 → validate independently → business setup fully separated from the engine, self-triggering
6. Polish → full end-to-end sign-off

---

## Notes

- **T014, T016, T019, T023, T024 (all `quickstart.md` scenario walkthroughs) remain unchecked** — they require a live MinIO instance and a connected MCP assistant session, neither of which exists in the implementing environment. Every implementation task they depend on is done and statically verified (`tsc --noEmit` clean); these five need a human (or an agent with a live browser/MCP session) to actually run `quickstart.md` Scenarios A-G before this feature ships.
- No test-code tasks: this project has no automated test suite (plan.md Testing); every story's "test" is a `quickstart.md` scenario run by hand
- [P] tasks touch different files with no unmet dependency
- [Story] label maps each task to its spec.md user story for traceability
- US1 and US3 share `frontend/lib/os/engine/engine.md` and are therefore sequential on that file, not parallel, despite being independently testable once done
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before moving on
