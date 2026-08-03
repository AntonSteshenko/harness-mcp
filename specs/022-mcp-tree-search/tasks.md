---

description: "Task list template for feature implementation"
---

# Tasks: MCP Tree Search Tools

**Input**: Design documents from `/specs/022-mcp-tree-search/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/mcp-tools-tree.md](./contracts/mcp-tools-tree.md)

**Tests**: Not included — this repo has no automated test framework (research.md §7); verification is the manual [quickstart.md](./quickstart.md) walkthrough, run in the Polish phase.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes its exact file path

## Path Conventions

Single Next.js app at `frontend/` (no separate backend/frontend split — see plan.md Project Structure). New code lands in `frontend/lib/storage/tree.ts` (shared traversal) and `frontend/lib/mcp-tools/treeTools.ts` (tool registration), following the existing `engineTools.ts`/`messagingTools.ts`/`inboxTools.ts` pattern.

---

## Phase 1: Setup

**Purpose**: Create the new files this feature lands in and wire them into the server, before any real logic exists.

- [X] T001 Create `frontend/lib/storage/tree.ts` with the `TreeEntry` and `WalkResult` type exports from data-model.md (no logic yet)
- [X] T002 Create `frontend/lib/mcp-tools/treeTools.ts` exporting an empty `registerTreeTools(server: McpServer): Promise<void>` (mirroring `frontend/lib/mcp-tools/inboxTools.ts`'s shape, no tools registered yet)
- [X] T003 Wire `registerTreeTools` into `frontend/app/mcp/route.ts`: import it and add `await registerTreeTools(server);` alongside the existing `registerTools`/`registerEngineTools`/`registerMessagingTools`/`registerInboxTools` calls (route.ts:18-24)

**Checkpoint**: New files exist and are registered (registering zero tools) — the server still starts and every existing tool behaves exactly as before.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared traversal helper every one of the three tools is built on (research.md §1-§3).

**⚠️ CRITICAL**: No user story task can begin until this phase is complete — all three tools call `walkTree`.

- [X] T004 In `frontend/lib/storage/tree.ts`, add the `MAX_TREE_ENTRIES` constant (proposed 500, research.md §3) and implement `walkTree(path: string): Promise<WalkResult>` as a BFS over `listDirectory` (`frontend/lib/storage/directories.ts:38-71`), generalizing the existing `listFilesRecursive` (`directories.ts:141-162`) to collect **both** files and directories (not just `.md` files) as `TreeEntry[]`, inheriting `listDirectory`'s `not_found`/`type_mismatch` errors on the root `path` for free
- [X] T005 In the same `walkTree`, stop enqueuing/collecting once `MAX_TREE_ENTRIES` is reached and set `truncated: true` on the returned `WalkResult` (FR-012)
- [X] T006 In the same `walkTree`, import `isUnderTrash` from `frontend/lib/storage/trash.ts` and skip any directory before it's queued, and any file before it's collected, when `isUnderTrash(entry.path)` is true (FR-011)

**Checkpoint**: `walkTree(path)` is fully implemented and can be called directly (e.g. from a scratch script) to confirm it returns a correct, capped, Trash-free subtree before any MCP tool wraps it.

---

## Phase 3: User Story 1 - See a whole subtree in one call (Priority: P1) 🎯 MVP

**Goal**: A connected assistant retrieves the entire nested structure of a directory in one call instead of one `list_directory` call per level.

**Independent Test**: Run quickstart.md §1 — `list_directory_tree` on a known multi-level directory returns every descendant at every depth in one response, and gives the same `not_found`/`type_mismatch` errors `list_directory` already gives for a missing path / a file path.

### Implementation for User Story 1

- [X] T007 [US1] In `frontend/lib/mcp-tools/treeTools.ts`, register the `list_directory_tree` tool: Zod input schema `{ path: z.string() }` (matching `list_directory`'s own schema style in `frontend/lib/mcp-tools/index.ts:107-127`), calling `walkTree(path)` and mapping its `WalkResult` to the contract's `{ path, entries, truncated }` output (contracts/mcp-tools-tree.md)
- [X] T008 [US1] Wrap the handler in the existing `ok(...)`/`errorResult(err)` pattern (`frontend/lib/mcp-tools/result.ts`, same as every existing tool in `index.ts`) so `not_found`/`type_mismatch`/`storage_unreachable` surface identically to the existing tools
- [X] T009 [US1] Add the tool's `title`/`description` using `buildEntryDescription`/`getBootstrapFraming` (`frontend/lib/mcp-tools/bootstrap.ts`, same as every read-oriented tool in `index.ts`) so it participates in the spec 010 dynamic-description framing

**Checkpoint**: User Story 1 is fully functional and independently testable — `list_directory_tree` works end-to-end against the local MinIO stack.

---

## Phase 4: User Story 2 - Find a file or folder by name (Priority: P2)

**Goal**: A connected assistant finds a file/directory by (partial) name anywhere in the tree without knowing its path.

**Independent Test**: Run quickstart.md §2 — searching by exact and partial name returns the matching path(s); searching a non-existent name returns an empty list, not an error; an empty/whitespace query is rejected.

### Implementation for User Story 2

- [X] T010 [P] [US2] In `frontend/lib/storage/tree.ts`, add a `matchesName(entry: TreeEntry, query: string): boolean` helper — case-insensitive substring match against the entry's final path segment only, not the full path (research.md §4)
- [X] T011 [US2] In `frontend/lib/mcp-tools/treeTools.ts`, register the `find_files_by_name` tool: Zod input schema `{ query: z.string().trim().min(1), path: z.string().optional() }` (FR-010 validation, FR-008 default), calling `walkTree(path ?? "")` then filtering with `matchesName`, mapping matches to the contract's `{ query, matches, truncated }` output (matches reuse the `TreeEntry` shape directly, per data-model.md's `NameMatch`)
- [X] T012 [US2] Wrap the handler in `ok(...)`/`errorResult(err)` and add `title`/`description` via `buildEntryDescription`/`getBootstrapFraming`, same as T008/T009

**Checkpoint**: User Stories 1 and 2 both work independently — `find_files_by_name` works end-to-end without affecting `list_directory_tree`.

---

## Phase 5: User Story 3 - Find Markdown files by content (Priority: P3)

**Goal**: A connected assistant finds a Markdown file by a keyword in its body.

**Independent Test**: Run quickstart.md §3 — searching a keyword present in one file's body returns that file's path with a snippet; a keyword present nowhere returns an empty list; a non-Markdown file containing the same text is never returned.

### Implementation for User Story 3

- [X] T013 [P] [US3] In `frontend/lib/storage/tree.ts`, add a `buildSnippet(content: string, query: string): string` helper that returns a short excerpt of `content` around the first case-insensitive match of `query` (data-model.md's `ContentMatch.snippet`)
- [X] T014 [US3] In `frontend/lib/mcp-tools/treeTools.ts`, register the `search_file_content` tool: same Zod input schema as `find_files_by_name` (`query`/`path`), calling `walkTree(path ?? "")`, filtering to files whose path ends in `.md` (case-insensitive), then for up to `MAX_TREE_ENTRIES` of those calling `readFile` (`frontend/lib/storage/files.ts`) inside a per-file `try/catch` that skips (rather than fails the whole search) any file that can't be read/decoded (FR-007), checking each file's content for a case-insensitive match of `query`, and building `{ path, snippet }` via `buildSnippet` for each match
- [X] T015 [US3] Wrap the handler in `ok(...)`/`errorResult(err)` and add `title`/`description` via `buildEntryDescription`/`getBootstrapFraming`, same as T008/T009/T012

**Checkpoint**: All three user stories now work independently — the full tree-search tool surface (contracts/mcp-tools-tree.md) is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistency and end-to-end validation across all three tools.

- [X] T016 [P] Update the root `README.md`'s "S3 Storage MCP Server" section to mention the three new tree/search tools and link `specs/022-mcp-tree-search/contracts/mcp-tools-tree.md`, matching how that section already links specs/002 and specs/011
- [X] T017 Re-read `frontend/lib/storage/tree.ts` and `frontend/lib/mcp-tools/treeTools.ts` end-to-end and confirm none of the 8 existing tools' files (`frontend/lib/mcp-tools/index.ts`, `frontend/lib/storage/directories.ts`, `files.ts`, `move.ts`, `errors.ts`, `trash.ts`) were modified beyond `listFilesRecursive`'s untouched, pre-existing code (SC-005) — confirmed via `git diff --stat`: only `frontend/app/mcp/route.ts` changed among existing files (+2 lines: import + registration call)
- [ ] T018 **Skipped by explicit user decision** — `frontend/.env.local` targets a live external R2 bucket (`demo-test`), not the local MinIO stack, so running quickstart.md's create/delete scenarios would write to real external storage. `npm run dev` would also collide with an unrelated container already bound to port 3000. Deferred to the user to validate manually (locally, against an isolated MinIO bucket, or however they prefer) whenever convenient.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T003) — BLOCKS all three user stories (all three tools call `walkTree`)
- **User Stories (Phase 3-5)**: All depend on Foundational (T004-T006) completion
  - US1, US2, US3 touch the same two files (`tree.ts`, `treeTools.ts`) but add independent functions/tool registrations — safe to do sequentially in priority order (recommended) or in parallel with care around merge conflicts in the same files
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: Depends only on Foundational — reuses `walkTree` (not US1's tool code); independently testable without `list_directory_tree` existing
- **User Story 3 (P3)**: Depends only on Foundational — reuses `walkTree` (not US1/US2's tool code); independently testable without the other two tools existing

### Within Each User Story

- Traversal/filter helper (in `tree.ts`) before the tool registration that calls it
- Tool registration before its description/framing polish

### Parallel Opportunities

- T010 (US2's `matchesName` helper) and T013 (US3's `buildSnippet` helper) touch the same file (`tree.ts`) but different functions — parallelizable by different people with a shared merge afterward
- T016 (README update) can run in parallel with T017/T018 since it touches a different file

---

## Parallel Example: Foundational → User Stories

```bash
# After T001-T006 (Setup + Foundational) are done, US1/US2/US3 implementation
# can proceed in any order since each only adds new functions/registrations:
Task: "Register list_directory_tree tool in frontend/lib/mcp-tools/treeTools.ts (T007)"
Task: "Add matchesName helper in frontend/lib/storage/tree.ts (T010)"
Task: "Add buildSnippet helper in frontend/lib/storage/tree.ts (T013)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006) — critical, blocks everything else
3. Complete Phase 3: User Story 1 (T007-T009)
4. **STOP and VALIDATE**: run quickstart.md §1 against a real multi-level directory
5. `list_directory_tree` alone already delivers the core reported problem's fix (one call instead of N)

### Incremental Delivery

1. Setup + Foundational → shared `walkTree` ready
2. Add User Story 1 (`list_directory_tree`) → validate via quickstart §1 (MVP)
3. Add User Story 2 (`find_files_by_name`) → validate via quickstart §2
4. Add User Story 3 (`search_file_content`) → validate via quickstart §3
5. Polish (README, self-review, full quickstart run including Trash exclusion in §4)

---

## Notes

- No test tasks: this repo has no automated test framework (research.md §7); `quickstart.md` is the verification artifact
- [P] tasks touch different files, or different functions within the same shared `tree.ts` file — check for merge conflicts before running truly in parallel
- Each user story is independently completable: none of US1/US2/US3's tool registrations depend on another story's tool existing, only on the shared Foundational `walkTree`
- Commit after each task or logical group
- None of the 8 pre-existing MCP tools are touched (SC-005) — verified explicitly in T017
