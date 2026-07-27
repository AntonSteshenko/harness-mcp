# Implementation Plan: Split the OS Engine From Business Bootstrap, With Versioned Upgrades

**Branch**: `016-os-engine-split` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-os-engine-split/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Splits today's single, bucket-editable `os/skills/init.md` into three English-only MCP resources served straight from code (`engine`, `os-upgrade`, `init`) that never appear in the bucket, so the rules governing `AGENTS.md` can't be hand-corrupted (research.md §1-§3). `AGENTS.md` gains an `os-engine-version` integer in its front matter; an owner can ask for an explicit upgrade check, and a repair whose recorded version is behind current shares the same describe-then-confirm gate (Clarifications; FR-002 through FR-006b). Pre-existing (v0) Company OS instances get their inline routing table extracted into a new `os/routing.md` the first time they're touched, rather than losing it (FR-007, FR-008, Story 3). The business-bootstrap interview and everything it produces (`data/*`, `os/identity.md`, policies, domain skills, `os/routing.md`) moves to the `init` resource, self-triggering whenever `data/` is found missing at the start of any task (FR-011 through FR-014). No new runtime dependency and no new backend parsing/diffing code — version comparison and routing-table extraction are done by the connected assistant reading plain text, the same way it already follows today's `init.md` (research.md §5, §9). The existing `/init` page (specs 014, 015) keeps proving bucket connectivity, capturing the language choice, and writing the same minimal stub `AGENTS.md` it already writes today — it stops writing the one other file it currently copies into the bucket, `os/skills/init.md`, since that content is now MCP-only (research.md §7).

## Technical Context

**Language/Version**: TypeScript 5.9 (Next.js 16 App Router, Node.js runtime, React 19) — same as every prior feature in this app.

**Primary Dependencies**: `@modelcontextprotocol/sdk` (already installed, already used for tools via `mcp-handler`'s `createMcpHandler`) — this feature is the first to use its `registerResource` alongside the existing `registerTool` calls in `frontend/lib/mcp-tools/index.ts`. Existing `frontend/lib/storage/*` (`readFile`/`createFile`/`hasAnyObjectWithPrefix`, unchanged) and `frontend/lib/os/init.ts` (revised, contracts/init-skeleton.md). No new npm dependency (research.md §9).

**Storage**: S3-compatible object storage (MinIO, spec 001) for the bucket-side entities (`AGENTS.md`, `os/routing.md`, `data/*`, etc.); the three new engine/upgrade/init resources are code-bundled Markdown, never stored in the bucket (data-model.md).

**Testing**: No automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-015.

**Target Platform**: Linux server / local dev; same Next.js Route Handler (`frontend/app/mcp/route.ts`) already hosting the MCP tool surface (specs 002, 008, 010, 011, 013), plus the existing `/init` page (specs 014, 015).

**Project Type**: web — single Next.js app (`frontend/`); this feature adds one new lib subdirectory (`lib/os/engine/`), a small `registerResource`-based addition to `lib/mcp-tools/`, and shrinks the existing `lib/os/templates/<lang>/` pair down to an `AGENTS.md`-only stub per language.

**Performance Goals**: No new targets — resources are read once at module load (mirrors `lib/os/init.ts`'s existing `SKELETON_TEMPLATES` pattern) and served from memory; the assistant-side version comparison/routing extraction is a normal chat turn, not a new request path with its own latency budget.

**Constraints**: The three engine/upgrade/init resources MUST NOT be reachable through any file-system tool (`list_directory`/`read_file`/etc.) — enforced structurally by never writing them to the bucket (FR-001, SC-003). Repair and upgrade MUST share one confirm-before-change gate, never two independent paths (Clarifications, FR-006a/FR-006b). The business-data check MUST run every task, not once per session (FR-012a, Clarifications).

**Scale/Scope**: Same low-volume, single-owner scale as every prior Company OS feature (014, 015) — one engine version number and one routing file per Company OS instance, not a multi-tenant concern.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (all sections are placeholders — no ratified principles exist for this project), same as every prior feature in this repo. No gates apply; nothing to check against. Re-confirmed after Phase 1: still N/A.

## Project Structure

### Documentation (this feature)

```text
specs/016-os-engine-split/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── mcp-resources.md
│   └── init-skeleton.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── init/
│   │   └── submit/route.ts           # MODIFIED: calls the revised initializeCompanyOs()
│   │                                  #           (contracts/init-skeleton.md) — no signature change
│   └── mcp/
│       └── route.ts                  # MODIFIED: also calls the new registerResources(server)
└── lib/
    ├── mcp-tools/
    │   ├── index.ts                  # UNCHANGED: existing registerTools() (create_file, read_file, ...)
    │   └── resources.ts              # NEW: registerResources(server) — registers "engine",
    │                                 #      "os-upgrade", "init" via server.registerResource()
    │                                 #      (contracts/mcp-resources.md), reading lib/os/engine/*.md
    └── os/
        ├── init.ts                   # MODIFIED: initializeCompanyOs() writes the stub AGENTS.md only
        │                             #           (contracts/init-skeleton.md) — os/skills/init.md no
        │                             #           longer written
        ├── engine/                   # NEW: English-only, code-bundled, never copied to the bucket
        │   ├── engine.md             #      os-engine-version + changelog + build/repair rules
        │   ├── os-upgrade.md         #      version-compare + confirm-then-rebuild instructions
        │   └── init.md               #      interview + activity-type table + write instructions
        │                             #      (successor to today's Phase 1-3, minus engine mechanics)
        └── templates/
            ├── en/AGENTS.md          # MODIFIED: reworded stub, same shape as today (data-model.md); en/init.md deleted
            └── it/, ru/, fr/, de/, es/AGENTS.md   # MODIFIED: same shrink; each language's init.md deleted
```

**Structure Decision**: Stays entirely inside the existing single Next.js app (`frontend/`) established by specs 001-015 — no new project or top-level directory. Adds one new lib subdirectory (`lib/os/engine/`, the three code-bundled resource sources) and one new module (`lib/mcp-tools/resources.ts`) alongside the existing tool registration; the six per-language `templates/<lang>/init.md` files are removed rather than replaced, since their content now lives once, in English, under `lib/os/engine/init.md`.

## Complexity Tracking

No violations — Constitution Check is N/A (unfilled template project).
