---

description: "Task list for feature implementation"
---

# Tasks: Dedicated Frontend Folder for Vercel Readiness

**Input**: Design documents from `/specs/006-frontend-folder-structure/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested for this feature (no test suite exists in this repo, consistent with specs 001-005). Validation is performed via the manual quickstart.md walkthroughs referenced below.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes exact file/folder paths, relative to the repository root

## Path Conventions

Repository-root reorganization (see plan.md "Project Structure"): the Next.js app moves from the repo root into a new `frontend/` folder; `docker-compose.yml`, `data/`, `scripts/`, `.env.example`, `specs/`, `.specify/`, `CLAUDE.md`, `README.md` stay at the repo root (data-model.md path mapping table).

---

## Phase 1: Setup

**Purpose**: Pre-flight checks and the destination folder

- [X] T001 Verify the git working tree is clean (`git status --short` at repository root shows nothing unexpected) before starting the reorganization
- [X] T002 Create the destination folder: `mkdir frontend` at the repository root

**Checkpoint**: Ready to move files.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The actual move — every user story's validation depends on this being done first

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 `git mv app frontend/app` — moves the entire Next.js `app/` directory (UI, API routes, MCP route) into `frontend/app/`
- [X] T004 [P] `git mv lib frontend/lib` — moves `lib/storage/*` and `lib/mcp-tools/*` into `frontend/lib/`
- [X] T005 [P] `git mv next.config.ts frontend/next.config.ts`
- [X] T006 [P] `git mv next-env.d.ts frontend/next-env.d.ts` — note: this file is git-ignored (untracked), so a plain `mv` was used instead of `git mv` (which refuses untracked sources)
- [X] T007 [P] `git mv tsconfig.json frontend/tsconfig.json`
- [X] T008 [P] `git mv package.json frontend/package.json`
- [X] T009 [P] `git mv package-lock.json frontend/package-lock.json`
- [X] T010 Remove the git-ignored build artifacts left behind at the repository root now that their tracked source has moved: delete root `node_modules/`, `tsconfig.tsbuildinfo`, and `.next/` (if present) — depends on T003-T009
- [X] T011 Run `npm install` inside `frontend/` to regenerate `frontend/node_modules/` against the moved `frontend/package.json`/`frontend/package-lock.json` — depends on T010

**Checkpoint**: Foundation ready — `frontend/` now contains the whole app; repo root no longer has any Next.js source. User story validation can begin.

---

## Phase 3: User Story 1 - Deploy the Next.js app to Vercel from a subfolder (Priority: P1) 🎯 MVP

**Goal**: Prove `frontend/` is a genuinely self-contained folder that a Vercel project could build with Root Directory set to it.

**Independent Test**: Copy only `frontend/`'s contents to a directory outside the repo and run `npm install && npm run build` there — success with zero references outside that directory proves the folder is self-contained.

### Implementation for User Story 1

- [X] T012 [US1] Run the isolated-build check from quickstart.md §2: copy `frontend/` to a scratch directory outside the repo (e.g. `/tmp/frontend-isolated-check`), remove `node_modules/`/`.next/` inside the copy, then run `npm install && npm run build` there — confirm it succeeds (SC-001, SC-004) — **succeeded**: `next build` compiled and generated all 9 routes with zero references outside the scratch copy
- [X] T013 [US1] If T012 fails on a reference reaching outside `frontend/`, fix that reference inside `frontend/` (contingency task; research.md §1 predicts this won't trigger since no app import currently reaches outside the app's own tree) — not needed, T012 passed cleanly
- [X] T014 [P] [US1] Confirm the repository root no longer contains `app/`, `lib/`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `package.json`, or `package-lock.json`, per the data-model.md path mapping table (SC-003) — confirmed, repo root now contains only `CLAUDE.md`, `README.md`, `data/`, `docker-compose.yml`, `frontend/`, `scripts/`, `specs/`

**Checkpoint**: `frontend/` is proven self-contained and Vercel-Root-Directory-ready. This alone delivers the feature's core motivation (MVP).

---

## Phase 4: User Story 2 - Keep local development workflow working after the move (Priority: P2)

**Goal**: Confirm the existing local dev loop (MinIO via `docker compose`, then the app dev server) is unaffected by the move.

**Independent Test**: Run `docker compose up -d` at the repo root, then `npm run dev` from `frontend/`, and exercise the editor UI and MCP route exactly as before the move.

### Implementation for User Story 2

- [X] T015 [US2] Run `docker compose up -d` from the repository root; confirm MinIO starts and is reachable at the same ports as before the move (quickstart.md §1) — MinIO was already up (`harness-mcp-minio`, healthy, ports 9000-9001), confirming the move didn't disturb it
- [X] T016 [US2] Run `npm run dev` from `frontend/`; manually verify `/editor` (file tree, open/save, create/delete file & folder, upload, zip download — specs 003-005) behaves identically to before the move — smoke-tested via `curl`: `GET /editor` → 200, `GET /api/tree` → valid JSON reading the real MinIO bucket contents
- [X] T017 [P] [US2] Manually verify the MCP route (`frontend/app/mcp/route.ts`) still responds correctly, adapting specs/002-s3-mcp-server/quickstart.md's steps to run from `frontend/` — `GET /mcp` correctly returns a 405 with a JSON-RPC "Method not allowed" body (POST-only endpoint alive and wired, not a 404 routing failure)
- [X] T018 [US2] Run `./scripts/reset-storage.sh` from the repository root; confirm it still resets `data/minio` correctly, unaffected by the move — verified by inspection instead of execution: the script only resolves paths relative to its own location (`docker-compose.yml`, `data/minio`), neither of which moved; not executed here since it destructively wipes real bucket contents already present (an `assistant/` folder) that weren't mine to delete for a verification step

**Checkpoint**: Local dev workflow fully validated post-move — User Stories 1 AND 2 both hold.

---

## Phase 5: User Story 3 - Understand where new code belongs (Priority: P3)

**Goal**: Make the app-root boundary self-evident from the repo's own documentation, per `contracts/repo-layout.md`.

**Independent Test**: `grep -n "frontend" README.md CLAUDE.md` shows at least one line in each explicitly naming `frontend/` as the Next.js app / future Vercel Root Directory.

### Implementation for User Story 3

- [X] T019 [P] [US3] Update `README.md`: state that `frontend/` is the Next.js app (and the folder a future Vercel project's Root Directory should point at), and update any dev-command snippets to run from `frontend/` (e.g. `cd frontend && npm run dev`) (FR-007)
- [X] T020 [P] [US3] Update any project-specific notes in `CLAUDE.md` outside the `<!-- SPECKIT START/END -->` managed block that reference app source paths, so they reflect `frontend/` as the app root (FR-007) — no-op: `CLAUDE.md` has no content outside the managed block; the block itself already points at `specs/006-frontend-folder-structure/plan.md`

**Checkpoint**: All three user stories independently functional; documentation matches the `contracts/repo-layout.md` boundary.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final end-to-end confirmation and cleanup

- [X] T021 [P] Run the full quickstart.md validation end-to-end (all 4 sections) and confirm every expected outcome holds — all 4 confirmed (isolated build, local dev smoke test, root listing, doc grep); noted a pre-existing, unrelated gap: `npm run lint` fails because `eslint` was never a declared dependency in this repo (confirmed via `git show HEAD:package.json` prior to this feature) — not a regression from the move
- [X] T022 Delete the temporary scratch directory created in T012

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (this phase *is* the file move)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion; independently testable once it's done
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: Can start after Foundational — no dependency on US1/US3 (validates a different concern: local dev, not build isolation)
- **User Story 3 (P3)**: Can start after Foundational — no dependency on US1/US2 (pure documentation)

### Within Each User Story

- US1: T012 before T013 (T013 only runs if T012 fails); T014 is independent and parallelizable
- US2: T015 before T016 (dev server assumes MinIO is up); T017 parallelizable with T016; T018 independent
- US3: T019 and T020 are both independent, parallelizable

### Parallel Opportunities

- T004-T009 (Foundational git mv's of independent files) can all run in parallel
- Once Foundational (Phase 2) completes, US1, US2, and US3 phases can all start in parallel (different concerns, no shared files)
- T014 (US1), T017 (US2), T019 + T020 (US3) can run in parallel across stories

---

## Parallel Example: Foundational Phase

```bash
# After T003 (git mv app frontend/app), launch the remaining independent moves together:
git mv lib frontend/lib
git mv next.config.ts frontend/next.config.ts
git mv next-env.d.ts frontend/next-env.d.ts
git mv tsconfig.json frontend/tsconfig.json
git mv package.json frontend/package.json
git mv package-lock.json frontend/package-lock.json
```

## Parallel Example: Across User Stories (post-Foundational)

```bash
# US1: prove isolation
Task: "Copy frontend/ to a scratch dir and run npm install && npm run build there"

# US2: prove local dev still works
Task: "docker compose up -d, then npm run dev from frontend/, verify /editor and MCP route"

# US3: document the new root
Task: "Update README.md and CLAUDE.md to name frontend/ as the app root"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (the move itself — CRITICAL, blocks all stories)
3. Complete Phase 3: User Story 1 (prove `frontend/` is self-contained)
4. **STOP and VALIDATE**: `frontend/` builds in isolation — the core motivation for this feature is satisfied
5. Continue to US2/US3 for full local-dev and documentation coverage

### Incremental Delivery

1. Setup + Foundational → the move is done, repo is in its new layout
2. Add User Story 1 → isolation proven → this is the MVP the feature was requested for
3. Add User Story 2 → local dev loop confirmed unbroken
4. Add User Story 3 → documentation updated, boundary is self-evident to future contributors

### Parallel Team Strategy

With multiple people: one completes Setup + Foundational (the move is a single sequential operation best done by one person to avoid merge conflicts on the same paths), then US1/US2/US3 can be picked up in parallel by different people since they touch disjoint concerns (build isolation vs. local dev vs. documentation).

---

## Notes

- [P] tasks touch different files/paths and have no ordering dependency on each other
- This feature is a structural move, not new code — "implementation" here means executing `git mv` correctly and validating nothing broke, not writing application logic
- Commit after Foundational (the move) as one logical commit before starting story-specific work, so the move itself is easy to review/revert independently of documentation tweaks
- Stop at any checkpoint to validate a story independently before continuing
- Avoid: moving files with plain `mv`/`rm`+recreate instead of `git mv` (loses history), editing app source during the move (scope creep beyond FR-006)
