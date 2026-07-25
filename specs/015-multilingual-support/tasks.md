---

description: "Task list for Multilingual Company OS Setup"
---

# Tasks: Multilingual Company OS Setup

**Input**: Design documents from `/specs/015-multilingual-support/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not requested — this project has no automated test suite (research.md §9); validation is via `quickstart.md`'s manual scenarios (Final Phase, below).

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on another task in the same batch)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to the repository root (`/develop/harness-mcp`)

## Path Conventions

Single Next.js app at `frontend/` (established by specs 001-014) — all paths below are under `frontend/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Directory scaffolding this feature needs before any real code is written

- [X] T001 Create `frontend/lib/i18n/` (with a `dictionaries/` subfolder) and `frontend/lib/os/templates/{en,it,ru,fr,de,es}/` directories, per plan.md's Project Structure.
- [X] T002 Move the existing `frontend/lib/os/templates/AGENTS.md` (English) to `frontend/lib/os/templates/en/AGENTS.md`, and the existing `frontend/lib/os/templates/init.md` (Italian) to `frontend/lib/os/templates/it/init.md.orig` as the untouched source text the translation tasks below start from (research.md §4). (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The language-resolution primitives and the first two (of six) skeleton template variants that every user story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Implement `SUPPORTED_LANGUAGES` and the `SupportedLanguage` type in `frontend/lib/i18n/languages.ts` — the six codes with native/English display names (data-model.md "Supported Language", research.md §1).
- [X] T004 [P] Implement `detectBrowserLanguage(acceptLanguageHeader: string | null): SupportedLanguage` in `frontend/lib/i18n/detect.ts`, per the mapping table in contracts/language-resolution.md (research.md §2).
- [X] T005 Implement `getSystemLanguage()` and `resolveLanguage()` in `frontend/lib/i18n/resolve.ts`, wrapped in React `cache()`, composing the existing `checkOsStatus()` (`frontend/lib/os/init.ts`) and `readFile("os/language")` (`frontend/lib/storage/files.ts`) per the three-way decision table in contracts/language-resolution.md (research.md §7). (depends on T003, T004)
- [X] T006 [P] Apply the fixed-English-name rename table (research.md §4: `giornata.md`→`daily-plan.md`, `stato-progetti.md`→`project-status.md`, `articolo.md`→`article.md`, `proposta-commerciale.md`→`commercial-proposal.md`, `onboarding-cliente.md`→`client-onboarding.md`, `prodotto.md`→`product.md`, `comunicazione.md`→`communication.md`, `cliente.md`→`client.md`) to `frontend/lib/os/templates/it/init.md.orig`, writing the result to `frontend/lib/os/templates/it/init.md` — same Italian prose, every renamed file/folder reference now fixed-English. (depends on T002)
- [X] T007 [P] Translate `frontend/lib/os/templates/it/init.md` (post-rename) into English, writing `frontend/lib/os/templates/en/init.md` — this becomes the canonical reference every other language's file/folder names must match exactly (research.md §4). (depends on T006)
- [X] T008 [P] Translate `frontend/lib/os/templates/en/AGENTS.md` into Italian, writing `frontend/lib/os/templates/it/AGENTS.md`. (depends on T002)
- [X] T009 Update `initializeCompanyOs()` in `frontend/lib/os/init.ts` to accept a `language: SupportedLanguage` parameter, read the matching `frontend/lib/os/templates/<language>/{AGENTS.md,init.md}` pair, and write `os/language` (content: `language`) alongside the existing `os/`, `data/`, `AGENTS.md`, `os/skills/init.md` writes — still re-checking `checkOsStatus()` first and no-op'ing (`{ created: false }`) otherwise, per contracts/language-resolution.md. (depends on T003, T007, T008)

**Note (deviation from listed order)**: T013-T016 (the Russian/French/German/Spanish template translations, listed under Phase 3 below) were completed alongside T006-T008, before T009, since `initializeCompanyOs()`'s literal per-language `readFileSync` calls (research.md §5's Vercel build-tracing requirement) needed all six template pairs to exist to compile. Tracked as done here and marked accordingly in Phase 3 too.

**Checkpoint**: Language detection, resolution, and persistence primitives all exist; English and Italian skeleton templates are both complete and consistent with each other's fixed names. User story implementation can now begin.

---

## Phase 3: User Story 1 - Confirming the setup language on a fresh Company OS (Priority: P1) 🎯 MVP

**Goal**: A first-time visitor to the empty-bucket setup step sees their browser-detected language suggested (or any of the six), and confirming it creates the Company OS skeleton — localized and permanently recorded — in that language.

**Independent Test**: Point the app at a freshly connected, empty bucket with the browser set to each of the six supported languages in turn, confirm the suggested language, and verify the resulting `AGENTS.md`, `os/skills/init.md`, and `os/language` are all correct for that language, with no OS content created before confirmation.

### Implementation for User Story 1

- [X] T010 [P] [US1] Create `frontend/app/init/LanguageConfirm.tsx`: given a detected `SupportedLanguage` prop, renders all six languages by native name with the detected one pre-selected, wrapping the existing confirmation form with a `lang` field the visitor can change before submitting (research.md §5, contracts/init-page.md). **Simplified from tasks plan**: implemented as a plain server component using native radio inputs (no client-side state needed — the browser's own radio-group behavior carries the chosen value in the form POST), not a `"use client"` component.
- [X] T011 [US1] Update `frontend/app/init/page.tsx`'s empty-bucket branch to compute `detectBrowserLanguage(headers().get("accept-language"))` and render `LanguageConfirm` (passing the detected code) in place of the bare confirmation button (contracts/init-page.md). (depends on T004, T010)
- [X] T012 [P] [US1] Update `frontend/app/init/submit/route.ts` to read the `lang` form field, validate it against `SUPPORTED_LANGUAGES`, respond `400 { "error": "invalid_language" }` if missing/invalid, and pass the validated value to `initializeCompanyOs(lang)` (contracts/language-resolution.md). (depends on T003, T009)
- [X] T013 [P] [US1] Translate `frontend/lib/os/templates/en/{AGENTS.md,init.md}` into Russian, writing `frontend/lib/os/templates/ru/{AGENTS.md,init.md}` — every file/folder name must match the `en/init.md` base exactly (research.md §4). (depends on T007, T008)
- [X] T014 [P] [US1] Same, into French — `frontend/lib/os/templates/fr/{AGENTS.md,init.md}`. (depends on T007, T008)
- [X] T015 [P] [US1] Same, into German — `frontend/lib/os/templates/de/{AGENTS.md,init.md}`. (depends on T007, T008)
- [X] T016 [P] [US1] Same, into Spanish — `frontend/lib/os/templates/es/{AGENTS.md,init.md}`. (depends on T007, T008)

**Checkpoint**: User Story 1 is fully functional and independently testable — confirming any of the six languages on a fresh bucket creates the correctly localized skeleton and permanently persists the choice.

---

## Phase 4: User Story 2 - The whole application follows the confirmed language (Priority: P2)

**Goal**: Once a Company OS has a confirmed language, every human-facing page and message renders in that language for every visitor, regardless of their own browser language; pages shown before any Company OS exists still use live browser detection; a legacy Company OS with no stored language falls back to English.

**Independent Test**: Confirm a language other than the tester's own browser language during setup, reload the application in a browser set to a different language, and verify every page still renders in the confirmed language.

### Implementation for User Story 2

- [X] T017 [US2] Create `frontend/lib/i18n/dictionaries/en.ts` (plus `types.ts` defining the shared `Dictionary` interface) defining the full UI string-key set (the canonical key source of truth) covering `app/init/*`, `app/editor/*`, `app/settings/**/*`, `app/oauth/**/*`, `app/layout.tsx`, and the human-facing route-handler error messages (research.md §6 inventory). Parameterized strings are functions on the interface, not plain values. (depends on T003)
- [X] T018 [P] [US2] Create `frontend/lib/i18n/dictionaries/it.ts` — every key from T017, translated. (depends on T017)
- [X] T019 [P] [US2] Same for `frontend/lib/i18n/dictionaries/ru.ts`. (depends on T017)
- [X] T020 [P] [US2] Same for `frontend/lib/i18n/dictionaries/fr.ts`. (depends on T017)
- [X] T021 [P] [US2] Same for `frontend/lib/i18n/dictionaries/de.ts`. (depends on T017)
- [X] T022 [P] [US2] Same for `frontend/lib/i18n/dictionaries/es.ts`. (depends on T017)
- [X] T023 [US2] Update `frontend/app/layout.tsx` to call `resolveLanguage()` and set `<html lang={...}>` to the resolved code; also added `frontend/lib/i18n/dictionaries/index.ts` (`getDictionary(language)`) as the lookup helper every page uses to get its dictionary. (depends on T005, T017)
- [X] T024 [P] [US2] Update `frontend/app/init/EnvSetupHelper.tsx` (live `detectBrowserLanguage()`, FR-014) and `frontend/app/init/McpConnectManual.tsx` (`resolveLanguage()`, FR-008/FR-013) to render from a `dict` prop instead of hardcoded strings; `frontend/app/init/page.tsx` now resolves the language once and passes the matching dictionary/slice down to each. (depends on T023)
- [X] T025 [P] [US2] Update `frontend/app/editor/*.tsx` (`page.tsx`, `EditorApp.tsx`, `FileTree.tsx`, `FileEditor.tsx`, `Header.tsx`, `CsvTableEditor.tsx`) to render from a `dict` prop threaded down from `page.tsx`. `MarkdownEditor.tsx`/`PlainTextEditor.tsx`/`Icons.tsx` needed no changes — no user-facing text in any of them. Also added `saveFailedLabel`/`uploadFailedLabel`/`deleteFailedLabel`/`createFailedLabel` keys (generic fallback labels distinct from the interpolating `xFailed(message)` functions) to keep the existing "operation failed: {fallback label}" pattern consistent instead of doubling an English word inside a translated wrapper. (depends on T023)
- [X] T026 [P] [US2] Update `frontend/app/settings/connected-apps/page.tsx`, `frontend/app/settings/personal-access-tokens/page.tsx`, and `frontend/app/settings/personal-access-tokens/create/route.ts` (the raw-HTML token-created response) to render/return dictionary-sourced strings. (depends on T023)
- [X] T027 [P] [US2] Update `frontend/app/oauth/login/page.tsx` and `frontend/app/oauth/authorize/page.tsx` to render dictionary-sourced strings (the OAuth *protocol* routes — `token`, `register`, `revoke`, `login/submit`, `.well-known/*` — stay in English/unchanged, research.md §8; `login/submit` only ever sets a query-string error *code*, translated by `login/page.tsx`). (depends on T023)
- [X] T028 [US2] Update `frontend/app/init/submit/route.ts`'s existing error responses (`401` unauthorized, `400` invalid language) to use dictionary-sourced text. Also hardened `resolveLanguage()` (`lib/i18n/resolve.ts`) to catch unexpected storage errors from `checkOsStatus()`/`getSystemLanguage()` and fall back to live browser detection / English rather than throwing — needed once pages with no prior storage dependency (`/oauth/login`) started calling it. (depends on T012, T023)

**Known gap (documented, not blocking)**: the `/api/file`, `/api/tree`, `/api/directory`, `/api/upload`, `/api/download-zip` route handlers still return their own literal English error message bodies (e.g. `"path is required"`, the 422 "doesn't look like a text file" message) — these are a lower-visibility layer one level below the dictionary-driven UI strings above, out of scope for this pass; a follow-up task should extend the same `dict`-prop pattern to those five route handlers.

**Checkpoint**: User Stories 1 AND 2 both work independently — every human-facing page/message follows the Company OS's confirmed language (or live detection pre-confirmation, or the English fallback for a legacy OS).

---

## Phase 5: User Story 3 - Company OS content stays in the confirmed language, folder names stay in English (Priority: P3)

**Goal**: Confirm, across all six languages, that the connected AI assistant is explicitly instructed to keep every folder/file name in the fixed English form regardless of the confirmed language, and that this holds true byte-for-byte across all six localized skill files.

**Independent Test**: Initialize two Company OS instances from an empty bucket with two different confirmed languages, run the same setup interview against both, and verify the two resulting directory/file trees have identical names while file contents differ only in language.

### Implementation for User Story 3

- [X] T029 [US3] Add an explicit "fixed names" clause (all six languages), stating — in that file's own language — that every folder/file name it creates must match the English names given in its own tables verbatim, never translated. Done as part of authoring each `init.md` (T007/T008/T013-T016) rather than a separate pass — each file already ends with a "Fixed names"/"Nomi fissi"/"Фиксированные имена"/"Noms fixes"/"Feste Namen"/"Nombres fijos" rule. (depends on T007, T008, T013, T014, T015, T016)
- [X] T030 [US3] Cross-checked all six `frontend/lib/os/templates/<code>/init.md` files by extracting every backtick-quoted `*.md` filename and `data/`/`os/` path reference and diffing them across languages (SC-004). Found and fixed one drift: `it/init.md`'s `os/templates/` section still said `progetto.md` where all five other languages say `project.md` (a rename my original table missed, since it wasn't a literal separate created file — just a section label for the brief/status/log trio — but needed to match anyway for byte-identical naming). Verified clean after the fix; the only remaining per-language differences are legitimate translated vocabulary (activity-type/state words like `active`/`attivo`/`aktiv`), never file or folder names. (depends on T029)

**Checkpoint**: All three user stories are independently functional — the fixed-English-name guarantee holds across all six languages, confirmed by direct comparison.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and consistency pass across the whole feature

- [X] T031 [P] Partial run of `quickstart.md` against the already-running `next dev` instance on this machine (port 3002), pointed at a **live, real Cloudflare R2 bucket** (`.env.local`'s `S3_BUCKET=demo-test`) rather than a disposable local one. Ran only read-only/safe checks: confirmed `tsc --noEmit` is clean, confirmed the dev server serves the modified code without runtime errors, and confirmed `GET /init` (redirected to `/oauth/login`, since this bucket already has `os/`+`data/` from prior specs' testing, and no `os/language` file) renders `<html lang="en">` with the translated "Sign in" heading regardless of an `Accept-Language: it-IT` request header — correctly exercising the FR-013 legacy-OS-fallback path against real infrastructure. **Scenarios 1-3 and 6-8 (fresh empty-bucket confirmation across all six languages, override, cross-language folder identity, "no switcher") were NOT run live** — this bucket holds real content from earlier specs and isn't safe to empty/reinitialize in this session; SC-004 (cross-language folder-name identity) was instead verified statically via the T030 file diff. A full live run needs a disposable bucket the user provisions on purpose.
- [X] T032 Reviewed all six dictionaries (`frontend/lib/i18n/dictionaries/*.ts`) for key-set parity. Confirmed structurally rather than by a separate script: every dictionary is declared `const xx: Dictionary = {...}` against the single shared interface (`types.ts`, no `Partial<>`), so `tsc --noEmit` passing across all six is already a full guarantee of exact key parity — a missing or extra key would be a compile error. (depends on T017-T022)
- [X] T033 Confirmed no new environment variable was introduced — grepped `lib/i18n/` and the new `LanguageConfirm.tsx` for `process.env` (no matches). Persistence is entirely in-bucket via `os/language`, per research.md §3; `frontend/.env.example`/README are unaffected.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational. Independent of US1's own tasks, but delivering it alongside US1 is what makes the confirmed language actually visible app-wide.
- **User Story 3 (Phase 5)**: Depends on Foundational and on US1's six template variants existing (T007, T008, T013-T016).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- US1: template translations (T013-T016) can proceed in parallel with the UI/route tasks (T010-T012) — different files.
- US2: the six dictionaries (T017 then T018-T022 in parallel) must exist before the pages that consume them (T023-T028).
- US3: both tasks are sequential (T030 checks what T029 produces).

### Parallel Opportunities

- Foundational: T003 and T004 in parallel; T006, T007, T008 in parallel once their own individual dependencies (T002, T006) are met.
- US1: T010, T012, T013, T014, T015, T016 can all run in parallel (six different files).
- US2: T018-T022 in parallel (five different dictionary files); T024-T027 in parallel once T023 lands (four different page areas).
- Different user stories can be staffed in parallel once Foundational is done, though US3 is only meaningfully testable once US1's six template variants exist.

---

## Parallel Example: User Story 1

```bash
# Once Foundational (Phase 2) is complete, launch together:
Task: "Create frontend/app/init/LanguageConfirm.tsx"
Task: "Update frontend/app/init/submit/route.ts to accept and validate the lang field"
Task: "Translate frontend/lib/os/templates/en/{AGENTS.md,init.md} into Russian"
Task: "Translate frontend/lib/os/templates/en/{AGENTS.md,init.md} into French"
Task: "Translate frontend/lib/os/templates/en/{AGENTS.md,init.md} into German"
Task: "Translate frontend/lib/os/templates/en/{AGENTS.md,init.md} into Spanish"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run quickstart.md Scenarios 1-3 (all six languages confirm correctly, override works, unsupported-language fallback works) against User Story 1 alone.
5. Deploy/demo if ready — note that at this point, pages *other* than `/init` still render in hardcoded English (US2 not yet done).

### Incremental Delivery

1. Setup + Foundational → foundation ready (detection/resolution/persistence + en/it templates).
2. Add User Story 1 → test independently (quickstart Scenarios 1-3) → the confirmation flow itself is complete, all six languages.
3. Add User Story 2 → test independently (quickstart Scenarios 4, 5, 7) → the whole app now visibly follows the confirmed language.
4. Add User Story 3 → test independently (quickstart Scenario 6) → the fixed-English-name guarantee is explicit and verified across all six languages.
5. Polish (Phase 6) → full quickstart.md pass, dictionary parity check.

---

## Notes

- [P] tasks touch different files and have no dependency on each other within the same batch.
- [Story] labels map each task to its user story for traceability; Setup/Foundational/Polish tasks have none, by design.
- No automated tests exist in this project (research.md §9) — validation is entirely through `quickstart.md`'s manual scenarios.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before moving to the next.
