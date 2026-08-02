# Implementation Plan: Fast Owner Session Validation

**Branch**: `021-fast-owner-session` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-fast-owner-session/spec.md`

## Summary

Every editor page load and file API request currently calls `requireOwnerSession()` → `hasActiveOwnerSession()` → `getRecord()`, which issues a live `GetObjectCommand` against the S3-compatible bucket just to check "is this session valid" (`lib/oauth/session.ts`, `lib/oauth/store.ts`). That per-request storage round trip, stacked on top of the round trip that fetches the actual file content, is the main contributor to the ~2-3s delay reported when opening a file.

The fix: make the session cookie self-contained (signed, with an embedded expiry) so it can be verified locally with `node:crypto`, no storage call. The one piece that can't be purely local — "sign out everywhere" without tracking individual sessions — is handled by a single small **generation record** (one JSON object: signing secret + generation number) that is cached in memory per warm serverless instance with a short TTL and only re-read from S3 when that cache goes stale. Signing out increments the generation; a token's embedded generation is checked against the cached current one, so old tokens fail validation once a given instance's cache catches up (bounded by the cache TTL) or immediately on any new instance.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router), Node.js (no `edge` runtime override anywhere in the app)

**Primary Dependencies**: `node:crypto` (built-in HMAC signing/verification — no new package needed), `next/headers` cookies API (existing pattern in `lib/oauth/session.ts`), `@aws-sdk/client-s3` (existing, reused only for the generation record and other unrelated OAuth state)

**Storage**: Existing self-hosted S3-compatible bucket (`lib/storage/client.ts`, `lib/oauth/store.ts`'s `.oauth/` prefix convention) — used only to persist the generation record and other OAuth state that already lives there; no new storage system introduced

**Testing**: No test runner is configured in this repo (no jest/vitest config or `*.test.*` files found) and the project's operating convention is not to run tests; verification here is the manual scenario walkthrough in `quickstart.md`

**Target Platform**: Vercel serverless Node.js functions (Fluid Compute — instances are reused across requests, which is what makes the in-memory generation cache effective)

**Project Type**: Single Next.js web app (`frontend/`) — App Router pages + Route Handlers, no separate backend service

**Performance Goals**: Eliminate the per-request S3 lookup currently paid by every editor page/API call; reduce it to at most one small S3 read per warm instance per cache-TTL window, independent of request volume

**Constraints**: No new external paid service or dependency; must preserve every protection guarantee from spec 009 (page + all file APIs still reject unauthenticated/expired requests); single-owner credential model (one username/password pair, `lib/oauth/config.ts`); pre-existing sessions become invalid on deploy (spec Assumption) — acceptable, one-time re-login

**Scale/Scope**: One owner account, low request volume — this is not a multi-tenant session system; no per-session tracking or session list is introduced

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` contains only unfilled template placeholders — no ratified project principles exist to check against. No gates apply; proceeding without constitutional constraints.

## Project Structure

### Documentation (this feature)

```text
specs/021-fast-owner-session/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── session-contract.md
└── tasks.md               # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root: `frontend/`)

```text
frontend/
├── lib/
│   └── oauth/
│       ├── session.ts        # REWRITTEN: sign/verify a self-contained cookie locally;
│       │                     #   no more per-request getRecord() call
│       ├── sessionSecret.ts  # NEW: reads/creates the {secret, generation} record,
│       │                     #   cached in module-level memory with a short TTL
│       ├── store.ts          # UNCHANGED: existing getRecord/putRecord helpers, reused
│       │                     #   by sessionSecret.ts
│       └── config.ts         # UNCHANGED: owner username/password config
├── app/
│   ├── oauth/
│   │   ├── login/submit/route.ts   # UNCHANGED call site: still calls createOwnerSession()
│   │   └── logout/
│   │       └── route.ts             # NEW: sign-out endpoint — bumps the generation number
│   ├── settings/connected-apps/page.tsx  # UPDATED: add a "Sign out" control (none exists today)
│   └── api/file/route.ts            # UNCHANGED call site: still calls requireOwnerSession()
└── middleware.ts                     # UNCHANGED
```

**Structure Decision**: This is a targeted rewrite of the internals of one existing module (`lib/oauth/session.ts`) plus one new small module (`sessionSecret.ts`) and one new route (`app/oauth/logout/route.ts`). Every existing call site of `requireOwnerSession()` / `hasActiveOwnerSession()` (the editor page, `/api/file`, `/api/tree`, `/api/directory`, upload, download-zip) keeps calling the exact same functions — the change is internal to `lib/oauth/`, not a call-site migration.

## Complexity Tracking

*No constitution violations to justify — section intentionally left empty.*
