# Implementation Plan: Manage Tools From The Page

**Branch**: `025-manage-tools-page` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-manage-tools-page/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Let the owner enable/disable any MCP tool directly from `/tools` (spec 024), through an explicit two-step confirm-then-apply flow, with a warning shown on every applied change that already-connected AI assistant sessions may not see it immediately. Moves the source of truth from `MCP_DISABLED_TOOLS` (an env var read only at process start, spec 023) to a single persisted record in the app's existing S3 bucket (`.mcp-tools/status.json`), read fresh on every `/mcp` request and every `/tools` page load — no server restart involved. A key finding from reading `mcp-handler`'s actual implementation: it already reconstructs the MCP server and re-runs tool registration on *every* `/mcp` POST request, so moving the source of truth to storage makes changes take effect immediately by construction, without any new propagation mechanism.

## Technical Context

**Language/Version**: TypeScript, Next.js 16 (App Router), Node.js runtime — same as the rest of `frontend/`. No new language/runtime.

**Primary Dependencies**: None new. Reuses `@aws-sdk/client-s3` (already used by every `lib/*/store.ts`), `lib/oauth/session` (`hasActiveOwnerSession`), and this repo's existing reserved-prefix storage pattern (`lib/oauth/store.ts` / `lib/messaging/store.ts`).

**Storage**: One new reserved-prefix record, `.mcp-tools/status.json`, in the same S3-compatible bucket every other piece of app state already lives in (spec 001/007). Not a new storage system.

**Testing**: No automated test framework exists in this repo (research.md §8) and none is introduced — verification is the manual `quickstart.md` walkthrough.

**Target Platform**: Same as the rest of the app — Next.js Route Handlers/pages, deployable to Vercel or run locally.

**Project Type**: Web application extension inside the existing single Next.js app (`frontend/`).

**Performance Goals**: One S3 read (`GetObject`) per `/mcp` request and per `/tools` page load, replacing what was previously a free `process.env` read — negligible added latency, and specifically *not* 17 separate reads (research.md §2 explains why the record is a single blob, not per-tool files).

**Constraints**: A confirmed change must be visible on the very next `/mcp` request without a server restart (spec.md FR-006) — satisfied by construction once the source of truth is storage-backed, given `mcp-handler` already re-registers tools per request (research.md §1). The confirmation step must be a genuinely separate interaction from the control that displays current status (spec.md FR-002) — not a single click/checkbox-submit.

**Scale/Scope**: 17 tools, one persisted record, two new routes (`GET /tools/[name]/confirm`, `POST /tools/[name]/status`), plus updates to the existing `/tools` page, `toolGate.ts`, and all 5 tool-registration modules (spec 023) to thread the pre-fetched disabled set through instead of each reading it independently.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no project-specific principles have been ratified) — there are no gates to evaluate against. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/025-manage-tools-page/
├── plan.md                       # This file (/speckit-plan command output)
├── research.md                   # Phase 0 output (/speckit-plan command)
├── data-model.md                 # Phase 1 output (/speckit-plan command)
├── quickstart.md                 # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── manage-tools-routes.md    # Phase 1 output (/speckit-plan command)
└── tasks.md                      # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Single Next.js app, no backend/frontend split (spec 006). This feature touches the storage layer (one new file), the tool-gating layer (spec 023's file, signature change), all 5 tool-registration modules (spec 023, mechanical), the `/mcp` route (spec 002/023), and the `/tools` page area (spec 024, extended) plus two new routes:

```text
frontend/
├── lib/
│   └── mcp-tools/
│       ├── store.ts             # NEW — .mcp-tools/ reserved prefix, getRecord/putRecord (research.md §3), getDisabledTools()/setToolDisabled(name, disabled)
│       ├── toolGate.ts          # existing (spec 023) — registerGatedTool signature changes to accept a pre-fetched disabledTools set (research.md §6)
│       ├── catalog.ts           # existing (spec 024) — TOOL_CATALOG reused unchanged
│       ├── index.ts             # existing (spec 023) — registerTools(server) → registerTools(server, disabledTools)
│       ├── engineTools.ts       # existing (spec 023) — same signature change
│       ├── messagingTools.ts    # existing (spec 023) — same signature change
│       ├── inboxTools.ts        # existing (spec 023) — same signature change
│       └── treeTools.ts         # existing (spec 023) — same signature change
├── lib/storage/
│   └── directories.ts           # existing — exclude the new `.mcp-tools/` prefix from listDirectory results (research.md §3), alongside the existing OAUTH_PREFIX exclusion
├── lib/i18n/dictionaries/
│   ├── types.ts                 # existing (spec 024) — extend `tools` section: confirm screen + warning banner strings
│   └── {en,it,de,es,fr,ru}.ts   # existing (spec 024) — same additions, all 6 languages
└── app/
    ├── mcp/
    │   └── route.ts              # existing (spec 002/023) — fetch disabledTools once, thread into all 5 register*Tools calls
    └── tools/
        ├── page.tsx               # existing (spec 024) — read getDisabledTools() instead of isToolEnabled(); render per-row change control; render the "changed" banner from ?changed=&to=
        └── [name]/
            ├── confirm/
            │   └── page.tsx        # NEW — owner-gated confirmation screen (research.md §4)
            └── status/
                └── route.ts        # NEW — owner-gated POST that applies the change (research.md §4, mirrors settings/connected-apps/[grantId]/revoke/route.ts)
```

**Structure Decision**: The new capability is genuinely two new files (`lib/mcp-tools/store.ts`, `app/tools/[name]/confirm/page.tsx`, `app/tools/[name]/status/route.ts` — three, not two) plus a mechanical signature change threading a pre-fetched `disabledTools` set through `toolGate.ts` and the 5 existing registration modules (replacing spec 023's synchronous per-call `process.env` read). `directories.ts` gains one line excluding the new reserved prefix, matching its existing `OAUTH_PREFIX` exclusion. `/tools`'s existing page (spec 024) is extended, not replaced, and the i18n dictionaries (spec 015) gain new strings for the confirm screen and warning banner in all 6 languages, following the exact pattern already used for spec 024's `tools` section.

## Complexity Tracking

*No constitution gates apply (see Constitution Check above) — this section is not needed.*
