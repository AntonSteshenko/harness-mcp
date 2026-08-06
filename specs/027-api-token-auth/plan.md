# Implementation Plan: REST API Token Authentication

**Branch**: `027-api-token-auth` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-api-token-auth/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

`requireOwnerSession()` (`frontend/lib/oauth/session.ts`) is the single shared guard used by every file-API route (`/api/file`, `/api/tree`, `/api/directory`, `/api/upload`, `/api/download-zip`); today it accepts only the owner's signed session cookie. Extend it to also accept an `Authorization: Bearer <token>` header — verified against OAuth access tokens and Personal Access Tokens using the exact same `verifyAccessToken(...) ?? verifyPersonalAccessToken(...)` fallback chain already used by `app/mcp/route.ts` — as a fallback when no valid session cookie is present. Because `requireOwnerSession()` keeps its existing `(): Promise<NextResponse | null>` signature (reading the incoming request's headers via Next.js's `headers()` API, the same way it already reads cookies via `cookies()`), none of the five call sites need to change; all five routes gain bearer-token support from one edit.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Next.js 16.2.10 (App Router, Route Handlers)

**Primary Dependencies**: Existing `lib/oauth/session.ts` (`requireOwnerSession`), `lib/oauth/tokens.ts` (`verifyAccessToken`), `lib/oauth/personalAccessTokens.ts` (`verifyPersonalAccessToken`); Next.js `headers()` from `next/headers` (already used elsewhere in the app; parallel to this file's existing `cookies()` usage)

**Storage**: N/A for this feature directly — token and PAT records already live in the existing S3-backed KV store (`lib/oauth/store.ts`); no new persisted state

**Testing**: No automated test suite is configured in this repository (no test runner in `frontend/package.json`); validation is manual via `quickstart.md`, consistent with prior specs (e.g., 026)

**Target Platform**: Web — Route Handlers in the existing self-hosted Next.js frontend (harness-mcp)

**Project Type**: Web application — single Next.js app under `frontend/` (no separate backend project; API routes live inside the same app)

**Performance Goals**: None beyond the existing per-request auth-check cost; a bearer-token request adds one KV lookup (`verifyAccessToken` and/or `verifyPersonalAccessToken`), the same cost already paid on every `/mcp` request today

**Constraints**: Must not change any observable behavior for existing cookie-authenticated requests; must reuse the existing token-verification functions rather than duplicating validation logic; must not require edits to the five route files that call `requireOwnerSession()`

**Scale/Scope**: One function body change (`requireOwnerSession` in `frontend/lib/oauth/session.ts`); zero changes to `app/api/file/route.ts`, `app/api/tree/route.ts`, `app/api/directory/route.ts`, `app/api/upload/route.ts`, `app/api/download-zip/route.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no principles have been ratified for this project). There are no project-specific gates to evaluate; this plan follows the repository's observed conventions instead (see Technical Context and research.md).

## Project Structure

### Documentation (this feature)

```text
specs/027-api-token-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── lib/
│   └── oauth/
│       ├── session.ts               # UPDATED — requireOwnerSession() falls back to a Bearer token when no session cookie is present
│       ├── tokens.ts                # existing — verifyAccessToken(), reused as-is (no change)
│       └── personalAccessTokens.ts  # existing — verifyPersonalAccessToken(), reused as-is (no change)
└── app/
    └── api/
        ├── file/route.ts            # existing — NO CHANGE; gains bearer-token support via requireOwnerSession()
        ├── tree/route.ts            # existing — NO CHANGE; gains bearer-token support via requireOwnerSession()
        ├── directory/route.ts       # existing — NO CHANGE; gains bearer-token support via requireOwnerSession()
        ├── upload/route.ts          # existing — NO CHANGE; gains bearer-token support via requireOwnerSession()
        └── download-zip/route.ts    # existing — NO CHANGE; gains bearer-token support via requireOwnerSession()
```

**Structure Decision**: Single Next.js App Router project (`frontend/`), matching every prior spec in this repo (001–026). No new project, module, or route is introduced. The change is localized to one shared auth guard (`requireOwnerSession` in `lib/oauth/session.ts`); it reads the `Authorization` header via `headers()` from `next/headers` (the Route Handler-scoped equivalent of the `cookies()` call already used in the same function), so its call signature — and therefore every one of its five call sites — is unchanged.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — the Constitution Check identified no gates to satisfy, and this feature extends one existing function's internal logic with no new project, service, dependency, or architectural pattern.
