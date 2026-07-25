# Implementation Plan: Company OS Init Page

**Branch**: `014-os-init-page` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-os-init-page/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A new `/init` page bootstraps a fresh "Company OS" in the app's already-configured S3-compatible bucket. On load it resolves one of three states — storage not connected (show an interactive, client-side-only setup helper covering storage connection, the owner sign-in credential, and an optional system name, generating one copyable config snippet, FR-014/FR-015), storage connected and already initialized (`os/` + `data/` both present — show a link to `/editor`), or storage connected and empty (show a two-question setup form). Submitting the form creates `os/`, `data/`, `os/identity.md` (populated from the two answers), a root `AGENTS.md`, and a fixed `os/skills/init.md` skill file, entirely by composing existing `lib/storage/*` primitives (spec 001/002/007) and the existing owner-session gate (spec 009) — no new storage mechanism or auth mechanism. Planning surfaced one necessary spec correction (FR-012): the owner-session gate itself depends on reachable storage, so it cannot apply to the "not connected" state (research.md §1). The setup helper is deliberately inert — pure client-side string templating, no network call, no server-side handling of the entered secrets (research.md §7).

Implementation surfaced a second, more structural correction (FR-016/FR-017, research.md §8): `frontend/instrumentation.ts`'s pre-existing fail-fast startup checks (spec 007/008) made `/init` completely unreachable when storage was never configured, since the process exited before serving any request. Both checks are now log-only, and a new `frontend/middleware.ts` redirects every request to `/init` while storage is obviously unconfigured.

## Technical Context

**Language/Version**: TypeScript 5.9 (Next.js 16 App Router, Node.js runtime) — same as every prior feature in this app.

**Primary Dependencies**: Existing `lib/storage/*` (`verifyStorageConnection`, `hasAnyObjectWithPrefix`, `createDirectory`, `createFile`, spec 001/002/007) and `lib/oauth/session.ts` (`hasActiveOwnerSession`, spec 008/009). No new npm dependency.

**Storage**: S3-compatible object storage (MinIO, spec 001), via the existing `lib/storage/*` helpers — this feature only adds new content at new paths (`os/`, `data/`, `os/identity.md`, `AGENTS.md`, `os/skills/init.md`); no new storage mechanism.

**Testing**: No automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-013.

**Target Platform**: Linux server / local dev; same Next.js page + Route Handler pattern already hosting `/editor` and `/settings/*`.

**Project Type**: web — single Next.js app (`frontend/`); this feature adds one new top-level page, one new lib module, and one new POST route handler.

**Performance Goals**: No new targets — `/init` performs at most a handful of lightweight S3 calls per load (one connectivity probe, up to two prefix-existence checks), matching this app's existing per-request storage-check patterns (spec 007's startup check, spec 009's session lookup).

**Constraints**: Must never overwrite existing content once `os/`/`data/` exist (FR-011, SC-004) — enforced by re-checking existence inside the write path itself, not only in the page's render check (research.md §4); the owner-session gate applies only when storage is connected (FR-012, research.md §1); `AGENTS.md`/`os/skills/init.md` content is a fixed, product-provided template, not user-authored (FR-008, FR-009); the connection-setup helper (FR-014, FR-015) MUST NOT make any network request with the entered values and MUST NOT write to any file or call any external API — it is pure client-side rendering (research.md §7); the server process MUST start regardless of storage/owner-credential misconfiguration (FR-016, FR-017, research.md §8).

**Scale/Scope**: Single owner, one-time setup action per bucket — same low-volume scale as this app's other owner-only settings pages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (all sections are placeholders — no ratified principles exist for this project). No gates apply; nothing to check against. Re-confirmed after Phase 1: still N/A.

## Project Structure

### Documentation (this feature)

```text
specs/014-os-init-page/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── init-page.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── instrumentation.ts      # MODIFIED: both startup checks are now log-only, no more process.exit(1) (research.md §8)
├── middleware.ts           # NEW: redirects every request to /init while storage is obviously unconfigured (research.md §8)
├── lib/
│   └── os/
│       └── init.ts        # NEW: checkOsStatus() (research.md §3), initializeCompanyOs(name, description)
│                           #      (research.md §4-§5) — owns the fixed AGENTS.md / os/skills/init.md templates
└── app/
    └── init/
        ├── page.tsx              # NEW: server component — resolves the 3 states (contracts/init-page.md),
        │                         #      redirects to sign-in when required, renders the matching view
        ├── InitForm.tsx          # NEW: the two-question setup form (posts to submit/route.ts)
        ├── EnvSetupHelper.tsx    # NEW: client component — setup helper (FR-014/FR-015): storage + owner credential +
        │                         #      system name fields, one client-side snippet, no fetch calls (research.md §7)
        └── submit/
            └── route.ts          # NEW: POST — validates input, calls initializeCompanyOs, redirects to /init?created=1
```

**Structure Decision**: This feature lives entirely inside the existing single Next.js app (`frontend/`) established by specs 001-013 — no new project, service, or top-level directory. It adds one new lib module (`lib/os/init.ts`) that composes existing `lib/storage/*` primitives, and one new page area under `app/init/` mirroring the existing `app/editor/` (page + owner-session redirect) and `app/settings/personal-access-tokens/create/route.ts` (form-POST route) patterns, plus one new root-level `middleware.ts`. The only existing file touched is `instrumentation.ts` (research.md §8) — a small, additive change to its two existing catch blocks.

## Complexity Tracking

No violations — Constitution Check is N/A (unfilled template project).
