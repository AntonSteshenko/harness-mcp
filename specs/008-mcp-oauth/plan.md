# Implementation Plan: OAuth Authorization for the MCP Server

**Branch**: `008-mcp-oauth` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-mcp-oauth/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Gate the existing MCP server (`frontend/app/mcp/route.ts`) behind OAuth 2.1 so hosted AI assistants (ChatGPT, Claude, and any other MCP-compatible client) can add it as a remote connector: the MCP route becomes an OAuth Protected Resource via `mcp-handler`'s `withMcpAuth` (already a dependency), backed by a first-party Authorization Server implemented as plain Next.js Route Handlers (Dynamic Client Registration, Authorization Code + PKCE, refresh, revocation — research.md §1), a dedicated owner sign-in credential separate from the existing S3/MinIO storage credentials (research.md §4), and durable state (registered clients, tokens, audit log) persisted in the app's existing S3-compatible bucket rather than a new database (research.md §2).

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16 (App Router), Node.js 18+ (per `mcp-handler`'s stated requirement)

**Primary Dependencies**: `mcp-handler` 1.1.0 (`withMcpAuth`, `protectedResourceHandler`, `metadataCorsOptionsRequestHandler` — already a dependency), `@modelcontextprotocol/sdk` 1.26.0 (types only: `OAuthClientInformationFull`, `OAuthTokens`, `AuthInfo`, `OAuthMetadata` — already a dependency), `@aws-sdk/client-s3` 3.1090.0 (already a dependency, reused for OAuth persistence), `zod` 4.4.3 (already a dependency, for request validation), Node's built-in `crypto` (`scrypt` for the owner password hash, `subtle.digest` for PKCE S256) — no new runtime dependency required (research.md §1, §4)

**Storage**: Reuses the app's existing configured S3-compatible bucket (spec 007) under a reserved `.oauth/` key prefix — no new database (research.md §2)

**Testing**: No automated test suite exists in this project (specs 001–007 all validate via a runnable `quickstart.md` walkthrough instead) — this feature follows the same convention; see [quickstart.md](quickstart.md)

**Target Platform**: Node.js server; runs locally (`npm run dev`) and deploys to Vercel (README, spec 006) — Route Handlers here target the Node runtime (not Edge), since `@aws-sdk/client-s3` and Node's `crypto.scrypt` are used

**Project Type**: Web application — single Next.js project (`frontend/`), extending its existing `app/` + `lib/` structure; no new project/service is introduced

**Performance Goals**: N/A beyond standard interactive-latency expectations for a single-owner tool — not a scale-sensitive feature

**Constraints**: Must work within Vercel's serverless model (stateless, ephemeral filesystem between invocations) — drives the decision to persist all OAuth state externally in S3 rather than in memory or on local disk (research.md §2, §3). Must not introduce an Express dependency into an Express-free App Router codebase (research.md §1).

**Scale/Scope**: Single owner; a handful of connected clients expected (ChatGPT, Claude, maybe a few more) — no concurrency/scale concerns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still unfilled template placeholder content — no project principles have been ratified yet, so there are no gates to check against. Nothing to re-check post-design.

## Project Structure

### Documentation (this feature)

```text
specs/008-mcp-oauth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── oauth-endpoints.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── mcp/
│   │   └── route.ts                        # existing MCP route — wrapped with withMcpAuth
│   ├── .well-known/
│   │   ├── oauth-authorization-server/route.ts   # RFC 8414 AS metadata
│   │   └── oauth-protected-resource/route.ts     # RFC 9728, via mcp-handler's protectedResourceHandler
│   ├── oauth/
│   │   ├── register/route.ts               # Dynamic Client Registration (RFC 7591)
│   │   ├── authorize/route.ts               # GET: start flow / render consent
│   │   ├── authorize/decision/route.ts      # POST: owner approve/deny
│   │   ├── token/route.ts                   # POST: code exchange + refresh
│   │   ├── revoke/route.ts                  # POST: RFC 7009 revocation
│   │   ├── login/
│   │   │   ├── page.tsx                     # owner sign-in form
│   │   │   └── route.ts                     # POST handler for login
│   │   └── authorize/
│   │       └── page.tsx                     # consent screen UI
│   └── settings/
│       └── connected-apps/
│           ├── page.tsx                     # list + revoke UI (User Story 3)
│           └── [grantId]/revoke/route.ts
├── lib/
│   ├── storage/                             # existing (spec 001/002/007) — unchanged
│   ├── mcp-tools/                           # existing — unchanged
│   └── oauth/                               # new
│       ├── config.ts                        # OAUTH_OWNER_USERNAME / OAUTH_OWNER_PASSWORD (data-model.md OwnerCredential)
│       ├── store.ts                         # S3-backed read/write for .oauth/* records (data-model.md)
│       ├── pkce.ts                          # S256 challenge/verifier check (Web Crypto)
│       ├── tokens.ts                        # opaque token issuance/verification (research.md §5)
│       ├── session.ts                       # owner sign-in session (cookie-based)
│       └── rateLimit.ts                     # LoginAttemptState checks (FR-013)
└── instrumentation.ts                        # existing — extended to validate OwnerCredential config at startup, same fail-fast pattern as storage config
```

**Structure Decision**: Single Next.js project at `frontend/` (no new project/service). This feature extends the existing `app/` route tree and adds one new `lib/oauth/` module, following the same conventions already established by `lib/storage/` (config/validate/fail-fast at startup) and `lib/mcp-tools/` (spec 002). No `backend/` split — the MCP server, its new Authorization Server, and the owner-facing UI all live in the one deployed Next.js app, matching spec 006's "single Vercel project" structure.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
