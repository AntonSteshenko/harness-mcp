---

description: "Task list template for feature implementation"
---

# Tasks: Dedicated Inbox MCP Tool

**Input**: Design documents from `/specs/020-mcp-inbox-tool/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature (plan.md Testing: no automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-019). No test tasks are included; quickstart scenarios are run as manual validation tasks within each story's phase instead.

**Organization**: Tasks are grouped by user story. User Story 1 (P1, read the inbox in one call) is the MVP and delivers the entire `get_inbox` tool, including its error handling — because the tool is a thin wrapper around the existing `readFile()` (which already throws distinct `StorageError` codes for "not found" vs. "unreachable"), User Story 2 (P2, clear not-found signal) needs no additional implementation and is validation-only, same pattern as spec 017's US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at `frontend/` (same app as every prior spec): new tool-registration module at `frontend/lib/mcp-tools/inboxTools.ts`, wired into `frontend/app/mcp/route.ts`. No `tests/` directory — no automated tests requested.

---

## Phase 1: Setup

**Purpose**: Project initialization

Not applicable — no new dependency, environment variable, or configuration surface is introduced (research.md §1-§4; plan.md Technical Context). Implementation begins directly with User Story 1.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure all user stories depend on

Not applicable — the storage layer (`readFile()`, `StorageError` codes) and MCP tool-result conventions (`ok()`/`errorResult()`) this feature relies on already exist unchanged (plan.md Technical Context, research.md §1). There is no shared groundwork to lay beyond User Story 1's own implementation task.

---

## Phase 3: User Story 1 - Read the inbox in one call (Priority: P1) 🎯 MVP

**Goal**: A connected assistant can call a single, purpose-named `get_inbox` tool and get the inbox file's exact current content back, with no path argument and no caching between calls.

**Independent Test**: Call `get_inbox` against a storage account whose `data/inbox.md` has known content and confirm the returned content matches exactly, with zero preceding calls needed to discover the path (spec.md US1 Independent Test).

### Implementation for User Story 1

- [X] T001 [US1] Create `frontend/lib/mcp-tools/inboxTools.ts`: define `const INBOX_PATH = "data/inbox.md";` and export `async function registerInboxTools(server: McpServer): Promise<void>` that calls `getBootstrapFraming()` (`frontend/lib/mcp-tools/bootstrap.ts`) once, then registers a single tool named `get_inbox` with `inputSchema: {}` (no parameters) whose description is built via `buildEntryDescription("Returns the full current content of the quick-capture inbox (data/inbox.md) — the owner's one-line-with-date capture log, read during workflows like daily-plan and weekly-review.", framing)`, and whose handler calls `readFile(INBOX_PATH)` (`frontend/lib/storage/files.ts`, unchanged) wrapped in `try`/`catch`, returning `ok(result)` on success or `errorResult(err)` on failure — both from `frontend/lib/mcp-tools/result.ts` — mirroring `read_file`'s exact implementation shape in `frontend/lib/mcp-tools/index.ts` (contracts/inbox-tool-contract.md, FR-001, FR-002, FR-003, FR-006)
- [X] T002 [US1] Wire the new tool into `frontend/app/mcp/route.ts`: import `registerInboxTools` from `@/lib/mcp-tools/inboxTools` and add `await registerInboxTools(server);` inside the `createMcpHandler` callback, alongside the existing `registerTools`/`registerEngineTools`/`registerMessagingTools` calls (plan.md Project Structure) — depends on T001

### Validation for User Story 1

- [ ] T003 [US1] Run quickstart.md Scenarios 1, 2, and 3 against a running `next dev` instance, confirming: `get_inbox` returns an existing inbox's exact content with no path argument (Scenario 1); a freshly-emptied inbox (header only) is returned as success, not an error (Scenario 2); and a second call after an external edit reflects the new content, proving no caching (Scenario 3) — depends on T001, T002

**Checkpoint**: User Story 1 fully functional and independently testable — MVP deliverable

---

## Phase 4: User Story 2 - Clear signal when the inbox doesn't exist yet (Priority: P2)

**Goal**: Confirm a missing inbox file produces a clearly distinguishable "not found" outcome, separate from an unrelated storage failure. Delivered as a side effect of T001's use of the existing `readFile()`/`errorResult()` conventions (which already distinguish `not_found` from `storage_unreachable`); this phase is validation-only.

**Independent Test**: Call `get_inbox` against a storage account with no inbox file and confirm a clear, distinguishable "not found" result (spec.md US2 Independent Test).

### Validation for User Story 2

- [ ] T004 [US2] Run quickstart.md Scenarios 4 and 5 against a running `next dev` instance, confirming: calling `get_inbox` when `data/inbox.md` does not exist returns `code: "not_found"` (Scenario 4); and temporarily pointing the S3 endpoint at an unreachable host produces a distinct `code: "storage_unreachable"` instead (Scenario 5), proving the two failure modes are distinguishable — depends on T001, T002

**Checkpoint**: Both user stories are independently functional — the full feature is complete

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final sign-off across both stories together

- [ ] T005 [P] Run quickstart.md Scenario 6, confirming `get_inbox` performs no write (the inbox file's `lastModified`/`etag` are unchanged across two consecutive calls) — FR-002
- [ ] T006 Run the complete quickstart.md walkthrough (Scenarios 1-6) end-to-end in one continuous session, confirming no scenario regresses another

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Not applicable — no tasks
- **Foundational (Phase 2)**: Not applicable — no tasks
- **User Story 1 (Phase 3)**: No dependencies on other stories — can start immediately
- **User Story 2 (Phase 4)**: Depends on User Story 1's implementation (T001, T002) being done, since it validates behavior already delivered by that code
- **Polish (Phase 5)**: Depends on both user stories being complete

### Parallel Opportunities

- T001 and T002 are sequential (T002 wires in what T001 creates) — no parallelism within User Story 1's implementation
- T005 is marked [P] and can run alongside other Polish tasks once both stories are validated

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (T001-T003)
2. **STOP and VALIDATE**: `get_inbox` returns correct, live content for an existing inbox
3. This alone already delivers the entire tool — User Story 2 needs no further code

### Incremental Delivery

1. User Story 1 (T001-T003) → full `get_inbox` implementation, validated → MVP
2. User Story 2 (T004) → confirms the not-found path already works correctly
3. Polish (T005-T006) → confirms read-only guarantee and runs the full walkthrough

---

## Notes

- This feature is intentionally small: one new file, one wiring line, zero new storage/error-handling code.
- Commit after each task or logical group.
- Stop at the Phase 3 checkpoint to validate the MVP independently before moving on.
