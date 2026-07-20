# Implementation Plan: Dedicated Frontend Folder for Vercel Readiness

**Branch**: `006-frontend-folder-structure` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-frontend-folder-structure/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move the entire existing Next.js application — everything currently at the repo root that `next build` needs (`app/`, `lib/`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `node_modules/`) — into one new `frontend/` folder via `git mv` (research.md §1, §2, §5), leaving local-dev infrastructure (`docker-compose.yml`, `data/`, `scripts/`, `.env.example`) and project-process files (`specs/`, `.specify/`, `CLAUDE.md`, `README.md`) untouched at the repo root (research.md §3, §4). This is a pure structural move with no application code change: every import inside the app stays relative to the app itself, so nothing inside `app/`/`lib/` needs editing (data-model.md). `README.md` and `CLAUDE.md` gain a short note naming `frontend/` as the folder a future Vercel project should set as its Root Directory (FR-007). No Vercel project is created and no production storage backend is wired up — this feature only prepares the layout (spec.md Assumptions).

## Technical Context

**Language/Version**: TypeScript on Node.js (same app as specs 002-005 — Next.js ≥ 18.18 requirement, current Node.js LTS); no version change.

**Primary Dependencies**: None new. Every existing dependency in `package.json` (Next.js, React, `@aws-sdk/client-s3`, `@modelcontextprotocol/sdk`, `mcp-handler`, CodeMirror, `jszip`, etc.) moves as-is inside `frontend/package.json` — no dependency is added, removed, or upgraded.

**Storage**: Unchanged — spec 001's local MinIO storage, accessed exclusively through spec 002's existing `lib/storage/*` (now `frontend/lib/storage/*`). `docker-compose.yml` and `data/minio` stay at the repo root and are unaffected (research.md §3).

**Testing**: No automated test suite requested (consistent with specs 001-005); validated via the copy-and-build isolation check and the local dev walkthrough in quickstart.md.

**Target Platform**: Same developer-local Next.js dev server (`npm run dev`, now run from `frontend/`), plus — as forward-looking validation only, not an actual deployment — an isolated build simulating what a Vercel Root-Directory build would see (quickstart.md §2).

**Project Type**: Single Next.js web application, structurally relocated into a dedicated subfolder (`frontend/`) at the repo root; no new project/app/package is created, and no monorepo workspace tooling is introduced (research.md §2).

**Performance Goals**: N/A — this is a file-location change with no runtime behavior change; the app's existing performance characteristics (specs 001-005) are unaffected.

**Constraints**: The move MUST NOT change any application behavior, UI, or API contract (FR-006); `frontend/` MUST be buildable/runnable using only its own contents (FR-002); local-dev infra and project-process files MUST stay at the repo root (FR-003, FR-004).

**Scale/Scope**: A one-time repository restructuring touching every existing app source file's location (not its content) plus two documentation files (`README.md`, `CLAUDE.md`); bounded to exactly the files enumerated in `data-model.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` still contains only unfilled template placeholders (same state as specs 001-005). No concrete gates exist to evaluate against, so this check trivially passes with no violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-frontend-folder-structure/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── repo-layout.md    # The frontend/ vs repo-root boundary contract (no traditional API here)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/                  # NEW — the entire Next.js app, moved as one unit (data-model.md)
├── app/
│   ├── editor/             # (existing, specs 003/004/005 — unchanged content)
│   ├── api/                # (existing, specs 003/004/005 — unchanged content)
│   ├── mcp/route.ts         # (existing, spec 002 — unchanged content)
│   └── layout.tsx           # (existing — unchanged content)
├── lib/
│   ├── storage/             # (existing, spec 002 — unchanged content)
│   └── mcp-tools/           # (existing, spec 002 — unchanged content)
├── next.config.ts           # (existing — unchanged content)
├── next-env.d.ts             # (existing — unchanged content)
├── tsconfig.json              # (existing — unchanged content; `@/*` alias still resolves to frontend/* since it's self-relative)
├── package.json                # (existing — unchanged content)
├── package-lock.json            # (existing — unchanged content)
└── node_modules/                  # (git-ignored, reinstalled via npm install)

# Repo root — UNCHANGED, stays exactly where it is today:
docker-compose.yml    # (existing, spec 001 — unchanged)
data/                 # (existing, spec 001 — unchanged, git-ignored)
scripts/
└── reset-storage.sh   # (existing, spec 001 — unchanged)
.env.example           # (existing, spec 001/002 — unchanged, research.md §4)
specs/                 # (existing — unchanged; this feature's own docs live at specs/006-frontend-folder-structure/)
.specify/              # (existing — unchanged)
README.md              # (existing — EXTENDED: names frontend/ as the app root, FR-007)
CLAUDE.md              # (existing — EXTENDED: names frontend/ as the app root, FR-007; SPECKIT plan pointer updated to this feature)
.gitignore             # (existing — unchanged; existing patterns like node_modules/, .next/ are directory-agnostic and still match inside frontend/)
```

**Structure Decision**: Everything that was previously a Next.js app spread across the repo root becomes one self-contained `frontend/` folder, moved with `git mv` to preserve history (research.md §5). No file's *content* changes except two documentation files gaining a short pointer to the new app root (FR-007). Local-dev infrastructure and project-process files are deliberately left untouched at the repo root (research.md §3), since neither is something Vercel would ever build — this is the layout `contracts/repo-layout.md` formalizes for future Vercel configuration and future spec plans to rely on.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
