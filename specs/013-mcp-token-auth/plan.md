# Implementation Plan: MCP Personal Access Token Authentication

**Branch**: `013-mcp-token-auth` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-mcp-token-auth/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The MCP server (`/mcp`) currently only accepts OAuth-issued access tokens (spec 008), which requires every client to complete a full authorization/consent flow — impractical for simple local clients (scripts, CLI tools, `.mcp.json`-configured assistants) that just need a static bearer credential. This feature adds a second, independent authentication method: owner-generated **personal access tokens**. The owner creates a named, non-expiring token from a new settings page (shown once, in full, at creation); the MCP server's existing bearer-token check gains a fallback that recognizes these tokens and grants the same full-access level as an OAuth client, with no change to OAuth's existing behavior. Tokens are listed (never re-showing the secret) and independently revocable, and persist durably across restarts, reusing the exact `.oauth/` KV storage spec 008 already established.

## Technical Context

**Language/Version**: TypeScript 5.9 (Next.js 16 App Router, Node.js runtime)

**Primary Dependencies**: `@modelcontextprotocol/sdk` + `mcp-handler` (existing `withMcpAuth` bearer-token check, spec 008), Node's built-in `node:crypto` (`randomBytes`, same opaque-token generation already used by `lib/oauth/tokens.ts`). No new npm dependency.

**Storage**: S3-compatible object storage (MinIO, spec 001), reusing the existing reserved `.oauth/` key prefix and `lib/oauth/store.ts` KV helpers (`getRecord`/`putRecord`/`listRecords`) spec 008 already established — no new storage mechanism.

**Testing**: No automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough (including a `curl` bearer-token check against a running `next dev` instance), consistent with specs 001-012.

**Target Platform**: Linux server / local dev; same Next.js Route Handler (`/mcp`) and App Router settings pages that already host spec 008/009's OAuth and owner-session flows.

**Project Type**: web — single Next.js app (`frontend/`); this feature adds one library module, two new settings routes/pages, and a small edit to the existing `/mcp` auth callback.

**Performance Goals**: No new targets — reuses the existing single direct-key-lookup verification pattern (`getRecord` by token value) already used for OAuth access tokens, so per-request auth check cost is unchanged in shape.

**Constraints**: Must not change OAuth's existing behavior or response shapes (spec 008, SC-004); personal access tokens must never be re-displayed or logged in full after creation (FR-002); no new MCP tools are introduced — this is purely an authentication-layer change, like spec 011's Trash feature was purely a storage-layer change.

**Scale/Scope**: Single owner, expected to hold a handful of personal access tokens (one per machine/script) — same low-volume scale as spec 008's connected OAuth clients.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (all sections are placeholders — no ratified principles exist for this project). No gates apply; nothing to check against. Re-confirmed after Phase 1: still N/A.

## Project Structure

### Documentation (this feature)

```text
specs/013-mcp-token-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── personal-access-tokens.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── lib/
│   └── oauth/
│       ├── personalAccessTokens.ts  # NEW: create/list/revoke/verify a PersonalAccessToken
│       ├── types.ts                 # MODIFIED: adds PersonalAccessToken type; AuditEvent gains "pat_created"/"pat_revoked"
│       ├── store.ts                 # UNCHANGED: existing getRecord/putRecord/listRecords reused as-is
│       ├── session.ts               # UNCHANGED: existing hasActiveOwnerSession()/requireOwnerSession() reused as-is
│       └── tokens.ts                # UNCHANGED: verifyAccessToken untouched; its opaque-token generation approach is mirrored, not imported cross-module
└── app/
    ├── mcp/
    │   └── route.ts                 # MODIFIED: withMcpAuth callback falls back to verifyPersonalAccessToken
    └── settings/
        ├── connected-apps/          # UNCHANGED — existing OAuth clients UI, used only as this feature's pattern reference
        └── personal-access-tokens/
            ├── page.tsx             # NEW: list + create form, mirrors connected-apps/page.tsx
            ├── create/
            │   └── route.ts         # NEW: POST — creates a token, renders the secret once in the response body
            └── [id]/
                └── revoke/
                    └── route.ts     # NEW: POST — revokes by non-secret id, mirrors connected-apps' revoke route
```

**Structure Decision**: This feature lives entirely inside the existing single Next.js app (`frontend/`) established by specs 001-012 — no new project, service, or top-level directory. It extends the existing `lib/oauth/` module (spec 008) with one new file and a small type addition, adds one new settings area under `app/settings/` (mirroring the existing `connected-apps` pattern), and makes a minimal, additive edit to the single existing `/mcp` auth callback. No storage-layer, MCP-tool-registration, or web-editor changes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — Constitution Check is N/A (unfilled template project).
