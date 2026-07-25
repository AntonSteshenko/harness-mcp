# Implementation Plan: Multilingual Company OS Setup

**Branch**: `015-multilingual-support` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-multilingual-support/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extends the existing `/init` empty-bucket setup step (spec 014) with a one-time, permanent language confirmation: the app detects the visitor's browser language, offers it (or any of five alternatives — English, Italian, Russian, French, German, Spanish) for confirmation, and only then creates the Company OS skeleton — writing a localized `AGENTS.md`/`os/skills/init.md` pair and persisting the chosen code in a new `os/language` marker file. From that point on, every human-facing page of the app (editor, settings, sign-in/OAuth screens) resolves and renders in that stored language for every visitor, and the localized init skill instructs any connected AI assistant to keep writing further Company OS content (identity, policies, other skills, data records) in it — while every directory/file name it creates stays the same fixed English name regardless of language (research.md §4). Pages shown before any Company OS exists (the "storage not connected" helper and the empty-bucket page prior to confirmation) use live, unpersisted browser detection instead (FR-014). A Company OS already initialized before this feature exists is left untouched; the app just falls back to English for its own UI when it finds no `os/language` file (FR-013). No new npm dependency — a small, custom dictionary-based i18n module fits this app's fixed-path routing and single-global-language model better than a locale-prefixed-routing library like `next-intl` (research.md §6).

## Technical Context

**Language/Version**: TypeScript 5.9 (Next.js 16 App Router, Node.js runtime, React 19) — same as every prior feature in this app.

**Primary Dependencies**: Existing `lib/storage/*` (`readFile`, `createFile`, `hasAnyObjectWithPrefix`) and `lib/os/init.ts` (spec 014). No new npm dependency — translation is a small custom module (`lib/i18n/*`), not a routing/locale library (research.md §6).

**Storage**: S3-compatible object storage (MinIO, spec 001) — this feature adds one new marker file, `os/language` (plain-text two-letter code), and replaces the single `AGENTS.md`/`os/skills/init.md` template pair with six per-language variants; no new storage mechanism.

**Testing**: No automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-014.

**Target Platform**: Linux server / local dev; same Next.js page + Route Handler pattern already hosting `/init`, `/editor`, and `/settings/*`.

**Project Type**: web — single Next.js app (`frontend/`); this feature adds one new lib module (`lib/i18n/`), six new template subfolders, and touches every existing page/route that renders human-facing text.

**Performance Goals**: No new targets — language resolution adds at most one extra S3 read (`os/language`) per request beyond what `/init` already does, cached per-request via React's `cache()` so a single request never re-reads it (research.md §7).

**Constraints**: The confirmed language MUST be permanent — no switcher, no re-ask (FR-007); folder/file names MUST stay fixed English in every language (FR-011, research.md §4); machine-facing MCP/OAuth protocol responses stay in English regardless of the confirmed language (FR-008, research.md §8); a Company OS already initialized before this feature exists MUST be left unaffected (FR-012).

**Scale/Scope**: Single owner, one-time language choice per Company OS — same low-volume scale as `/init`'s existing confirmation action; six supported languages, ~17 existing `.tsx` files plus several `route.ts` JSON error responses need translated strings (research.md §6 inventory).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (all sections are placeholders — no ratified principles exist for this project). No gates apply; nothing to check against. Re-confirmed after Phase 1: still N/A.

## Project Structure

### Documentation (this feature)

```text
specs/015-multilingual-support/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── language-resolution.md
│   └── init-page.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── layout.tsx                    # MODIFIED: resolves language (lib/i18n/resolve.ts), sets <html lang>,
│   │                                  #           passes the resolved dictionary down to page trees
│   ├── init/
│   │   ├── page.tsx                  # MODIFIED: empty-bucket state now shows LanguageConfirm before the
│   │   │                             #           existing single confirmation button (research.md §5)
│   │   ├── LanguageConfirm.tsx       # NEW: client component — shows the detected language + lets the
│   │   │                             #      visitor pick any of the six before submitting (research.md §5)
│   │   ├── EnvSetupHelper.tsx        # MODIFIED: translated strings via dict prop (live-detected language,
│   │   │                             #           FR-014 — pre-Company-OS, not yet persisted)
│   │   ├── McpConnectManual.tsx      # MODIFIED: translated strings via dict prop
│   │   └── submit/route.ts           # MODIFIED: accepts a `lang` form field, validates it against the six
│   │                                  #           supported codes, passes it to initializeCompanyOs(lang)
│   ├── editor/*.tsx                  # MODIFIED: every component takes translated strings via a dict prop
│   ├── settings/**/*.tsx             # MODIFIED: same
│   └── oauth/**/*.tsx, route.ts      # MODIFIED: same (human-facing sign-in/authorize pages only —
│                                      #           not the machine-facing token/register/.well-known routes,
│                                      #           research.md §8)
└── lib/
    ├── i18n/
    │   ├── languages.ts              # NEW: the six supported codes + native/English display names
    │   ├── detect.ts                 # NEW: detectBrowserLanguage(acceptLanguageHeader) → SupportedLanguage
    │   ├── resolve.ts                # NEW: resolveLanguage() — single per-request entry point implementing
    │   │                             #      FR-008/FR-013/FR-014's three-way decision (research.md §3)
    │   └── dictionaries/
    │       ├── en.ts, it.ts, ru.ts, fr.ts, de.ts, es.ts   # NEW: one string table per language
    └── os/
        ├── init.ts                   # MODIFIED: initializeCompanyOs(language) writes os/language and
        │                             #           picks the matching localized template pair
        └── templates/
            ├── en/AGENTS.md, en/init.md   # MODIFIED (moved from templates/ root; init.md's file/skill
            │                              #           catalog renamed to fixed English names, research.md §4)
            ├── it/AGENTS.md, it/init.md   # MODIFIED (existing Italian init.md content, moved here, with
            │                              #           every file/skill name it prescribes switched to the
            │                              #           same fixed English names as the en/ variant)
            └── ru/, fr/, de/, es/AGENTS.md, init.md   # NEW: translated equivalents
```

**Structure Decision**: This feature stays entirely inside the existing single Next.js app (`frontend/`) established by specs 001-014 — no new project or top-level directory. It adds one new lib module (`lib/i18n/`) that every existing page/route composes with, splits the existing `lib/os/templates/` pair into six per-language subfolders, and adds one new client component (`app/init/LanguageConfirm.tsx`) alongside the existing `app/init/` area. Every other existing `.tsx`/`route.ts` file that renders human-facing text is touched only to source its strings from a dictionary instead of a hardcoded literal — no structural change to those files' logic.

## Complexity Tracking

No violations — Constitution Check is N/A (unfilled template project).
