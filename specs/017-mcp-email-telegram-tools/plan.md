# Implementation Plan: MCP Email & Telegram Messaging Tools

**Branch**: `017-mcp-email-telegram-tools` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-mcp-email-telegram-tools/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add two new MCP tools — `send_email` (via a pre-configured SMTP account) and `send_telegram_message` (via a pre-configured Telegram bot) — to the existing `/mcp` Route Handler, alongside the filesystem and engine tools already registered there. Both share one admin-configurable rate limit, use no per-call credentials, and record every send attempt (success or failure) for later review. Implementation reuses this repo's established patterns: `nodemailer` for SMTP, a raw `fetch` call to the Telegram Bot API, and the existing S3/MinIO bucket (already used for OAuth state) for the rate-limit counter and audit log, following the exact `getRecord`/`putRecord` convention already established in `lib/oauth/store.ts`.

## Technical Context

**Language/Version**: TypeScript 5.9 / Node.js, on Next.js 16 (App Router) — same stack as the rest of `frontend/`.

**Primary Dependencies**: `@modelcontextprotocol/sdk` + `mcp-handler` (existing, tool registration), `zod` (existing, input schemas), `nodemailer` (**new** — SMTP client, research.md §1), `@aws-sdk/client-s3` (existing, reused for the rate-limit/audit-log store), Node's built-in `fetch` for the Telegram Bot API (no new Telegram dependency, research.md §2).

**Storage**: Reuses the existing self-hosted S3/MinIO bucket (specs 001/007) under a new reserved prefix `.messaging/` — one JSON record for the shared rate-limit counter (`.messaging/rate-limit.json`) and one JSON record per send attempt (`.messaging/send-log/<id>.json`), mirroring `lib/oauth/store.ts`'s `.oauth/` convention (research.md §3, §4). No new datastore is introduced.

**Testing**: No automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-016. Per user instruction (CLAUDE.md), tests are not executed as part of this workflow.

**Target Platform**: Linux server / local dev; same Next.js Route Handler (`frontend/app/mcp/route.ts`) already hosting every other MCP tool (specs 002, 008, 010, 011, 013, 016). Node runtime (not Edge), since `nodemailer` and `@aws-sdk/client-s3` are both used.

**Project Type**: Web service (single Next.js app under `frontend/`) — no new project/package.

**Performance Goals**: SC-001 (email delivery confirmed to the mail server in <5s under normal network conditions), SC-002 (Telegram delivery confirmed in <3s under normal network conditions).

**Constraints**: No per-call credentials (FR-005) — both tools always use server-configured Messaging Configuration; a single rate limit shared across both tools, admin-configurable via env vars, no default hard-coded beyond a sensible fallback (FR-011); email recipient count capped at 50 per call (FR-010); no message deduplication — every call is sent as requested (Edge Cases, clarified 2026-07-27).

**Scale/Scope**: Two new MCP tools registered alongside the ~7 existing filesystem tools (spec 002/011) and 3 engine tools (spec 016); single-tenant deployment — one configured SMTP account and one Telegram bot per deployment (spec.md Assumptions), not a multi-account/multi-tenant messaging platform.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no ratified project principles) — no gates apply. This feature follows the same conventions already established by every prior spec in this repo (tool registration in `lib/mcp-tools/`, domain logic in a dedicated `lib/<concern>/` directory, config read from `process.env` without throwing at import time, errors as a small typed class with a `code`/`message` shape), so it is consistent with existing practice even absent formal gates.

## Project Structure

### Documentation (this feature)

```text
specs/017-mcp-email-telegram-tools/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── mcp-tools-messaging.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── lib/
│   ├── messaging/                 # NEW — domain logic, mirrors lib/oauth/ and lib/storage/
│   │   ├── config.ts              # reads SMTP_*/TELEGRAM_*/MESSAGING_RATE_LIMIT_* env vars (research.md §7)
│   │   ├── errors.ts              # MessagingError + error-code constants (research.md §6)
│   │   ├── store.ts               # getRecord/putRecord/listRecords over the .messaging/ prefix (research.md §3, §4; mirrors lib/oauth/store.ts)
│   │   ├── rateLimit.ts           # shared fixed-window counter (data-model.md Rate Limit State)
│   │   ├── auditLog.ts            # writes Send Attempt Records (data-model.md)
│   │   ├── email.ts               # sendEmail() via nodemailer (research.md §1)
│   │   ├── telegram.ts            # sendTelegramMessage() via fetch (research.md §2)
│   │   └── validation.ts          # email-address regex, message-length checks (research.md §5)
│   └── mcp-tools/
│       ├── messagingTools.ts      # NEW — registerMessagingTools(server): send_email, send_telegram_message
│       ├── index.ts                # unchanged (existing filesystem tools)
│       ├── engineTools.ts          # unchanged (spec 016)
│       └── result.ts               # unchanged; ok() reused as-is, errorResult() untouched (messaging uses its own wrapper, research.md §6)
├── app/mcp/route.ts                # add `await registerMessagingTools(server);` alongside the existing two calls
└── instrumentation.ts              # add a non-fatal startup warning for missing SMTP/Telegram config (research.md §7, mirrors the existing OAuth-owner-credential warning)
```

**Structure Decision**: Single Next.js app (`frontend/`), no new project or package. Follows this repo's established split exactly: feature domain logic lives in its own `lib/<concern>/` directory (here `lib/messaging/`, alongside the existing `lib/storage/` and `lib/oauth/`), and MCP tool *registration* is a thin adapter in `lib/mcp-tools/` that calls into that domain logic — matching how `lib/mcp-tools/index.ts` calls into `lib/storage/*` today. No new top-level directories, no new deployment target, no new runtime.

## Complexity Tracking

No violations — Constitution Check is N/A (unfilled template project).
