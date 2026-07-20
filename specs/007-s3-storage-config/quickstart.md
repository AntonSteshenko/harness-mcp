# Quickstart: Configurable S3-Compatible Storage Connection

**Input**: [spec.md](./spec.md), [contracts/storage-env-contract.md](./contracts/storage-env-contract.md), [data-model.md](./data-model.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes `frontend/instrumentation.ts`, `frontend/lib/storage/config.ts`, and the modified `frontend/lib/storage/client.ts` have already been implemented per tasks.md.

## Prerequisites

1. The spec 001 local storage stack is running: from the repo root, `docker compose up -d`.
2. Dependencies installed: `npm install` (from `frontend/`).
3. `frontend/.env.example` copied to `frontend/.env.local` (`cp frontend/.env.example frontend/.env.local` from the repo root), with values matching `docker-compose.yml`'s fixed local credentials by default.
4. The configured bucket already exists (research.md §3 — this feature does not auto-create it): create it once via the MinIO web console at `http://localhost:${MINIO_CONSOLE_PORT:-9001}` (log in with `minioadmin`/`minioadmin`, create bucket `mcp-storage`), or via any S3-compatible CLI pointed at the same endpoint/credentials.

## 1. Normal startup against the local self-hosted storage (validates User Story 1, FR-001–FR-003, FR-011, SC-001)

With `frontend/.env.local` pointing at the local MinIO endpoint (`S3_ENDPOINT=http://localhost:9000`, `S3_ACCESS_KEY_ID=minioadmin`, `S3_SECRET_ACCESS_KEY=minioadmin`, `S3_BUCKET=mcp-storage`, `S3_FORCE_PATH_STYLE=true`) and the bucket already created, run `npm run dev` from `frontend/`.

Expected: the server starts normally with no error; a basic MCP `create_file`/`read_file` round trip (see `specs/002-s3-mcp-server/quickstart.md` §1) succeeds exactly as before this feature.

## 2. Fail fast on missing configuration (validates User Story 2, FR-004, SC-002)

Temporarily remove `S3_SECRET_ACCESS_KEY` from `frontend/.env.local` and restart (`npm run dev`).

Expected: the process fails to start; the error message explicitly names `S3_SECRET_ACCESS_KEY` as missing. Restore the value before continuing.

## 3. Fail fast on unreachable endpoint / rejected credentials (validates User Story 2, FR-005, SC-002)

Set `S3_ENDPOINT` to an address nothing is listening on (e.g. `http://localhost:9999`) and restart.

Expected: the process fails to start with a clear "storage endpoint unreachable" error, not a hang or a generic crash.

Restore `S3_ENDPOINT`, then set `S3_SECRET_ACCESS_KEY` to an obviously wrong value and restart.

Expected: the process fails to start with a clear "credentials rejected" error. Restore the correct value before continuing.

## 4. Fail fast on missing bucket (validates spec.md Edge Cases, research.md §3)

Set `S3_BUCKET` to a bucket name that does not exist (e.g. `does-not-exist`) and restart.

Expected: the process fails to start with a clear "bucket not found" error — the bucket is **not** silently created. Restore the correct bucket name before continuing.

## 5. Switching providers with zero code changes (validates User Story 1, FR-002, FR-006, SC-001)

Point `frontend/.env.local` at a second S3-compatible target (any reachable one available for testing — e.g. a second local MinIO instance on a different port, or a cloud provider's S3-compatible bucket with its own endpoint/credentials/bucket name and, if needed, `S3_FORCE_PATH_STYLE=false`). Restart the server.

Expected: startup succeeds against the new target with no code change; a `create_file`/`read_file` round trip against it succeeds, confirming the same behavior as against the local storage (SC-003).

## 6. Existing MCP server and web file explorer behavior is unaffected (validates User Story 3, FR-007, SC-003)

With the server pointed back at the local self-hosted storage, run the full `specs/002-s3-mcp-server/quickstart.md` walkthrough (§1–§6) and the web file explorer manually (create/edit/delete a file and a folder through the browser UI).

Expected: every step behaves identically to before this feature — no MCP tool response shape, error code, or UI behavior has changed; only the underlying connection configuration is new.

## 7. Secrets never appear in logs (validates FR-008)

Repeat scenario 2 (missing `S3_SECRET_ACCESS_KEY`) and scenario 3 (wrong `S3_SECRET_ACCESS_KEY`) while watching the server's console output.

Expected: the actual secret value never appears in any log line or error message — only the variable name `S3_SECRET_ACCESS_KEY`.
