---

description: "Task list for MCP Binary File Upload Tool"
---

# Tasks: MCP Binary File Upload Tool

**Input**: Design documents from `/specs/029-mcp-binary-upload/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/mcp-tools-binary.md](contracts/mcp-tools-binary.md), [quickstart.md](quickstart.md)

**Tests**: No test tasks are included — spec.md did not request tests, this project has no automated test suite (specs 001–028 validate via `quickstart.md` instead), and per standing user instruction tests are not to be executed as part of this workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Every task names an exact file path

## Path Conventions

Single Next.js project at `frontend/` (plan.md Structure Decision) — all paths below are relative to the repository root, inside `frontend/`.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The new error code and the raised request-body cap are needed by both user stories — nothing else changes yet

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 [P] Add `invalid_content` (mapped to HTTP 400) to `StorageErrorCode` in `frontend/lib/storage/errors.ts`, plus a helper constructor `invalidContent(path, reason)` mirroring the existing `notFound`/`unsupportedType`/`tooLarge` helpers; add `invalid_content: 400` to each `STATUS_BY_CODE: Record<StorageError["code"], number>` map, required for the widened union to type-check (data-model.md). **Correction to task scope**: there are actually **five** such maps, not four — `frontend/app/api/{file,directory,tree,download-zip,file/download}/route.ts` (tasks.md's Phase 1 description omitted the spec-028-era `file/download` route); `tsc --noEmit` confirmed all five (and only these five) needed the update.
- [X] T002 [P] Raised `experimental.proxyClientMaxBodySize` in `frontend/next.config.ts` from `"30mb"` to `"40mb"`, updating the accompanying comment to explain why (base64 inflates a 25 MB file to ≈35 MB; `/mcp` passes through the same proxy layer as every other route, per `middleware.ts`'s matcher) (research.md §7)

**Checkpoint**: New error code compiles cleanly across every route; large MCP payloads won't be silently truncated once the new tools exist to send them.

---

## Phase 2: User Story 1 - Upload a binary file via MCP (Priority: P1) 🎯 MVP

**Goal**: An agent can call a new MCP tool with a target path and base64-encoded content and have it stored as the exact original bytes — rejecting malformed base64, disallowed types, oversized content, and directory collisions before ever writing anything.

**Independent Test**: quickstart.md Scenario 1 (upload + verify via the spec 028 browser download action, no dependency on User Story 2) and Scenario 2 (malformed base64 / disallowed type / oversized content all rejected cleanly).

### Implementation for User Story 1

- [X] T003 [US1] Created `frontend/lib/mcp-tools/binaryFileTools.ts` exporting `registerBinaryFileTools(server, disabledTools)`, following the existing `registerGatedTool` pattern (mirroring `lib/mcp-tools/index.ts`'s `create_file`) — registers `create_binary_file` with input schema `{ path: z.string(), content: z.string().describe("Base64-encoded file content") }`; handler: (1) validates `content` against a strict base64 pattern (`/^[A-Za-z0-9+/]*={0,2}$/` and length divisible by 4) — else `errorResult(invalidContent(...))`; (2) decodes to a `Buffer`; (3) validates the extension/decoded size via `lib/storage/fileTypes.ts`'s `isAllowedExtension`/`MAX_UPLOAD_BYTES` — else `errorResult(unsupportedType(...))`/`errorResult(tooLarge(...))` (the existing spec-028 helpers, not ad-hoc `StorageError`s); (4) calls `createFile(path, buffer, mimeTypeForPath(path))` and returns `ok(result)`, or `errorResult(err)` on a thrown `StorageError` (e.g. `already_exists`) (contracts/mcp-tools-binary.md, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-011) (depends on T001)
- [X] T004 [US1] Imported and called `registerBinaryFileTools(server, disabledTools)` in `frontend/app/mcp/route.ts`, alongside the existing `registerTools`/`registerEngineTools`/etc. calls (FR-008) (depends on T003)
- [X] T005 [US1] Added `{ name: "create_binary_file", group: "File & Directory" }` to `TOOL_CATALOG` in `frontend/lib/mcp-tools/catalog.ts`, so the `/tools` status/toggle page (spec 023/024) lists and can disable it (FR-008) (depends on T003)

**Checkpoint**: User Story 1 is fully functional and independently testable — an agent can upload a binary file via MCP and, once retrieved through the existing spec 028 browser download action, its bytes match the original exactly.

---

## Phase 3: User Story 2 - Read a binary file's content back via MCP (Priority: P2)

**Goal**: An agent can read a binary file's exact content back via a new dedicated MCP tool (base64-encoded, round-trips exactly), while the existing `read_file` tool now rejects binary files with a clear error instead of silently returning corrupted text — text-file behavior through `read_file` is unchanged.

**Independent Test**: quickstart.md Scenario 3 (read a known binary file back via the new tool and confirm byte-for-byte identity after decoding) and Scenario 4 (`read_file` fails clearly on that same binary file; still succeeds normally on a text file).

### Implementation for User Story 2

- [X] T006 [US2] Created `frontend/lib/storage/binaryDetection.ts`: extracted the `BINARY_EXTENSIONS` set, `isConclusivelyBinaryExtension(path)`, and `looksBinaryContent(content)` out of `frontend/app/api/file/route.ts` (spec 028) into this new shared module, exported as-is (no behavior change) (research.md §4)
- [X] T007 [US2] Updated the `GET` handler in `frontend/app/api/file/route.ts` to import `isConclusivelyBinaryExtension`/`looksBinaryContent` from `lib/storage/binaryDetection.ts` (T006) instead of its own local copies; deleted the now-duplicate local definitions — behavior unchanged, purely a de-duplication (research.md §4) (depends on T006)
- [X] T008 [US2] Added `read_binary_file` to `frontend/lib/mcp-tools/binaryFileTools.ts`'s `registerBinaryFileTools` function: input schema `{ path: z.string() }`; handler calls `readFile(path)` and returns `ok({ path, content: result.content.toString("base64"), size, lastModified, etag, contentType })`; no allow-list/size check on read (contracts/mcp-tools-binary.md, FR-009) (depends on T003)
- [X] T009 [US2] Updated `read_file`'s handler in `frontend/lib/mcp-tools/index.ts` to import `isConclusivelyBinaryExtension`/`looksBinaryContent` from `lib/storage/binaryDetection.ts` (T006) and run the same guard `GET /api/file` uses: extension check first (before decoding), content-sniffing fallback on ambiguous extensions; on a binary match, `errorResult(invalidContent(path, ...))` instead of `ok({...content.toString("utf-8")})`; text files unaffected. Also updated the tool's description text to mention the new `invalid_content` failure mode and point callers at `read_binary_file` (contracts/mcp-tools-binary.md, FR-010) (depends on T001, T006)
- [X] T010 [US2] Added `{ name: "read_binary_file", group: "File & Directory" }` to `TOOL_CATALOG` in `frontend/lib/mcp-tools/catalog.ts` (FR-008) (depends on T008)

**Checkpoint**: User Story 2 is independently testable — an agent can read any binary file's exact content back via `read_binary_file`, and `read_file` now fails cleanly (rather than silently corrupting output) when pointed at one, with zero change to its text-file behavior.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole feature end-to-end, including the cross-cutting body-size fix from Phase 1

- [X] T011 Ran the full `quickstart.md` walkthrough end-to-end against local dev (MinIO via `docker compose`, already running; `npm run dev`; a real personal access token created via `/settings/personal-access-tokens/create` and used as the `Authorization: Bearer` header for raw JSON-RPC `curl` calls to `/mcp`, since no MCP client was available): `tools/list` shows both new tools with correct schemas and `read_file`'s updated description; `create_binary_file` on a synthetic PDF round-tripped byte-for-byte (verified both via the spec 028 web download route and via `read_binary_file`'s own base64 output, decoded and diffed against the original — Scenarios 1, 3); invalid base64 and a disallowed `.exe` extension were both rejected cleanly with `isError: true` and the expected `code` (Scenario 2); `read_file` failed with `invalid_content` on the binary PDF while a plain `.txt` file created via `create_file` still read back correctly through `read_file`, unchanged (Scenario 4); both tools appeared on `/tools` (Scenario 5); a 24 MB file (≈33.5 MB base64 payload) uploaded via `create_binary_file` came through with the exact original size and byte-identical content, with no truncation warning in server logs — confirming the `next.config.ts` fix from T002 actually works over the real `/mcp` transport, not just in theory (Scenario 6). Test artifacts (the `qa-029/` folder and the test personal access token) were cleaned up afterward.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS both user stories.
- **User Story 1 (Phase 2)**: Depends on Phase 1 (T001). No dependency on User Story 2.
- **User Story 2 (Phase 3)**: Depends on Phase 1 (T001) and on Phase 2's T003 (both tools live in the same `binaryFileTools.ts` file/function) — not independently startable before US1's T003 lands, but independently *testable* once its own tasks are done, without needing US1's tool to have been exercised.
- **Polish (Phase 4)**: Depends on both user stories being complete.

### Within Each User Story

- US1: T003 (tool implementation) before T004 (wiring into `/mcp`) and T005 (catalog entry) — the latter two can run in parallel once T003 lands.
- US2: T006 (extraction) before T007 (web route uses it) and before T009 (MCP `read_file` uses it) — those two can run in parallel once T006 lands. T008 (new tool) only depends on T003 from US1. T010 (catalog entry) depends on T008.

### Parallel Opportunities

- Phase 1: T001 and T002 in parallel (different files, no shared dependency).
- Once Phase 1 completes and US1's T003 lands: T004 and T005 (US1) can run in parallel; independently, T006 (US2) can start immediately (no dependency on T003).
- Within US2, once T006 lands: T007 and T009 can run in parallel (different files, both just consume T006's exports).
- T008 (US2's new tool) can proceed in parallel with T006/T007/T009 — it only needs T003, not T006.

---

## Parallel Example: Foundational + early User Story 2 work

```bash
# Phase 1, fully parallel:
Task: "Add invalid_content StorageErrorCode + STATUS_BY_CODE updates in frontend/lib/storage/errors.ts and the four web routes"
Task: "Raise proxyClientMaxBodySize in frontend/next.config.ts"

# Once T003 (US1) lands, T006 (US2) can already be underway in parallel — it has no dependency on T003:
Task: "Extract binary detection into frontend/lib/storage/binaryDetection.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Foundational
2. Complete Phase 2: User Story 1 (upload)
3. **STOP and VALIDATE**: run quickstart.md Scenarios 1, 2, 6
4. Deploy/demo — agents can now upload binary content via MCP, verifiable through the existing spec 028 browser download action even without User Story 2

### Incremental Delivery

1. Foundational → Phase 2 (US1) → validate → this is the MVP
2. Add Phase 3 (US2 — read back via MCP, and `read_file`'s corrected binary behavior) → validate independently (quickstart Scenarios 3, 4) → deploy/demo
3. Phase 4 (full quickstart pass, including `/tools` visibility and the large-payload check) → ship

### Parallel Team Strategy

With multiple contributors:

1. Team completes Phase 1 (Foundational) together — trivial, two independent one-file changes
2. One contributor takes Phase 2 (US1); once T003 lands, a second contributor can start Phase 3 (US2) — T006 (the extraction) doesn't even need to wait for T003, only T008/T010 do
3. Coordinate on `frontend/lib/mcp-tools/binaryFileTools.ts` (touched by both T003 and T008) to avoid a merge conflict — the two tools are independent handlers within one `registerBinaryFileTools` function

---

## Notes

- No test tasks: this project has no automated test suite; `quickstart.md` is the validation mechanism (T011).
- [P] tasks touch different files with no incomplete dependency.
- [Story] labels map every implementation task to spec.md's US1/US2 for traceability.
- Commit after each task or logical group, per repo convention (see recent commit history).
- Stop at each phase checkpoint to validate that user story independently before moving on.
