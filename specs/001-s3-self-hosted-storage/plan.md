# Implementation Plan: Local Self-Hosted S3 Storage

**Branch**: `001-s3-self-hosted-storage` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-s3-self-hosted-storage/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Provide a self-hosted, S3-compatible object storage service that developers can start and stop locally via Docker Compose, built on the official `minio/minio` Docker image (per user directive — no custom-built engine). A one-shot `mc`-based bootstrap container creates default buckets on first startup; data persists in a named Docker volume across restarts and can be fully wiped via `docker compose down -v`; credentials are fixed values committed in `docker-compose.yml`; host ports default sensibly but are overridable to resolve conflicts, and startup fails fast (native Docker behavior) rather than silently falling back to another port.

## Technical Context

**Language/Version**: N/A (no application code) — Docker Compose YAML + shell for lifecycle/validation scripts (see research.md §6)

**Primary Dependencies**: `minio/minio` Docker image (S3 API + web console), `minio/mc` Docker image (one-shot bucket bootstrap), Docker Compose v2 (`docker compose`, per project convention — not `docker-compose`)

**Storage**: MinIO-managed object storage, backed by a named Docker volume for persistence

**Testing**: Manual/scripted S3 API smoke test via `mc` or AWS CLI, documented in quickstart.md (research.md §6) — no unit-test framework applicable since there is no custom application code

**Target Platform**: Developer local machines running Docker Desktop or Docker Engine (Linux/macOS/Windows)

**Project Type**: Local infrastructure/dev-environment service (single Docker Compose service definition + a bootstrap sidecar), not an application with src/tests layout

**Performance Goals**: Service reachable within ~2 minutes of a cold start (SC-001); no other throughput/latency targets — local single-developer usage only

**Constraints**: Must run via `docker compose` (not `docker-compose`, per project convention); no internet dependency after images are pulled (FR-010); single-node, non-HA (per spec Assumptions); fixed local-only credentials (FR-009)

**Scale/Scope**: Single developer machine, single storage instance, a small number of default buckets — no multi-tenant or concurrent-team access modeled

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` contains only unfilled template placeholders (no project-specific principles have been ratified yet). There are no concrete gates to evaluate against, so this check trivially passes with no violations to record in Complexity Tracking. If the constitution is filled in later, this feature should be re-checked against it before implementation is considered final.

## Project Structure

### Documentation (this feature)

```text
specs/001-s3-self-hosted-storage/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
docker-compose.yml       # MinIO service + one-shot bucket-bootstrap (createbuckets) service
.env.example              # Documents overridable port variables (MINIO_API_PORT, MINIO_CONSOLE_PORT); credentials are NOT here — they are fixed values committed directly in docker-compose.yml per clarification
scripts/
└── reset-storage.sh      # Thin wrapper for the documented reset procedure (docker compose down -v && docker compose up -d)
```

**Structure Decision**: This is a local infrastructure/config feature, not application code, so none of the standard src/tests project layouts apply. The repository is currently empty aside from Spec Kit scaffolding, so this feature introduces a root-level `docker-compose.yml` (the MinIO service plus its `mc`-based bucket-bootstrap sidecar, per research.md §1–§2) and a small `scripts/` helper for the reset workflow (research.md §3, FR-008). Validation lives in `quickstart.md` rather than a `tests/` tree, per research.md §6.

## Complexity Tracking

Not applicable — Constitution Check recorded no violations (no ratified project principles exist yet to violate).
