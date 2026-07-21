---

description: "Task list for Dynamic Tool Descriptions from a Single Bootstrap File"
---

# Tasks: Dynamic Tool Descriptions from a Single Bootstrap File

**Input**: Design documents from `/specs/010-dynamic-tool-descriptions/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/tool-description-framing.md](contracts/tool-description-framing.md), [quickstart.md](quickstart.md)

**Tests**: No test tasks are included — spec.md did not request tests, this project has no automated test suite (specs 001–009 validate via `quickstart.md` instead), and per project instruction tests are not to be executed as part of this workflow. The `quickstart.md`-execution tasks below are this project's equivalent verification step.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

Single Next.js project at `frontend/` (plan.md Structure Decision) — all paths below are relative to the repository root, inside `frontend/`.

The core bootstrap-reading module (`frontend/lib/mcp-tools/bootstrap.ts`) is shared by every user story — User Story 1's framing text, User Story 2's live-update behavior, and User Story 3's fallback safety are all properties of this one module (research.md §3, §4, §5) — so it is built once in the Foundational phase rather than duplicated per story.

---

## Phase 1: Setup

**Purpose**: Document the one new configuration value this feature adds

- [X] T001 [P] Document the new optional `MCP_BOOTSTRAP_PATH` environment variable in `frontend/.env.example` (e.g. `MCP_BOOTSTRAP_PATH=assistant/AGENTS.md`), noting it's the storage-relative path to the bootstrap file and that omitting it leaves tool descriptions unchanged (data-model.md Configuration value, FR-001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the bootstrap-reading, marker-parsing, caching, and safe-fallback module that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create `frontend/lib/mcp-tools/bootstrap.ts`: read `process.env.MCP_BOOTSTRAP_PATH`; when set, call `readFile()` from `frontend/lib/storage/files.ts` inside a `try/catch` that resolves to `null` on any thrown error (missing path config, `StorageError` from a missing/unreachable file, or any other failure); add a module-level cache (`{ value: BootstrapMarkers | null; readAt: number }`) with a 45-second TTL so repeated calls within the window reuse the last result instead of re-reading storage (data-model.md CachedFraming, research.md §3, §4, FR-001, FR-002, FR-009)
- [X] T003 Add marker parsing to `frontend/lib/mcp-tools/bootstrap.ts`: extract `mcp-context` via `/<!--\s*mcp-context:\s*([^>]*?)\s*-->/` and `mcp-triggers` via `/<!--\s*mcp-triggers:\s*([^>]*?)\s*-->/` from the file content read in T002; split the triggers capture on `,`, trim each piece, and drop empty pieces, producing a `BootstrapMarkers` value (`{ context?: string; triggers?: string[] }`) with either field left `undefined` when its marker is absent (data-model.md BootstrapMarkers, research.md §2, FR-003, FR-004, FR-005) (depends on T002)
- [X] T004 Add `buildEntryDescription(base: string, framing: BootstrapMarkers | null): string` and `buildWriteDescription(base: string, framing: BootstrapMarkers | null): string` to `frontend/lib/mcp-tools/bootstrap.ts`, implementing the exact templates and full precedence/fallback table in `contracts/tool-description-framing.md` (both markers present, only one present, neither present, or `framing` is `null`), always returning `base` unchanged and appended verbatim when framing is generated, and returning `base` alone in every fallback case (contracts/tool-description-framing.md, research.md §5, FR-006, FR-007, FR-009, FR-010) (depends on T003)

**Checkpoint**: `bootstrap.ts` is complete and self-contained — it never throws, always resolves to either generated framing or `null`, and both description-builder functions are ready to be wired into tool registration.

---

## Phase 3: User Story 1 - Connecting client learns when and how to use the storage (Priority: P1) 🎯 MVP

**Goal**: When a client requests the tool list, every entry tool's (`read_file`, `list_directory`) description begins with generated guidance naming the storage's context, the situations that call for it, and an instruction to read the bootstrap file first; every write tool's (`create_file`, `update_file`, `move`, `create_directory`, `delete_directory`, `delete_file`) description begins with a short reminder to the same effect — in both cases followed by that tool's original description, unchanged.

**Independent Test**: With a bootstrap file containing both markers configured, request `tools/list` and confirm the descriptions match contracts/tool-description-framing.md's "both markers present" row for all 8 tools (quickstart.md §1).

### Implementation for User Story 1

- [X] T005 [US1] Update `registerTools()` in `frontend/lib/mcp-tools/index.ts`: call `bootstrap.ts`'s framing lookup once at the top of the function; pass its result through `buildEntryDescription()` when constructing the `description` field for the `read_file` and `list_directory` `registerTool()` calls, and through `buildWriteDescription()` for `create_file`, `update_file`, `move`, `create_directory`, `delete_directory`, and `delete_file` — leaving every tool's name, `inputSchema`, and handler function untouched (plan.md Project Structure, contracts/tool-description-framing.md, FR-006, FR-007, FR-008) (depends on T004). Also updated `frontend/app/mcp/route.ts`'s single call site to `(server) => registerTools(server)` since `registerTools` is now `async` (awaits the bootstrap read) and `mcp-handler` must await it before connecting the transport.
- [ ] T006 [US1] Execute quickstart.md §1 against the local dev server (bootstrap file with both markers present); confirm SC-003 (depends on T005) — **not run**: per standing user instruction not to execute tests, and this project treats quickstart.md as its test equivalent; needs manual verification

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md §1) — this alone is a deployable MVP.

---

## Phase 4: User Story 3 - Tool listing never breaks, even with a missing or malformed bootstrap file (Priority: P1)

**Goal**: Confirm `tools/list` always succeeds with each tool's original description whenever `MCP_BOOTSTRAP_PATH` is unset, the file can't be found or read, or it lacks the expected markers — and degrades gracefully (rather than falling back entirely) when only one marker is present. No new code is required for this: it validates the fallback and partial-marker logic already built into `bootstrap.ts` in Phase 2 (T002–T004) and wired in Phase 3 (T005).

**Independent Test**: Successively unset `MCP_BOOTSTRAP_PATH`, point it at a non-existent file, and point it at a file with no markers; confirm `tools/list` returns all 8 tools with original descriptions and no error in every case (quickstart.md §3).

### Implementation for User Story 3

- [ ] T007 [US3] Execute quickstart.md §3 (no `MCP_BOOTSTRAP_PATH` configured; file missing/unreadable; file with neither marker; file with only `mcp-context` or only `mcp-triggers`) against the local dev server; confirm FR-009, FR-010, SC-002 (depends on T005) — **not run**: per standing user instruction not to execute tests; needs manual verification

**Checkpoint**: User Story 3 validated — tool discovery is never blocked or broken by any bootstrap-file state.

---

## Phase 5: User Story 2 - Owner updates guidance without a redeploy (Priority: P2)

**Goal**: Confirm that editing the bootstrap file's `mcp-context`/`mcp-triggers` markers on an already-running server updates the generated framing within the TTL cache window (~1 minute), with no restart or redeploy. No new code is required beyond Phase 2's cache (T002): this validates that behavior.

**Independent Test**: With the dev server already running, edit the bootstrap file's markers in storage, wait up to the TTL window, and confirm the next `tools/list` call reflects the change (quickstart.md §2).

### Implementation for User Story 2

- [ ] T008 [US2] Execute quickstart.md §2 (edit `mcp-triggers` on a running dev server, wait out the ~45s TTL window, re-request `tools/list`) against the local dev server; confirm SC-001 (depends on T005) — **not run**: per standing user instruction not to execute tests; needs manual verification

**Checkpoint**: User Story 2 validated — bootstrap-file edits propagate without a code change or redeploy.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and a final end-to-end pass

- [X] T009 [P] Update the "S3 Storage MCP Server" section of root `README.md` to describe the new optional `MCP_BOOTSTRAP_PATH` env var and the dynamic tool-description behavior it enables, linking to `specs/010-dynamic-tool-descriptions/quickstart.md`
- [ ] T010 Execute quickstart.md §4 (call an actual tool, e.g. `read_file`, under any bootstrap-file state) confirming FR-008, SC-004 — tool behavior/schema is unaffected by this feature (depends on T005) — **not run**: per standing user instruction not to execute tests; needs manual verification
- [ ] T011 Run `specs/010-dynamic-tool-descriptions/quickstart.md` end-to-end (all 4 sections), confirming every acceptance scenario and success criterion in spec.md passes (depends on T006, T007, T008, T010) — **not run**: per standing user instruction not to execute tests; needs manual verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately, in parallel with everything else
- **Foundational (Phase 2)**: No dependency on Setup — BLOCKS all user stories (T002 → T003 → T004, strictly sequential: same file, each builds on the previous)
- **User Story 1 (Phase 3)**: Depends on Foundational (T004) — can start immediately once Phase 2 completes
- **User Story 3 (Phase 4)**: Depends on User Story 1 (T005) being wired in, so there's something to validate — but no new code of its own
- **User Story 2 (Phase 5)**: Depends on User Story 1 (T005) being wired in, same as above
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational — no dependency on other stories
- **User Story 3 (P1)**: Depends on User Story 1's wiring (T005) existing to validate against; the safety property itself was built in Foundational
- **User Story 2 (P2)**: Depends on User Story 1's wiring (T005) existing to validate against; the caching property itself was built in Foundational

### Within Each Phase

- T002 before T003 before T004 (same file, each layer builds on the last)
- T005 before T006, T007, T008, T010 (nothing to validate until the wiring exists)
- T011 (full quickstart run) depends on every other quickstart-execution task

### Parallel Opportunities

- T001 (env var doc) can run in parallel with all of Phase 2 — different file, no dependency
- T009 (README) can run in parallel with any Phase 3–5 work — different file
- Once T005 lands, T006, T007, and T008 (the three story-validation tasks) can all be executed in parallel — they observe different bootstrap-file states and touch no code

---

## Parallel Example: After T005 lands

```bash
# Validate all three user stories' behavior together, since none of them touch code:
Task: "Execute quickstart.md §1 (both markers present) — User Story 1"
Task: "Execute quickstart.md §3 (missing/malformed bootstrap file) — User Story 3"
Task: "Execute quickstart.md §2 (live edit within TTL window) — User Story 2"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T005–T006)
4. **STOP and VALIDATE**: Run quickstart.md §1 — confirm generated framing appears for all 8 tools
5. Deploy/demo if ready — note this alone does not yet prove the fallback safety (User Story 3) or live-update behavior (User Story 2), though both are already implemented as part of Foundational

### Incremental Delivery

1. Setup + Foundational → bootstrap.ts ready, safe, and cache-backed
2. Add User Story 1 → validate (quickstart.md §1) → MVP demo-able (framing live on all 8 tools)
3. Add User Story 3 → validate (quickstart.md §3) → confirms the safety net holds under every failure mode
4. Add User Story 2 → validate (quickstart.md §2) → confirms edits propagate without a redeploy
5. Polish (T009–T011) → README updated, full quickstart re-run end-to-end

### Parallel Team Strategy

With two developers:

1. Developer A: Foundational (T002–T004) — must land first
2. Developer B: T001 (env var doc) in parallel, then stands by for T005
3. Developer A: User Story 1 (T005–T006) once Foundational lands
4. Either developer: User Story 3 (T007) and User Story 2 (T008) in parallel once T005 lands
5. Either developer: Polish (T009–T011) once everything else lands

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test framework is introduced by this feature; verification is via the `quickstart.md` walkthrough
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
