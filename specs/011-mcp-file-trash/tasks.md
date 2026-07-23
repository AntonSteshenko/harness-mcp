---

description: "Task list template for feature implementation"
---

# Tasks: MCP File Trash

**Input**: Design documents from `/specs/011-mcp-file-trash/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature (plan.md Testing: no automated test suite in this project; validated via `quickstart.md`'s scripted MCP tool-call sequence, consistent with specs 001/002/005). No test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User Story 1 (soft-delete a file) and User Story 2 (soft-delete a directory) are both Priority P1 and together form the MVP; User Story 3 (permanent delete from Trash) is also P1 but is delivered as a side effect of US1/US2's branch logic, so its phase is validation-only; User Story 4 (inspect/restore with existing tools) is P2 and requires no code changes at all.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at `frontend/` (same app as specs 002/003/005/etc.): `frontend/lib/storage/`, `frontend/lib/mcp-tools/`. No `tests/` directory — no automated tests requested. No new dependencies are introduced (research.md), so there is no Setup phase — implementation starts directly at Foundational.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The shared Trash path helpers both `deleteFile` and `deleteDirectory` branch on

**⚠️ CRITICAL**: Complete before starting any user story phase

- [X] T001 Create `frontend/lib/storage/trash.ts` exporting `isUnderTrash(path: string): boolean` and `trashDestinationFor(path: string): string` (research.md §2-§3). `isUnderTrash` normalizes `path` via the existing `normalizeDirectoryPath` (import from `./paths`) and returns `true` if the normalized value equals `"Trash/"` or starts with `"Trash/"` — a case-sensitive, full-segment prefix check (so `TrashCan/notes.md` is `false`). `trashDestinationFor` generates a per-call `opId` as `` `${timestamp}-${random}` `` where `timestamp` is `new Date().toISOString()` with every `-`, `:`, and `.` character stripped (e.g. `20260723T140522123Z`) and `random` is 6 hex characters from Node's built-in `crypto.randomBytes(3).toString("hex")` (`import { randomBytes } from "node:crypto"`), then returns `` `Trash/${opId}/${normalizeFilePath(path)}` `` (import `normalizeFilePath` from `./paths`)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 2: User Story 1 - Soft-delete a file (Priority: P1) 🎯 MVP

**Goal**: `delete_file` moves a file into a per-deletion timestamped subfolder under `Trash` instead of permanently deleting it, when called on a path outside `Trash`.

**Independent Test**: Call `delete_file` on an existing file outside `Trash` and confirm it disappears from its original path but is readable, with identical content, at the returned `trashedTo` path (quickstart.md step 1).

### Implementation for User Story 1

- [X] T002 [US1] Modify `deleteFile` in `frontend/lib/storage/files.ts`: after the existing `not_found`/`type_mismatch` checks, branch on `isUnderTrash(path)` (import from `./trash`) — if `false`, call the existing `move` (import from `./move`) with `destinationPath: trashDestinationFor(path)` instead of the current `DeleteObjectCommand` call, and return `{ path, deleted: true, permanent: false, trashedTo: trashDestinationFor(path) }`; if `true`, keep the current `DeleteObjectCommand` call unchanged and return `{ path, deleted: true, permanent: true }` (no `trashedTo`). Update the function's JSDoc to also reference spec 011 FR-001, FR-003, FR-005 (contracts/mcp-tools-trash.md `delete_file`)
- [X] T003 [US1] Update the `delete_file` tool's `description` string in `frontend/lib/mcp-tools/index.ts` (currently `"Deletes the file at path."`) to state that a path outside `Trash` is moved into `Trash` instead of being deleted, and a path already under `Trash` is deleted for real (contracts/mcp-tools-trash.md `delete_file`)

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md step 1). As a side effect, the file half of User Story 3's hard-delete behavior is now also working — it is formally validated in Phase 4.

---

## Phase 3: User Story 2 - Soft-delete a directory (Priority: P1)

**Goal**: `delete_directory` moves an entire subtree into a per-deletion timestamped subfolder under `Trash` instead of permanently deleting it, when called on a path outside `Trash`, preserving the subtree's internal structure.

**Independent Test**: Call `delete_directory` on a folder containing nested files/subfolders outside `Trash` and confirm the whole subtree is now listable under the returned `trashedTo` path with the same structure, and gone from its original location (quickstart.md step 2).

### Implementation for User Story 2

- [X] T004 [US2] Modify `deleteDirectory` in `frontend/lib/storage/directories.ts`: keep the existing key-listing loop that builds `allKeys` and the `filesRemoved` count unchanged, but branch after it on `isUnderTrash(path)` (import from `./trash`) — if `true`, keep the existing batched `DeleteObjectsCommand` loop unchanged and return `{ path, deleted: true, permanent: true, filesRemoved }`; if `false`, call the existing `move` (import from `./move`) with `destinationPath: trashDestinationFor(path)` in place of the batched delete, and return `{ path, deleted: true, permanent: false, filesRemoved, trashedTo: trashDestinationFor(path) }`. Update the function's JSDoc to also reference spec 011 FR-002, FR-003, FR-006 (contracts/mcp-tools-trash.md `delete_directory`; data-model.md notes `delete_directory("Trash")` naturally satisfies "empty Trash" via the `permanent: true` branch, since `isUnderTrash("Trash")` is `true`)
- [X] T005 [US2] Update the `delete_directory` tool's `description` string in `frontend/lib/mcp-tools/index.ts` (currently `"Deletes the directory at path and everything inside it, recursively."`) to state the same Trash-aware behavior as T003, plus that calling it on `"Trash"` itself empties Trash permanently in one call (contracts/mcp-tools-trash.md `delete_directory`)

**Checkpoint**: User Stories 1 AND 2 (the P1 MVP) both work independently (quickstart.md steps 1-2). As a side effect, the directory half of User Story 3 (including the "empty Trash" special case) and every prerequisite of User Story 4 are also now in place — formally validated in Phases 4-5.

---

## Phase 4: User Story 3 - Permanently delete an already-trashed item (Priority: P1)

**Goal**: Confirm `delete_file`/`delete_directory`, when called on a path already under `Trash` (including `Trash` itself), permanently remove it — delivered by the branches added in T002 (US1) and T004 (US2); this phase adds no further storage-layer code.

**Independent Test**: Soft-delete a file and a directory, then call `delete_file`/`delete_directory` again on their `trashedTo` paths and confirm permanent removal; then call `delete_directory({ path: "Trash" })` and confirm it empties Trash entirely (quickstart.md steps 5-6).

### Validation for User Story 3

- [X] T006 [US3] ~~Run quickstart.md steps 5 and 6 end-to-end against a local `next dev` + MinIO stack~~ — validated 2026-07-23 against the live deployed instance (real R2-backed bucket) instead, using disposable `trash-feature-test*` paths with full cleanup: soft-deleted a file and a directory, then called `delete_file`/`delete_directory` again on their `trashedTo` paths — both returned `permanent: true` with no `trashedTo`, and the paths were confirmed gone afterward. The literal "`delete_directory({ path: "Trash" })` empties everything" case was intentionally **not** exercised against the live bucket (risk of destroying any other real content that might be in `Trash`) — but the identical `isUnderTrash → permanent` code branch was exercised via `delete_directory` on a specific `Trash/<opId>/` subfolder, which is the same code path scoped narrower. No discrepancies found.

**Checkpoint**: All three P1 stories (US1, US2, US3) are independently functional — Trash is no longer a one-way holding area; content can be made permanently gone on demand.

---

## Phase 5: User Story 4 - Inspect and recover trashed items with existing tools (Priority: P2)

**Goal**: Confirm `list_directory` surfaces `Trash` contents and `move` can restore a trashed item to its original (or any) location — both tools are unmodified by this feature; this phase is validation-only.

**Independent Test**: After soft-deleting a file, list `Trash` to see it, then use `move` to relocate it back out of `Trash` to its original path, and confirm it's readable there again (quickstart.md steps 3-4).

### Validation for User Story 4

- [X] T007 [US4] Run quickstart.md steps 3 and 4 end-to-end — validated 2026-07-23 against the live deployed instance: `list_directory({ path: "Trash" })` showed both `opId` subfolders from prior soft-deletes; `move` with `sourcePath` set to a `trashedTo` value and `destinationPath` set back to the original path fully restored the file (`read_file` confirmed identical content). No code changes were needed, as expected

**Checkpoint**: All four user stories are independently functional — the full Trash workflow (soft-delete, hard-delete, inspect, restore) works end-to-end using the two modified tools plus two pre-existing, untouched tools.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across the whole feature, including the collision-safety guarantee and confirming the web editor needs no changes

- [X] T008 [P] ~~Run the full `quickstart.md` walkthrough end-to-end~~ — step 7 (collision safety) validated 2026-07-23 against the live deployed instance: soft-deleted the same original path (`trash-feature-test/collide.txt`) twice back-to-back and got two distinct `trashedTo`/`opId` values, no `already_exists` errors (FR-007), then permanently cleaned up both trashed copies. Step 8 (web editor still works, FR-010) was confirmed by code inspection only, not click-tested in a browser — `frontend/app/api/file/route.ts` and `frontend/app/api/directory/route.ts` call `deleteFile`/`deleteDirectory` directly with no other changes needed, so they inherit the new Trash-aware behavior automatically

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories.
- **User Stories (Phase 2-5)**: All depend on Foundational phase completion (T001).
- **Polish (Phase 6)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational (T001) — touches `frontend/lib/storage/files.ts` and the `delete_file` entry in `frontend/lib/mcp-tools/index.ts`, independent of User Story 2's files
- **User Story 2 (P1)**: Depends only on Foundational (T001) — touches `frontend/lib/storage/directories.ts` and the `delete_directory` entry in `frontend/lib/mcp-tools/index.ts`; can be built in parallel with User Story 1 by a different contributor
- **User Story 3 (P1)**: Depends on both User Story 1 (T002) and User Story 2 (T004) already being implemented — it validates their combined behavior rather than adding new code
- **User Story 4 (P2)**: Depends on User Story 1 and/or User Story 2 having produced at least one trashed item to inspect/restore, but requires no code changes of its own

### Parallel Opportunities

- T002 (`files.ts`) and T004 (`directories.ts`) are different files with no dependency on each other and can be implemented in parallel once T001 is done
- T003 and T005 both edit `frontend/lib/mcp-tools/index.ts` in different, non-overlapping tool registrations — coordinate merges but no logical dependency between them
- User Story 1 (Phase 2) and User Story 2 (Phase 3) can proceed fully in parallel once Phase 1 is done

---

## Parallel Example: User Story 1 vs. User Story 2

```bash
# After Phase 1 (T001), these two independent P1 slices can proceed in parallel:
Task: "User Story 1 — deleteFile Trash branch + delete_file description (T002-T003)"
Task: "User Story 2 — deleteDirectory Trash branch + delete_directory description (T004-T005)"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — both P1)

1. Complete Phase 1: Foundational (T001)
2. Complete Phase 2: User Story 1 (soft-delete a file)
3. Complete Phase 3: User Story 2 (soft-delete a directory) — independent of Phase 2, can be done in either order or in parallel
4. **STOP and VALIDATE**: quickstart.md steps 1-2
5. Deploy/demo the MVP — accidental permanent data loss on a single delete call is already eliminated

### Incremental Delivery

1. Foundational (T001) → foundation ready
2. Add User Story 1 → validate independently (quickstart.md step 1)
3. Add User Story 2 → validate independently (quickstart.md step 2) — MVP complete
4. Add User Story 3 → validate the hard-delete side effect (quickstart.md steps 5-6)
5. Add User Story 4 → validate inspect/restore (quickstart.md steps 3-4)
6. Polish (Phase 6) → full quickstart.md walkthrough, including collision safety and the web-editor no-change confirmation

---

## Notes

- [P] tasks touch different files with no ordering dependency on incomplete work
- [Story] label maps each task to its user story for traceability
- User Story 3 and User Story 4 intentionally contain no new implementation tasks — their behavior is a direct consequence of the single Trash-aware branch added to `deleteFile`/`deleteDirectory` in User Story 1/2, per research.md §1 (deliberately putting the branch in the shared storage layer rather than duplicating it per-tool)
- Verify each user story against its quickstart.md steps before moving to the next
- Commit after each task or logical group
