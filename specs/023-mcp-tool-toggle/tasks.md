---

description: "Task list template for feature implementation"
---

# Tasks: MCP Tool Toggle

**Input**: Design documents from `/specs/023-mcp-tool-toggle/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/mcp-tool-toggle-config.md](./contracts/mcp-tool-toggle-config.md), [quickstart.md](./quickstart.md)

**Tests**: No automated test framework exists in this repo (research.md §5); verification is the manual `quickstart.md` walkthrough, not automated test tasks.

**Organization**: Tasks are grouped by user story per spec.md. Note this feature's mechanism (the gate check) is the same single code path for every user story — US2 and US3 add no new code beyond what US1 wires up, only new configuration values exercised against it. Their tasks are therefore validation-only, which is called out explicitly below rather than padded with busywork.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Path Conventions

Single Next.js app — all paths are under `frontend/` (see plan.md's Project Structure).

## Phase 1: Setup

**Purpose**: Declare the new configuration surface before any code reads it

- [X] T001 Add `MCP_DISABLED_TOOLS` documentation to `frontend/.env.example`, next to `MCP_BOOTSTRAP_PATH`: format (comma-separated tool names), matching rules, and the full list of 17 disable-able tool names, per [contracts/mcp-tool-toggle-config.md](./contracts/mcp-tool-toggle-config.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one shared mechanism every user story depends on

**⚠️ CRITICAL**: No user story can be verified until this phase is complete

- [X] T002 Create `frontend/lib/mcp-tools/toolGate.ts` exporting `isToolEnabled(name: string): boolean` (parses `MCP_DISABLED_TOOLS` per research.md §3: split on `,`, trim, drop empty, case-sensitive exact match, no caching) and `registerGatedTool(server, name, config, cb)` (forwards to `server.registerTool(name, config, cb)` only when `isToolEnabled(name)`, per research.md §§1-2 and the Internal Contract in [contracts/mcp-tool-toggle-config.md](./contracts/mcp-tool-toggle-config.md)). **Deviation from plan**: the originally planned `<T extends Parameters<McpServer["registerTool"]>>(...args: T)` tuple pass-through does not compile — `Parameters<>` on a generic method collapses to `never` (indexed access loses the method's own type parameters). Implemented instead by mirroring `registerTool`'s exact generic signature (`OutputArgs`/`InputArgs` type params, importing `ZodRawShapeCompat`/`AnySchema` from `@modelcontextprotocol/sdk/server/zod-compat.js` and `ToolCallback` from `.../server/mcp.js`), confirmed by T008.

**Checkpoint**: `toolGate.ts` exists and exports both functions — user story wiring can now begin

---

## Phase 3: User Story 1 - Disable a single sensitive tool (Priority: P1) 🎯 MVP

**Goal**: An operator can name exactly one existing tool in `MCP_DISABLED_TOOLS` and have it disappear from `tools/list` and fail like an unrecognized tool name if called, while every other tool is unaffected.

**Independent Test**: [quickstart.md](./quickstart.md) §2 (single tool disabled) and §4 (a misspelled/unknown name in the list has no effect).

### Implementation for User Story 1

- [X] T003 [P] [US1] In `frontend/lib/mcp-tools/index.ts`, replace all 8 `server.registerTool(...)` calls (`create_file`, `read_file`, `delete_file`, `create_directory`, `list_directory`, `delete_directory`, `update_file`, `move`) with `registerGatedTool(server, ...)`, importing it from `./toolGate`
- [X] T004 [P] [US1] In `frontend/lib/mcp-tools/engineTools.ts`, replace the `server.registerTool(...)` call inside the `ENGINE_TOOLS` loop (covers `get_os_engine`, `get_os_upgrade`, `get_os_init`) with `registerGatedTool(server, ...)`, importing it from `./toolGate`
- [X] T005 [P] [US1] In `frontend/lib/mcp-tools/messagingTools.ts`, replace both `server.registerTool(...)` calls (`send_email`, `send_telegram_message`) with `registerGatedTool(server, ...)`, importing it from `./toolGate`
- [X] T006 [P] [US1] In `frontend/lib/mcp-tools/inboxTools.ts`, replace the `server.registerTool(...)` call (`get_inbox`) with `registerGatedTool(server, ...)`, importing it from `./toolGate`
- [X] T007 [P] [US1] In `frontend/lib/mcp-tools/treeTools.ts`, replace all 3 `server.registerTool(...)` calls (`list_directory_tree`, `find_files_by_name`, `search_file_content`) with `registerGatedTool(server, ...)`, importing it from `./toolGate`
- [X] T008 [US1] Run `cd frontend && npx tsc --noEmit` (or `npm run build`) to confirm `registerGatedTool`'s generic pass-through type-checks at all 17 call sites — the one real technical risk flagged in research.md §2; fix any inference gap in `toolGate.ts` if it fails (depends on T003-T007). Confirmed clean after the T002 signature deviation above.
- [ ] T009 [US1] Follow [quickstart.md](./quickstart.md) §2 and §4 against the local dev server (`docker compose up -d`, `npm run dev`) to confirm: `send_email` alone in `MCP_DISABLED_TOOLS` disappears from `tools/list`, calling it fails identically to an unrecognized tool name, every other tool is unaffected, and adding a nonexistent name alongside it changes nothing extra (depends on T008) — **not run**: requires an interactive MCP client session against a running dev server, left for manual verification

**Checkpoint**: Single-tool disable works end-to-end for any of the 17 tools — this is the MVP

---

## Phase 4: User Story 2 - Disable several tools at once (Priority: P2)

**Goal**: An operator can list multiple tool names — up to the entire catalog — in the same configuration value.

**Independent Test**: [quickstart.md](./quickstart.md) §3 (two tools together) and §5 (every tool disabled at once).

**Note**: No new code — `isToolEnabled`'s `Set<string>` lookup (T002) already handles any number of names. These tasks are validation only.

- [ ] T010 [US2] Follow [quickstart.md](./quickstart.md) §3: set `MCP_DISABLED_TOOLS=send_email, send_telegram_message` (note the space, confirming whitespace is trimmed), confirm both are absent from `tools/list` and every other tool remains present (depends on T009) — **not run**: same reason as T009
- [ ] T011 [US2] Follow [quickstart.md](./quickstart.md) §5: set `MCP_DISABLED_TOOLS` to all 17 tool names, confirm the server still starts successfully and `tools/list` returns empty (depends on T009) — **not run**: same reason as T009

**Checkpoint**: Multi-tool and full-catalog disable both confirmed working via the same mechanism

---

## Phase 5: User Story 3 - Unset configuration changes nothing (Priority: P3)

**Goal**: A deployment that never sets `MCP_DISABLED_TOOLS` sees zero behavior change from this feature.

**Independent Test**: [quickstart.md](./quickstart.md) §1 (no configuration set).

**Note**: No new code — this validates the default (empty-string ⇒ empty `Set`) path already implemented in T002.

- [ ] T012 [US3] Follow [quickstart.md](./quickstart.md) §1: with `MCP_DISABLED_TOOLS` absent from `frontend/.env.local`, confirm `tools/list` returns all 17 tools, identical to pre-feature behavior (depends on T009) — **not run**: same reason as T009

**Checkpoint**: All three user stories independently verified — feature complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Keep deployment-facing docs in sync with the new configuration surface

- [X] T013 [P] Update `README.md`'s deployment environment-variable list (the line enumerating `S3_ENDPOINT`, `S3_REGION`, ..., `MCP_BOOTSTRAP_PATH`/`OS_NAME`) to add `MCP_DISABLED_TOOLS`, and add a short paragraph near the existing `MCP_BOOTSTRAP_PATH` explanation describing the feature, linking to [quickstart.md](./quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: No dependencies — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T002)
- **User Story 2 (Phase 4)**: Depends on Phase 3 completing (T009) — reuses the same wiring, not a separate implementation
- **User Story 3 (Phase 5)**: Depends on Phase 3 completing (T009) — same reason
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Within Phase 3 (User Story 1)

- T003-T007 (wiring, one per existing file) are independent of each other — [P]
- T008 (typecheck) depends on all of T003-T007
- T009 (manual verification) depends on T008

### Parallel Opportunities

- T003, T004, T005, T006, T007 can run in parallel (five different files, each only imports from the new `toolGate.ts`)
- T010 and T011 (Phase 4) can run in parallel with each other, and with T012 (Phase 5) — all three are read-only verification passes against an already-implemented mechanism, each restarting the dev server with a different `MCP_DISABLED_TOOLS` value

---

## Parallel Example: User Story 1

```bash
# After T002 (toolGate.ts) exists, wire all five registration modules together:
Task: "Wire registerGatedTool into frontend/lib/mcp-tools/index.ts"
Task: "Wire registerGatedTool into frontend/lib/mcp-tools/engineTools.ts"
Task: "Wire registerGatedTool into frontend/lib/mcp-tools/messagingTools.ts"
Task: "Wire registerGatedTool into frontend/lib/mcp-tools/inboxTools.ts"
Task: "Wire registerGatedTool into frontend/lib/mcp-tools/treeTools.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002) — this is the entire mechanism
3. Complete Phase 3: User Story 1 (T003-T009) — wire it into all 5 modules and verify
4. **STOP and VALIDATE**: any single one of the 17 tools can be disabled independently
5. This already delivers the full FR-006 scope (every tool addressable), since the mechanism is not story-specific

### Incremental Delivery

1. Setup + Foundational + User Story 1 → full MVP, already covers every tool individually
2. User Story 2 → same code, new configuration values validated (multi-name, full-catalog)
3. User Story 3 → same code, the "do nothing" default path validated
4. Polish → README updated for operators deploying this

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature's low task count per story (vs. the template's illustrative examples) reflects its actual shape: one small shared mechanism (Phase 2) applied identically everywhere (Phase 3), with later "stories" validating different inputs to that same mechanism rather than adding new code
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
