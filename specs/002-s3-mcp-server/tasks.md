---

description: "Task list template for feature implementation"
---

# Tasks: S3 Storage MCP Server

**Input**: Design documents from `/specs/002-s3-mcp-server/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not requested in the feature specification. Verification is done via the `quickstart.md` scripted MCP tool-call walkthrough (research.md §9), consistent with spec 001's approach. Each user story phase below ends with quickstart-execution tasks that serve as its acceptance check.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Per plan.md's Project Structure — a single Next.js App Router project at the repository root (this feature introduces the repo's first `package.json`):

- `app/mcp/route.ts` — the MCP-over-HTTP endpoint
- `app/layout.tsx` — minimal required App Router root layout
- `lib/storage/client.ts`, `lib/storage/files.ts`, `lib/storage/directories.ts`, `lib/storage/move.ts`, `lib/storage/errors.ts`
- `lib/mcp-tools/index.ts` — tool definitions matching `contracts/mcp-tools.md`
- `.env.example`, `package.json`, `tsconfig.json`, `next.config.ts`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize a Next.js (App Router, TypeScript) project at the repository root: `package.json`, `tsconfig.json`, `next.config.ts`, minimal `app/layout.tsx`
- [X] T002 Install primary dependencies into the project created in T001: `mcp-handler`, `@modelcontextprotocol/sdk`, `@aws-sdk/client-s3`, `zod` (plan.md Technical Context)
- [X] T003 [P] Create `.env.example` documenting `MINIO_API_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (read by `lib/storage/client.ts`, matching spec 001's `.env.example` conventions)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Storage client, shared error handling, and the (initially empty) MCP route that every user story plugs into

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create `lib/storage/client.ts`: construct an `@aws-sdk/client-s3` `S3Client` against `http://localhost:${MINIO_API_PORT:-9000}` with `forcePathStyle: true` and credentials from `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` (research.md §2)
- [X] T005 [P] Create `lib/storage/errors.ts`: shared error helpers/types for the four error codes in contracts/mcp-tools.md's "Common error shape" (`not_found`, `type_mismatch`, `already_exists`, `storage_unreachable`)
- [X] T006 [P] Create `lib/mcp-tools/index.ts` skeleton: export an (initially empty) MCP tool registry that `app/mcp/route.ts` will import
- [X] T007 Create `app/mcp/route.ts`: wire `mcp-handler` to expose the Streamable HTTP MCP endpoint, registering the (currently empty) tool registry from `lib/mcp-tools/index.ts` (research.md §1); confirm the route responds to an MCP client handshake with zero tools

**Checkpoint**: Foundation ready - S3 client, error shape, and MCP route all exist and connect; user story implementation can now begin

---

## Phase 3: User Story 1 - Basic file operations (Priority: P1) 🎯 MVP

**Goal**: An MCP client can create, read, and delete individual files through MCP tools, with clear "not found" errors — no directories or modification yet.

**Independent Test**: `specs/002-s3-mcp-server/quickstart.md` Section 1 (create → read → delete → read-again-expect-not-found).

### Implementation for User Story 1

- [X] T008 [US1] Implement `createFile` in `lib/storage/files.ts`: `PutObject`; reject with `already_exists` if a directory marker exists at the same path (contracts/mcp-tools.md `create_file`, FR-002, FR-012)
- [X] T009 [US1] Implement `readFile` in `lib/storage/files.ts`: `GetObject`; `not_found` if missing; `type_mismatch` if the path is a directory (contracts/mcp-tools.md `read_file`, FR-003, FR-011)
- [X] T010 [US1] Implement `deleteFile` in `lib/storage/files.ts`: `DeleteObject`; `not_found` if missing; `type_mismatch` if the path is a directory (contracts/mcp-tools.md `delete_file`, FR-005, FR-011)
- [X] T011 [US1] Wire `storage_unreachable` error mapping (using `lib/storage/errors.ts` from T005) into `createFile`/`readFile`/`deleteFile` in `lib/storage/files.ts` for S3 connectivity failures (Edge Cases)
- [X] T012 [US1] Register the `create_file`, `read_file`, `delete_file` MCP tools with Zod input schemas in `lib/mcp-tools/index.ts`, matching contracts/mcp-tools.md exactly

### Validation for User Story 1

- [X] T013 [US1] Execute `specs/002-s3-mcp-server/quickstart.md` Section 1 against `npm run dev` plus the running spec 001 storage stack; confirm SC-001, SC-005

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Directory operations (Priority: P2)

**Goal**: An MCP client can create, list, and recursively delete directories, including ones that are empty or deeply nested.

**Independent Test**: `specs/002-s3-mcp-server/quickstart.md` Section 2 (empty directory persists and lists; nested files/subdirectories list one level at a time; recursive delete leaves zero orphans).

### Implementation for User Story 2

- [X] T014 [US2] Implement `createDirectory` in `lib/storage/directories.ts`: `PutObject` a zero-byte marker at `<path>/`; idempotent if it already exists; `already_exists` if a file exists at the same path (research.md §3, contracts/mcp-tools.md `create_directory`, FR-007, FR-012)
- [X] T015 [US2] Implement `listDirectory` in `lib/storage/directories.ts`: `ListObjectsV2` with `Delimiter: "/"` and `Prefix: path`; map `Contents` → files and `CommonPrefixes` → directories; `not_found` if nothing exists at that prefix; `type_mismatch` if the path is a file (research.md §3, contracts/mcp-tools.md `list_directory`, FR-006, FR-011)
- [X] T016 [US2] Implement `deleteDirectory` in `lib/storage/directories.ts`: paginated `ListObjectsV2` without a delimiter under the prefix, then batched `DeleteObjects` (≤1000 keys per batch, looping); `not_found` if missing; `type_mismatch` if the path is a file (research.md §4, contracts/mcp-tools.md `delete_directory`, FR-008)
- [X] T017 [US2] Register the `create_directory`, `list_directory`, `delete_directory` MCP tools with Zod input schemas in `lib/mcp-tools/index.ts`, matching contracts/mcp-tools.md exactly

### Validation for User Story 2

- [X] T018 [US2] Execute `specs/002-s3-mcp-server/quickstart.md` Section 2; confirm SC-002 (5+ levels deep navigable) and SC-003 (zero orphaned files after recursive delete of 100 files)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Modify and reorganize (Priority: P3)

**Goal**: An MCP client can overwrite an existing file's content and move/rename both files and directories.

**Independent Test**: `specs/002-s3-mcp-server/quickstart.md` Section 3 (modify a file's content; move a file; move a directory with contents).

### Implementation for User Story 3

- [X] T019 [US3] Implement `updateFile` in `lib/storage/files.ts`: `PutObject` only if a file already exists at the path; `not_found` if missing; `type_mismatch` if the path is a directory (contracts/mcp-tools.md `update_file`, FR-004, FR-011)
- [X] T020 [P] [US3] Implement `move` in `lib/storage/move.ts`: detect whether `sourcePath` is a File or Directory; for a File, `CopyObject` then `DeleteObject`; for a Directory, recursively list then `CopyObject` every key before batch-`DeleteObjects`-ing the old keys (copy-before-delete ordering); `not_found` if source missing; `already_exists` if destination is occupied (research.md §5, contracts/mcp-tools.md `move`, FR-009, FR-010)
- [X] T021 [US3] Register the `update_file` and `move` MCP tools with Zod input schemas in `lib/mcp-tools/index.ts`, matching contracts/mcp-tools.md exactly (depends on T019, T020)

### Validation for User Story 3

- [X] T022 [US3] Execute `specs/002-s3-mcp-server/quickstart.md` Section 3; confirm all three acceptance scenarios (modify, move file, move directory) pass

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Error-contract consistency, resilience, and documentation tying the three stories together

- [X] T023 Execute `specs/002-s3-mcp-server/quickstart.md` Section 4 (type-collision and error-code checks across `create_file`/`create_directory`/`read_file`); fix any inconsistency against contracts/mcp-tools.md's error codes
- [X] T024 Execute `specs/002-s3-mcp-server/quickstart.md` Section 5 (stop the spec 001 storage stack, confirm every tool returns `storage_unreachable` promptly rather than hanging); adjust `lib/storage/client.ts`/`lib/storage/errors.ts` if any call hangs instead of failing fast
- [X] T025 Execute `specs/002-s3-mcp-server/quickstart.md` Section 6 (time a full create → read → update → delete cycle on a small file); confirm SC-004 (<2s per call)
- [X] T026 [P] Add a "Getting Started" section to `README.md` documenting `npm install` + `npm run dev` for this MCP server, its dependency on the spec 001 storage stack being up, and the MCP endpoint URL
- [X] T027 Cross-check `lib/mcp-tools/index.ts` and `lib/storage/*.ts` against `specs/002-s3-mcp-server/contracts/mcp-tools.md` for tool-name/schema/error-code consistency and fix any drift

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed), since each owns a distinct `lib/storage/*.ts` file (files.ts / directories.ts / move.ts)
  - Recommended order is still priority order (P1 → P2 → P3) since all three register tools into the same `lib/mcp-tools/index.ts`, and US3's `updateFile` extends the same `files.ts` file US1 creates
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - independently testable via its own `directories.ts` file; only converges with US1 at the shared `lib/mcp-tools/index.ts` registration step
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - `move` (`lib/storage/move.ts`) is a new, independent file; `updateFile` extends `lib/storage/files.ts` from US1, so in practice runs after US1's file tasks land

### Within Each User Story

- Implementation before validation
- Storage-adapter functions (`lib/storage/*.ts`) before MCP tool registration (`lib/mcp-tools/index.ts`)
- Story complete before moving to next priority

### Parallel Opportunities

- T003 (`.env.example`) can run in parallel with T001/T002 (different file)
- T004, T005, T006 (Foundational: `client.ts`, `errors.ts`, `mcp-tools/index.ts` skeleton) can all run in parallel — three different files
- T020 (`lib/storage/move.ts`) can run in parallel with T019 (`lib/storage/files.ts`) — different files
- Across stories: once Foundational is done, US1 (`files.ts`), US2 (`directories.ts`), and US3's `move.ts` portion touch different files and could be staffed in parallel; only the final tool-registration task of each story (which all edit `lib/mcp-tools/index.ts`) needs to serialize relative to each other

---

## Parallel Example: Foundational Phase

```bash
# Launch these together (three different files):
Task: "Create lib/storage/client.ts: S3Client against MinIO with forcePathStyle: true"
Task: "Create lib/storage/errors.ts: shared error-code helpers"
Task: "Create lib/mcp-tools/index.ts skeleton: empty tool registry"
```

## Parallel Example: User Story 3

```bash
# Launch these together (different files):
Task: "Implement move in lib/storage/move.ts (copy-then-delete for files and directories)"
# ...while T019 proceeds against lib/storage/files.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md Section 1 independently
5. At this point an MCP client can already create/read/delete individual files — directories and in-place modification land in the next increments

### Incremental Delivery

1. Complete Setup + Foundational → MCP route + storage client ready
2. Add User Story 1 → validate independently → basic file CRUD works (MVP!)
3. Add User Story 2 → validate independently → directories (create/list/recursive-delete) work
4. Add User Story 3 → validate independently → modify + move work
5. Each story adds value without breaking previous stories, since each owns its own `lib/storage/*.ts` file

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test framework is introduced by this feature; verification is via the scripted `quickstart.md` walkthrough (research.md §9)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- This feature depends on the spec 001 storage stack being up (`docker compose up -d` from the repo root) before any quickstart validation step
