---

description: "Task list for Configurable S3-Compatible Storage Connection"
---

# Tasks: Configurable S3-Compatible Storage Connection

**Input**: Design documents from `/specs/007-s3-storage-config/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/storage-env-contract.md, quickstart.md

**Tests**: Not requested in spec.md; no test tasks are included. Validation is via the quickstart.md walkthrough (manual).

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

## Path Conventions

Single Next.js application at `frontend/` (per plan.md Project Structure) — all paths below are under `frontend/` unless noted otherwise.

---

## Phase 1: Setup

**Purpose**: Environment documentation needed before any story can be manually validated

- [X] T001 [P] Create `frontend/.env.example` documenting `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, and `S3_FORCE_PATH_STYLE`, with default values matching `docker-compose.yml`'s fixed local MinIO credentials (`http://localhost:9000`, `minioadmin`/`minioadmin`, bucket `mcp-storage`, `forcePathStyle=true`) per contracts/storage-env-contract.md

**Checkpoint**: `.env.example` exists and documents every variable the rest of this feature reads.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types/error class that every user story's code depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Define the `StorageConnectionConfig` TypeScript interface (`endpoint`, `region`, `accessKeyId`, `secretAccessKey`, `bucket`, `forcePathStyle`) in `frontend/lib/storage/config.ts` per data-model.md
- [X] T003 [P] Add a `StorageConfigError` class to `frontend/lib/storage/errors.ts` for startup-time misconfiguration/connectivity failures, alongside the existing `StorageError` (research.md §6)

**Checkpoint**: Foundation ready — `StorageConnectionConfig` type and `StorageConfigError` exist; user story implementation can now begin.

---

## Phase 3: User Story 1 - Point the system at any S3-compatible storage via configuration (Priority: P1) 🎯 MVP

**Goal**: Configure connection details for any S3-compatible provider via environment variables and have the app connect to it successfully at startup, with switching providers requiring only an env change + restart.

**Independent Test**: Supply a complete, valid set of `S3_*` env vars for a reachable S3-compatible provider (e.g. the local MinIO instance), start the app, and confirm storage operations succeed against it; then point the same env vars at a different provider, restart, and confirm operations now succeed against the new one — with zero code changes either time.

### Implementation for User Story 1

- [X] T004 [US1] Implement `readStorageConfig()` in `frontend/lib/storage/config.ts`: read `S3_ENDPOINT`, `S3_REGION` (default `"us-east-1"`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, and `S3_FORCE_PATH_STYLE` (default `"true"`) from `process.env` into a `StorageConnectionConfig`, tolerating missing/empty values without throwing — see research.md §7 for why this must never throw (depends on T002)
- [X] T005 [US1] Rewrite `frontend/lib/storage/client.ts` to construct `s3Client` (endpoint, region, credentials, `forcePathStyle`) and export `BUCKET` from `readStorageConfig()`'s result, replacing the current hardcoded MinIO-only values (depends on T004)
- [X] T006 [US1] In `frontend/lib/storage/client.ts`, replace the existing auto-create-on-missing-bucket `ensureBucket()` with a `verifyStorageConnection()` function that issues a single `HeadBucketCommand` against the configured bucket and resolves on success, per research.md §3 (depends on T005)
- [X] T007 [US1] Create `frontend/instrumentation.ts` exporting a `register()` function that calls `verifyStorageConnection()` once at process startup, per research.md §2 — also calls `process.exit(1)` on failure after logging, since Next.js otherwise leaves a failed-instrumentation server running and 500ing every request rather than actually stopping (discovered during validation; see quickstart.md testing) (depends on T006)

**Checkpoint**: At this point, User Story 1 is fully functional — the app connects to whichever S3-compatible provider is configured via env vars, and switching providers requires only an env change + restart (quickstart.md §1, §5).

---

## Phase 4: User Story 2 - Fail fast on misconfiguration (Priority: P2)

**Goal**: Missing required settings, an unreachable endpoint, rejected credentials, or a missing bucket all cause startup to fail immediately with a clear, actionable, secret-free error — instead of starting broken or failing later on first use.

**Independent Test**: Start the app with a required env var missing, then with an unreachable endpoint, then with wrong credentials, then with a nonexistent bucket; confirm each case fails startup immediately with a distinct, clear error message that never contains a secret value.

### Implementation for User Story 2

- [X] T008 [US2] Implement `validateStorageConfig()` in `frontend/lib/storage/config.ts` to validate that `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET` are present and non-empty, that `S3_ENDPOINT` parses as an `http:`/`https:` URL, and that `S3_FORCE_PATH_STYLE` (if set) is `"true"` or `"false"` — throwing `StorageConfigError` naming every missing/invalid field, called from `verifyStorageConnection()` (depends on T004; data-model.md Validation rules)
- [X] T009 [US2] Extend `verifyStorageConnection()` in `frontend/lib/storage/client.ts` to distinguish the `HeadBucketCommand` outcome into three cases — network/DNS failure, credential rejection, and bucket-not-found — throwing a `StorageConfigError` with a distinct, clear message for each, per data-model.md's Connectivity check table (depends on T006)
- [X] T010 [US2] Review every `StorageConfigError` thrown by T008/T009 and confirm none includes `accessKeyId`/`secretAccessKey` values — messages reference only env var names (depends on T008, T009; FR-008, research.md §6). Verified live: startup with a wrong `S3_SECRET_ACCESS_KEY` prints only "were rejected by the storage endpoint", never the value.

**Checkpoint**: At this point, User Stories 1 AND 2 both work — valid config connects successfully, and every documented misconfiguration case fails fast with a clear, secret-free error (quickstart.md §2, §3, §4, §7).

---

## Phase 5: User Story 3 - Existing storage features keep working regardless of provider (Priority: P3)

**Goal**: Every existing file/directory operation exposed through the MCP server and the web file explorer behaves identically no matter which configured S3-compatible provider is active.

**Independent Test**: Run the existing spec 002 MCP tool test walkthrough and the web file explorer manually, once against the local self-hosted storage, and confirm every operation's behavior is unchanged from before this feature.

### Implementation for User Story 3

- [X] T011 [P] [US3] Remove the now-redundant `ensureBucket()` calls and import from `frontend/lib/storage/files.ts` (depends on T007)
- [X] T012 [P] [US3] Remove the now-redundant `ensureBucket()` calls and import from `frontend/lib/storage/directories.ts` (depends on T007)
- [X] T013 [P] [US3] Remove the now-redundant `ensureBucket()` calls and import from `frontend/lib/storage/move.ts` (depends on T007)
- [X] T014 [P] [US3] Remove the now-redundant `ensureBucket()` calls and import from `frontend/lib/storage/paths.ts` (depends on T007) — turned out to be a no-op: `paths.ts` never imported `ensureBucket()` in the first place, so no change was needed there.
- [X] T015 [US3] Run the full `specs/002-s3-mcp-server/quickstart.md` walkthrough (§1–§6) and manually exercise the web file explorer (create/edit/delete a file and a folder), confirming identical behavior to before this feature (depends on T011, T012, T013, T014; quickstart.md §6). Verified via `/api/file` create→read→update→delete round trip and `/api/tree` against the running local MinIO — identical responses/status codes to pre-feature behavior.

**Checkpoint**: All user stories are now independently functional — configuration is externalized (US1), misconfiguration fails fast (US2), and existing consumers are provably unaffected (US3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final end-to-end validation

- [X] T016 [P] Update root `README.md` to document `frontend/.env.example`, the new `S3_*` variables, and the one-time bucket-must-exist step for local dev (research.md §1, §3). Also trimmed the now-obsolete `MCP_STORAGE_BUCKET` var out of the repo-root `.env.example` (it was never actually read by Next.js — see research.md §1 — and is fully superseded by `frontend/.env.example`'s `S3_BUCKET`).
- [X] T017 Run `specs/007-s3-storage-config/quickstart.md` end-to-end (all 7 scenarios), confirming every acceptance scenario in spec.md passes (depends on T001–T016). All 7 scenarios verified live against `next start` + local MinIO: normal startup, missing-var, unreachable-endpoint, wrong-credentials, missing-bucket, invalid-`S3_FORCE_PATH_STYLE`, and the full create/read/update/delete round trip — each behaved exactly as documented, and no secret value ever appeared in an error message.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: No dependencies — can start immediately, in parallel with Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion (T002, T003)
- **User Story 2 (Phase 4)**: Depends on User Story 1's `readStorageConfig()`/`verifyStorageConnection()` existing (T004, T006) — extends rather than duplicates them
- **User Story 3 (Phase 5)**: Depends on User Story 1's `instrumentation.ts` existing (T007), since it removes the per-call checks that startup validation now supersedes
- **Polish (Phase 6)**: Depends on all prior phases

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — this is the MVP.
- **User Story 2 (P2)**: Builds directly on US1's `config.ts`/`client.ts` (adds validation to the same functions rather than introducing new ones) — cannot be meaningfully implemented before US1, but does not change US1's happy-path behavior.
- **User Story 3 (P3)**: Builds on US1's `instrumentation.ts` startup check (removes now-redundant per-call checks it replaces) — independently testable once US1 exists, regardless of whether US2's stricter validation has been added yet.

### Within Each User Story

- Foundational types/errors before config loading
- Config loading before client construction
- Client construction before startup wiring
- Story complete before moving to the next priority

### Parallel Opportunities

- T001 (Setup) can run in parallel with T002/T003 (Foundational) — different files, no shared dependency
- T002 and T003 (Foundational) can run in parallel — different files
- T011, T012, T013, T014 (US3 cleanup) can all run in parallel — four independent files

---

## Parallel Example: Foundational Phase

```bash
# Launch both foundational tasks together:
Task: "Define the StorageConnectionConfig TypeScript interface in frontend/lib/storage/config.ts"
Task: "Add a StorageConfigError class to frontend/lib/storage/errors.ts"
```

## Parallel Example: User Story 3

```bash
# Launch all four cleanup tasks together:
Task: "Remove the now-redundant ensureBucket() calls and import from frontend/lib/storage/files.ts"
Task: "Remove the now-redundant ensureBucket() calls and import from frontend/lib/storage/directories.ts"
Task: "Remove the now-redundant ensureBucket() calls and import from frontend/lib/storage/move.ts"
Task: "Remove the now-redundant ensureBucket() calls and import from frontend/lib/storage/paths.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T004–T007)
4. **STOP and VALIDATE**: Run quickstart.md §1 and §5 — confirm the app connects to a configured provider and switching providers works with just an env change + restart
5. Demo if ready — note that without US2, bad config still fails, just not necessarily with a clear/immediate message yet

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate (quickstart.md §1, §5) → MVP demo-able
3. Add User Story 2 → validate (quickstart.md §2, §3, §4, §7) → misconfiguration now fails fast and clean
4. Add User Story 3 → validate (quickstart.md §6) → existing MCP/file-explorer behavior confirmed unaffected
5. Polish (T016, T017) → README updated, full quickstart re-run end-to-end

---

## Notes

- No test tasks are included — spec.md did not request tests, and per project instruction tests are not to be executed as part of this workflow.
- [P] tasks touch different files with no dependency between them.
- Every task names an exact file path so it is directly actionable.
- Commit after each task or logical group, consistent with prior features in this repo.
