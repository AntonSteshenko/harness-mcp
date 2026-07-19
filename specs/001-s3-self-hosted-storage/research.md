# Research: Local Self-Hosted S3 Storage

**Input**: [spec.md](./spec.md) — Clarifications session 2026-07-19

All unknowns from the Technical Context have been resolved below; no `NEEDS CLARIFICATION` markers remain.

## 1. Storage engine

**Decision**: Use the official `minio/minio` Docker image as the S3-compatible storage engine.

**Rationale**: Explicitly mandated by the user during clarification (spec.md Clarifications, Q1). MinIO is a mature, widely-adopted, open-source, S3 API-compatible server distributed as an official Docker image, which satisfies FR-001 and FR-003 with zero custom server code. It also ships a built-in web console in the same image, which covers FR-012 (visual inspection) without adding another service.

**Alternatives considered**:
- Custom-built S3-compatible server — explicitly rejected by the user ("non creeremo da zero").
- LocalStack — broader AWS service emulation than needed; heavier image and startup for a feature scoped to object storage only.
- s3rver / fake-s3 — smaller community, weaker S3 API fidelity, no bundled console.

## 2. Default bucket provisioning — REMOVED

**Original decision (2026-07-19, superseded same day)**: Run a one-shot `minio/mc` (MinIO Client) container (`createbuckets`) as part of the same Docker Compose file, waiting for MinIO to become healthy, then creating default buckets idempotently before exiting. This implemented FR-013 per the clarification answer at the time.

**Reversal**: The user later decided default bucket auto-provisioning was not needed ("togliamo create buckets, non serve"). The `createbuckets` service and FR-013 were removed from `docker-compose.yml` and spec.md. Bucket creation is now left entirely to the developer via the S3 API (User Story 2), matching Option B from the original clarification question.

## 3. Data persistence & reset

**Decision**: Persist MinIO's data directory in a named Docker volume declared in the Compose file. Reset is performed by removing that named volume (`docker compose down -v`, or a thin wrapper script) and restarting.

**Rationale**: Satisfies FR-007 (survives restarts) and FR-008 (full wipe on demand) using only native Docker Compose/volume mechanics — no extra state-tracking code needed. Removing a named volume is well-understood, fast (satisfies SC-004's <30s target), and cannot partially corrupt data the way an in-place directory wipe might.

**Alternatives considered**:
- Bind-mounting a host directory — works, but introduces host-OS path/permission differences (notably on Windows/macOS Docker Desktop) that a named volume avoids.
- Ephemeral (non-persisted) container storage — rejected, fails FR-007 outright.

## 4. Credentials

**Decision**: Set fixed `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` values as plain, committed environment values directly in `docker-compose.yml`.

**Rationale**: Matches the clarification answer (Q3, Option A): zero-setup, no `.env` file to create/gitignore/onboard. Acceptable because the credentials only ever protect local, non-production, disposable data (FR-009, FR-011); there is no real secret being protected.

**Alternatives considered**:
- `.env` file — explicitly not chosen (Option B rejected in favor of Option A).
- External secrets manager — unnecessary overhead for a local-only, single-developer-machine service.

## 5. Port conflict handling

**Decision**: Rely on native Docker Compose port-binding behavior — if a configured host port is already bound, `docker compose up` fails immediately with an OS-level "address already in use" error. No custom pre-flight check or auto-fallback logic is added. Host ports are still expressed with an overridable default (e.g. `${MINIO_API_PORT:-9000}:9000`) so a developer can free themselves from a conflict by exporting a different value rather than editing the compose file.

**Rationale**: Directly satisfies FR-014 and the clarified answer (Q4, Option A: fail fast, no silent fallback) using behavior Docker already provides for free.

**Alternatives considered**:
- Custom auto-port-selection script — explicitly rejected by clarification (Option B).

## 6. Validation approach

**Decision**: Validate the feature end-to-end using the MinIO Client (`mc`) or AWS CLI against the running local endpoint (create bucket, put/get/list/delete object), documented as a runnable procedure in `quickstart.md`, rather than a conventional application unit-test suite.

**Rationale**: This feature is infrastructure/configuration (a Docker Compose service definition around an existing, already-tested upstream image), not new application code — there is no custom business logic to unit test. Exercising the real S3 API end-to-end is the meaningful correctness check and maps directly to the spec's acceptance scenarios (User Story 2) and SC-002.

**Alternatives considered**:
- Formal automated integration test harness (e.g., a CI job running `mc`/AWS CLI assertions) — a reasonable future addition, left as an optional task rather than a plan blocker since no test framework is yet established in this (currently empty) repository.
