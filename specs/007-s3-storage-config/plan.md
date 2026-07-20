# Implementation Plan: Configurable S3-Compatible Storage Connection

**Branch**: `007-s3-storage-config` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-s3-storage-config/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the hardcoded, MinIO-only `S3Client` construction in `frontend/lib/storage/client.ts` with a small config-loading layer (`frontend/lib/storage/config.ts`) that reads a generic set of `S3_*` environment variables (endpoint, region, access key, secret key, bucket, path-style toggle — spec.md FR-001, FR-011, FR-012) and validates them eagerly, once, at process startup via Next.js's `instrumentation.ts` hook (research.md §2) — failing fast with a clear error if required values are missing (FR-004) or the endpoint/credentials/bucket don't check out (FR-005). The previous implicit "auto-create the bucket if missing" behavior in `ensureBucket()` is removed in favor of a fail-fast "bucket must already exist" check (research.md §3), since silently creating buckets is unsafe/impossible against arbitrary third-party providers and contradicts spec 001's original developer-owns-bucket-creation decision. A new `frontend/.env.example` documents the required variables (FR-009) at the location Next.js actually loads env files from (research.md §1), leaving the existing root `.env.example` untouched as the docker-compose/MinIO-container configuration surface. No change to `docker-compose.yml`, the MCP tool surface, or the web file explorer's UI/behavior (FR-007) — only the connection layer underneath them changes.

## Technical Context

**Language/Version**: TypeScript on Node.js, Next.js 16.2.10 (App Router) — same app as specs 002-006, no version change.

**Primary Dependencies**: `@aws-sdk/client-s3` 3.1090.0 (already installed) — its `S3Client` constructor already accepts arbitrary `endpoint`, `region`, `credentials`, and `forcePathStyle`, which is all FR-001/FR-011/FR-012 require; no new dependency and no version bump needed.

**Storage**: Any S3-API-compatible object storage, selected entirely by environment configuration (was: hardcoded to the local MinIO instance from spec 001). Exactly one active configuration (FR-003), read once at process startup (FR-010).

**Testing**: No automated test suite requested (consistent with specs 001-006); validated via the startup-failure and provider-switch walkthroughs in quickstart.md. Per user instruction, tests are not executed as part of this workflow.

**Target Platform**: Same developer-local Next.js process (`npm run dev` / `next start`, run from `frontend/`) or a future Vercel-hosted deployment (out of scope to actually configure here — spec.md Assumptions); startup validation runs via Next.js's `instrumentation.ts` `register()` hook, which executes once per server instance on both.

**Project Type**: Single Next.js web application (existing `frontend/`) — no new service, process, or package is introduced.

**Performance Goals**: N/A for the request path (no change to per-operation latency); the one-time startup connectivity check (FR-005) should resolve in a few seconds so `npm run dev`/`next start` doesn't appear to hang.

**Constraints**: Exactly one active configuration at a time (FR-003); no hot-reload — config changes require a restart (FR-010); secret values never appear in logs (FR-008); existing MCP server and web file explorer behavior must stay identical regardless of provider (FR-007).

**Scale/Scope**: Touches `frontend/lib/storage/client.ts` (rewritten), a new `frontend/lib/storage/config.ts`, a new `frontend/instrumentation.ts`, minor call-site cleanup in `files.ts`/`directories.ts`/`move.ts`/`paths.ts` (drop the now-redundant per-call `ensureBucket()`), a new `frontend/.env.example`, and documentation updates (`README.md`). `docker-compose.yml` and the MinIO container itself are unchanged.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` still contains only unfilled template placeholders (same state as specs 001-006). No concrete gates exist to evaluate against, so this check trivially passes with no violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-s3-storage-config/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── storage-env-contract.md   # The environment-variable interface this feature exposes to operators
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── instrumentation.ts          # NEW — Next.js startup hook; calls verifyStorageConnection() once at boot (FR-004, FR-005)
├── lib/
│   └── storage/
│       ├── config.ts             # NEW — reads S3_* env vars into a StorageConnectionConfig, throws StorageConfigError if incomplete (FR-001, FR-004, FR-011, FR-012)
│       ├── client.ts              # MODIFIED — builds S3Client from config.ts; verifyStorageConnection() (HeadBucket) replaces the old auto-create ensureBucket()
│       ├── errors.ts               # MODIFIED — adds StorageConfigError for startup-time misconfiguration/connectivity failures
│       ├── files.ts                 # MODIFIED — drop per-call ensureBucket() (startup check already covers it)
│       ├── directories.ts            # MODIFIED — same
│       ├── move.ts                    # MODIFIED — same
│       └── paths.ts                    # MODIFIED — same
├── .env.example                         # NEW — documents S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_FORCE_PATH_STYLE (FR-009)
├── app/                                  # (existing — unchanged content)
└── package.json                           # (existing — unchanged, no new dependency)

# Repo root — unchanged:
docker-compose.yml   # (existing, spec 001 — unchanged; still starts the local MinIO container)
.env.example          # (existing, spec 001/002 — unchanged; still documents MinIO container/port vars for docker compose)
data/                  # (existing, spec 001 — unchanged, git-ignored)
scripts/
└── reset-storage.sh    # (existing, spec 001 — unchanged)
README.md                # EXTENDED — documents frontend/.env.example, the new S3_* vars, and the one-time bucket-must-exist step (research.md §3)
```

**Structure Decision**: This stays a single Next.js application; the change is confined to the existing storage-adapter layer (`frontend/lib/storage/*`) plus one new startup hook (`frontend/instrumentation.ts`) and one new env-example file at the location Next.js actually reads env files from (`frontend/`, research.md §1). No new project, service, or package is created — consistent with spec.md's scope of "externalize configuration," not "redesign the storage layer's public shape" (every existing caller of `s3Client`/`BUCKET` keeps working unchanged, per FR-007).

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
