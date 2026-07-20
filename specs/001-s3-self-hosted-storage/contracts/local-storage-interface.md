# Contract: Local Storage Service Interface

**Input**: [spec.md](../spec.md), [research.md](../research.md)

This is the interface other local services/tools in this project (and the developer, via any S3-compatible client) can rely on once the storage service is running via Docker Compose. The wire-level API itself is the standard S3 REST API (implemented by MinIO) — not something this project defines; this document fixes the *local configuration contract* around it: endpoints, credentials, and default resources.

## Endpoints

| Interface | Default host address | Purpose |
|---|---|---|
| S3 API | `http://localhost:${MINIO_API_PORT:-9000}` | Standard S3-compatible REST API (bucket/object operations) — satisfies FR-003. |
| Web Console | `http://localhost:${MINIO_CONSOLE_PORT:-9001}` | Browser UI to inspect buckets/objects — satisfies FR-012. |

From other containers on the same Docker Compose network, the S3 API is also reachable at `http://<service-name>:9000` using the service's internal Compose network alias, without needing the published host port.

Both port numbers are overridable via environment variables with the defaults shown, so a developer can resolve a local port conflict (FR-014) without editing `docker-compose.yml`.

## Authentication

Fixed, local-only credentials, committed in `docker-compose.yml` (per clarification — not a `.env` file):

| Credential | Env var (maps to MinIO) |
|---|---|
| Access key | `MINIO_ROOT_USER` |
| Secret key | `MINIO_ROOT_PASSWORD` |

These credentials are valid only against this local instance and MUST NOT be reused against any production or cloud storage account (FR-011).

## Default resources

None. No buckets are created automatically (FR-013 and the `createbuckets` bootstrap service were removed on 2026-07-19 — decided not needed). Developers create whatever buckets they need via the S3 API.

## Operational contract

| Behavior | Guarantee |
|---|---|
| Start | `docker compose up` (project-standard invocation) brings the service up; endpoint is reachable within the startup budget in SC-001. |
| Stop | `docker compose stop` (or `down`) stops the service; data is retained in the bind-mounted `./data/minio` host folder (research.md §3). |
| Restart | Previously stored buckets/objects are present and retrievable after the service comes back up (FR-007). |
| Reset | `./scripts/reset-storage.sh` permanently removes all stored data by clearing `./data/minio` via a throwaway container, then restarting (FR-008, SC-004). |
| Port conflict | Startup fails with Docker's own clear "port already in use" error; no silent fallback (FR-014). |
| Already running | Re-issuing the start command does not create a duplicate instance; Docker Compose reports the existing service is already up. |
| Invalid names | Bucket/object operations with malformed names are rejected with a clear S3 API error (FR-006). |
