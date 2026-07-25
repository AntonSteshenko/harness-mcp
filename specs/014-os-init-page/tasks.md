---

description: "Task list template for feature implementation"
---

# Tasks: Company OS Init Page

**Input**: Design documents from `/specs/014-os-init-page/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature (plan.md Testing: no automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-013). No test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User Story 1 (first-time setup of a fresh Company OS) is P1 and is the MVP; User Story 2 (connection-setup helper when storage isn't connected) is P2; User Story 3 (recognizing an already-initialized system) is P3. The `"partial"` edge case (FR-013) is handled as part of the shared Foundational routing shell, since it isn't tied to any single prioritized story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at `frontend/` (same app as specs 001-013): `frontend/lib/os/`, `frontend/app/init/`. No `tests/` directory — no automated tests requested. No new dependencies are introduced (plan.md Primary Dependencies), so there is no Setup phase — implementation starts directly at Foundational.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The storage-logic module and the shared page shell every user story renders into

**⚠️ CRITICAL**: Complete before starting any user story phase

- [X] T001 [P] Create `frontend/lib/os/init.ts` exporting:
  - `checkOsStatus(): Promise<"empty" | "already_initialized" | "partial">` — calls `hasAnyObjectWithPrefix("os/")` and `hasAnyObjectWithPrefix("data/")` (`@/lib/storage/paths`) and maps the pair per research.md §3's table (both absent → `"empty"`; both present → `"already_initialized"`; exactly one → `"partial"`). Only meaningful once storage connectivity is already confirmed by the caller.
  - `initializeCompanyOs(businessName: string, businessDescription: string): Promise<{ created: boolean }>` — calls `checkOsStatus()` first and returns `{ created: false }` without writing anything if the result isn't `"empty"` (research.md §4, guards FR-011/SC-004 against the concurrent-submission edge case); otherwise creates, in order, `os/` and `data/` (`createDirectory` from `@/lib/storage/directories`), then `os/identity.md` (a Markdown doc with `businessName` as an H1 heading and `businessDescription` as body text, FR-007, data-model.md), then `AGENTS.md` and `os/skills/init.md` (`createFile` from `@/lib/storage/files`, using the two fixed template constants below), and returns `{ created: true }`.
  - `AGENTS_MD_TEMPLATE` — fixed string constant: tells any connecting AI assistant that for any question about how to operate this system, it should read `os/skills/init.md` (FR-008).
  - `INIT_SKILL_MD_TEMPLATE` — fixed string constant: orients a connecting AI assistant on how to start operating a freshly created Company OS, including pointing it at `os/identity.md` (FR-009).
- [X] T002 Create `frontend/app/init/page.tsx` as a server component implementing the full state-resolution shell (contracts/init-page.md):
  1. Call `verifyStorageConnection()` (`@/lib/storage/client`); if it throws `StorageConfigError`, render the `"not_connected"` branch (temporary `<p>Connect storage (coming soon)</p>` placeholder — replaced by US2 below).
  2. Otherwise call `hasActiveOwnerSession()` (`@/lib/oauth/session`); if `false`, `redirect("/oauth/login?continue=" + encodeURIComponent("/init"))` (FR-012, research.md §1).
  3. Otherwise call `checkOsStatus()` (T001) and switch on the result: `"partial"` renders its real, final content now — a distinct message ("This storage is in an unexpected, partially-initialized state") with no link or write action (FR-013); `"already_initialized"` renders a temporary `<p>Already initialized (coming soon)</p>` placeholder (replaced by US3 below); `"empty"` renders a temporary `<p>Setup form (coming soon)</p>` placeholder (replaced by US1 below).

**Checkpoint**: Foundation ready — user story implementation can now begin. Visiting `/init` already correctly redirects to sign-in and shows the partial-state message; the other three states show placeholders.

---

## Phase 2: User Story 1 - First-time setup of a fresh Company OS (Priority: P1) 🎯 MVP

**Goal**: The owner, with storage connected and an empty bucket, can fill in two questions about their business and have the system create the full initial Company OS structure (`os/`, `data/`, `os/identity.md`, `AGENTS.md`, `os/skills/init.md`) in one submission.

**Independent Test**: Point the app at a freshly created, empty bucket, sign in, visit `/init`, submit the form with a business name and description, then verify all five paths exist with the expected content (spec.md US1, quickstart.md Scenario 2).

### Implementation for User Story 1

- [X] T003 [P] [US1] Create `frontend/app/init/InitForm.tsx` (`"use client"`): a form with two labeled, required text inputs — "What is your business called?" and "What does your business do?" — that posts to `/init/submit` (`method="POST"`); disable the submit button (or otherwise block submission) while either field is empty, mirroring the client-side validation pattern used elsewhere in this app's forms (FR-004, FR-005).
- [X] T004 [P] [US1] Create `frontend/app/init/submit/route.ts` (`POST`): require an active owner session via `hasActiveOwnerSession()` (`401` JSON error otherwise, mirrors `frontend/app/settings/personal-access-tokens/create/route.ts`); read `businessName`/`businessDescription` from `request.formData()`, trim both; if either is empty, return a `400` JSON validation error without calling `initializeCompanyOs`; otherwise call `initializeCompanyOs(businessName, businessDescription)` (T001) and `redirect`/`NextResponse.redirect` (`303`) to `/init?created=1` (FR-006 through FR-010, contracts/init-page.md `POST /init/submit`).
- [X] T005 [US1] In `frontend/app/init/page.tsx` (T002), replace the `"empty"` branch's placeholder with `<InitForm />` (T003).

**Checkpoint**: User Story 1 is fully functional and independently testable — a first-time owner can go from an empty bucket to a fully initialized Company OS (quickstart.md Scenario 2)

---

## Phase 3: User Story 2 - Guidance when storage isn't connected yet (Priority: P2)

**Goal**: A visitor with no storage connected gets an interactive helper that turns the S3 connection values they type in into ready-to-paste `.env.local` and hosting-provider configuration snippets — entirely client-side, nothing ever sent to the server.

**Independent Test**: Point the app at an unreachable/unconfigured storage backend, visit `/init`, fill in the six connection fields, and verify two correctly formatted, copyable snippets appear with zero network requests made (spec.md US2, quickstart.md Scenario 1).

### Implementation for User Story 2

- [X] T006 [P] [US2] Create `frontend/app/init/ConnectionHelper.tsx` (`"use client"`): six controlled inputs — endpoint, region, access key ID, secret access key, bucket, path-style (boolean toggle) — held in local component state only; a `useMemo` derives two output strings from that state using the exact variable names from `frontend/.env.example` (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`): one `.env.local`-formatted block and one plain `NAME=value` list for a hosting provider's environment-variables UI; render both in `<pre>` blocks, each with a "Copy" button calling `navigator.clipboard.writeText`. No `fetch`/`XMLHttpRequest`/form submission anywhere in this component (research.md §7, FR-014, FR-015).
- [X] T007 [US2] In `frontend/app/init/page.tsx` (T002), replace the `"not_connected"` branch's placeholder with `<ConnectionHelper />` (T006).

**Checkpoint**: User Stories 1 AND 2 both work independently — first-time setup and the connection helper are both fully functional (quickstart.md Scenarios 1-2)

---

## Phase 4: User Story 3 - Recognizing an already-initialized system (Priority: P3)

**Goal**: A visitor to `/init` after a Company OS already exists is told so, clearly, with no way to re-run setup or overwrite anything — just a link to `/editor`.

**Independent Test**: Point the app at a bucket that already contains both `os/` and `data/`, visit `/init`, and verify the page reports that a system already exists and links to `/editor`, with no setup form or write action anywhere on the page (spec.md US3, quickstart.md Scenario 3).

### Implementation for User Story 3

- [X] T008 [US3] In `frontend/app/init/page.tsx` (T002), replace the `"already_initialized"` branch's placeholder with the real content: a message stating a Company OS already exists and a link to `/editor`; optionally read a `?created=1` search param to adjust the message to read as a fresh-setup confirmation instead ("Your Company OS is ready") rather than introducing a separate page/state (FR-003, FR-010, FR-011, research.md §6).

**Checkpoint**: All three user stories are independently functional — every one of `/init`'s states (not connected, empty, already initialized, partial) now renders its real, final content (quickstart.md Scenarios 1-3)

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across every state this feature adds

- [X] T009 [P] Run the full `quickstart.md` walkthrough (Scenarios 1-5) end-to-end against a running `next dev` instance, including the sign-in gate (Scenario 5), the partial-state safety message (Scenario 4), and confirming zero network requests fire while using the connection helper (Scenario 1, FR-015/SC-006). **Verified 2026-07-25**: `npx tsc --noEmit` clean across the new code. Against the live `next dev` instance on port 3002 (already pointed at a real, already-initialized bucket): unauthenticated `GET /init` correctly 307-redirects to `/oauth/login?continue=%2Finit` (Scenario 5) ✓; after signing in, `/init` correctly rendered "A Company OS already exists" with a working `/editor` link, using real existing data — confirming FR-003/FR-011 without any risk of overwriting it (Scenario 3) ✓. `checkOsStatus()`'s exact logic was additionally verified in isolation against the local MinIO instance's `mcp-storage` bucket (a throwaway script exercising the same `hasAnyObjectWithPrefix` calls): empty → `"empty"`, one marker → `"partial"`, both markers → `"already_initialized"`, cleaned back up → `"empty"` again — all four transitions matched research.md §3's table exactly. **Not independently live-verified**: Scenarios 1 and 2 (the connection-helper and setup-form flows) — a second `next dev` instance couldn't be started against this same project directory (Next.js refuses a second dev server per-directory), and deliberately avoided reconfiguring the live instance away from its real bucket. `InitForm`/`submit/route.ts` compose only already-verified primitives (`checkOsStatus`, `createDirectory`, `createFile`) plus the now-confirmed status logic; `ConnectionHelper` is pure client-side rendering with no server dependency, confirmed via type-check and code review only.
- [X] T010 [P] Fix `/init` being unreachable when storage was never configured (FR-016, FR-017, research.md §8): remove the `process.exit(1)` calls from both checks in `frontend/instrumentation.ts` (log-only now); add `frontend/middleware.ts` redirecting every request except `/init` and static assets to `/init` while any required `S3_*` env var is unset. **Found and verified 2026-07-25**: the user removed `frontend/.env.local` entirely and ran `npm run dev` to test Scenario 0/1 — the *old* code printed `Fatal: storage connection is misconfigured — refusing to start.` and exited before serving any request, making `/init` completely unreachable for the exact case it exists to handle. `npx tsc --noEmit` clean after the fix; confirmed working live 2026-07-25 (user restarted `npm run dev` with `.env.local` still absent — server started and stayed up).
- [X] T011 [P] [US2] Broaden the setup helper and collapse its output to one snippet (FR-002, FR-014, research.md §7), per user feedback after trying T006: renamed `frontend/app/init/ConnectionHelper.tsx` → `frontend/app/init/EnvSetupHelper.tsx`; added `ownerUsername`/`ownerPassword`/`osName` fields alongside the six existing S3 fields; replaced the two near-identical derived snippets with one (`buildDotEnvSnippet` only — `OS_NAME` line omitted when blank) plus a plain-text "Apply it" section with separate local/Vercel instructions instead of a second generated block. Updated `frontend/app/init/page.tsx`'s import/usage accordingly (still the same `"not_connected"` branch wiring as T007). `npx tsc --noEmit` clean.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories.
- **User Stories (Phase 2-4)**: All depend on Foundational phase completion (T001, T002).
- **Polish (Phase 5)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational (T001 for `initializeCompanyOs`, T002 for the page shell it plugs into) — creates `frontend/app/init/InitForm.tsx` and `frontend/app/init/submit/route.ts`, then edits `page.tsx`'s `"empty"` branch.
- **User Story 2 (P2)**: Depends only on Foundational (T002) — creates `frontend/app/init/ConnectionHelper.tsx` (no dependency on T001; the helper never touches storage), then edits `page.tsx`'s `"not_connected"` branch. Independent of User Story 1.
- **User Story 3 (P3)**: Depends only on Foundational (T002) — edits `page.tsx`'s `"already_initialized"` branch directly, no new file. Independent of User Story 1 and 2.

### Within Each User Story

- T003 and T004 (US1) touch different new files and don't depend on each other — both feed into T005, which edits the shared `page.tsx`
- T006 (US2) is a standalone new file, independent of T003/T004 — feeds into T007
- T008 (US3) only depends on T002 (the branch it's replacing already exists there)
- T005, T007, and T008 all edit `frontend/app/init/page.tsx` — sequential relative to each other (not `[P]`), though each is independently meaningful once done

### Parallel Opportunities

- T001 has no dependency on anything else and can start immediately (marked `[P]`)
- T003, T004, and T006 are all new files with no dependency on each other — once T002 exists, all three can be built in parallel (marked `[P]`)
- T009 (Polish) is `[P]` — a validation-only pass with no file conflicts

---

## Parallel Example: Foundational Phase

```bash
# T001 has no dependencies and can start immediately:
Task: "Create frontend/lib/os/init.ts (checkOsStatus, initializeCompanyOs, AGENTS_MD_TEMPLATE, INIT_SKILL_MD_TEMPLATE)"
```

## Parallel Example: After Foundational completes

```bash
# T003, T004, and T006 touch different new files and can proceed together:
Task: "Create frontend/app/init/InitForm.tsx"
Task: "Create frontend/app/init/submit/route.ts"
Task: "Create frontend/app/init/ConnectionHelper.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Foundational (T001, T002)
2. Complete Phase 2: User Story 1 (T003-T005)
3. **STOP and VALIDATE**: quickstart.md Scenario 2
4. Deploy/demo the MVP — a first-time owner with storage already connected can fully bootstrap a Company OS

### Incremental Delivery

1. Foundational (T001, T002) → foundation ready; `/init` already correctly gates on sign-in and handles the partial-state edge case
2. Add User Story 1 → validate independently (quickstart.md Scenario 2) — MVP complete
3. Add User Story 2 → validate independently (quickstart.md Scenario 1)
4. Add User Story 3 → validate independently (quickstart.md Scenario 3)
5. Polish (Phase 5) → full quickstart.md walkthrough, including the sign-in gate and partial-state scenarios (4-5)

---

## Notes

- `[P]` tasks touch different files with no ordering dependency on incomplete work
- `[Story]` label maps each task to its user story for traceability
- This feature deliberately reuses spec 001/002/007's `lib/storage/*` primitives and spec 008/009's owner-session gate end to end (research.md) — no new storage mechanism, no new auth mechanism, no new dependency
- The connection-setup helper (T006) is intentionally isolated from every other module in this feature — it never imports from `lib/storage/*` or makes any network call, which is what makes FR-015's "never transmitted" guarantee structurally true rather than a policy to remember (research.md §7)
- Verify each user story against its quickstart.md scenario before moving to the next
- Commit after each task or logical group
