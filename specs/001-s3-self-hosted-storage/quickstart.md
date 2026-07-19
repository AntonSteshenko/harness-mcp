# Quickstart: Local Self-Hosted S3 Storage

**Input**: [spec.md](./spec.md), [contracts/local-storage-interface.md](./contracts/local-storage-interface.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes the Docker Compose service (see plan.md Project Structure) has already been implemented per tasks.md.

## Prerequisites

- Docker and Docker Compose (`docker compose`, not the legacy `docker-compose`) installed and running.
- A S3-compatible client available locally: either the MinIO Client (`mc`) or the AWS CLI (`aws s3` / `aws s3api`).

## 1. Start the service (validates User Story 1, FR-001–FR-003, SC-001)

```sh
docker compose up -d
```

Expected: within ~2 minutes, both the S3 API and the web console (see contracts/local-storage-interface.md for default ports) are reachable.

```sh
curl -sf http://localhost:${MINIO_API_PORT:-9000}/minio/health/live
```

Expected: HTTP 200 (empty body).

## 2. Exercise core bucket/object operations (validates User Story 2, FR-004–FR-006, SC-002)

No buckets exist automatically — create one first:

```sh
mc alias set local http://localhost:${MINIO_API_PORT:-9000} <access-key> <secret-key>
mc mb local/quickstart-test
echo "hello" > /tmp/hello.txt
mc cp /tmp/hello.txt local/quickstart-test/hello.txt
mc ls local/quickstart-test
mc cat local/quickstart-test/hello.txt
mc rm local/quickstart-test/hello.txt
mc rb local/quickstart-test
```

Expected: each step succeeds; the downloaded content matches what was uploaded; after `rm`/`rb` the object/bucket no longer appear in listings.

Also confirm rejection of an invalid name:

```sh
mc mb local/Invalid_Bucket_Name
```

Expected: the request is rejected with a clear naming-rule error (not a silent failure).

## 3. Confirm persistence across restarts (validates User Story 3, FR-007, SC-003)

```sh
mc mb local/persist-test
mc cp /tmp/hello.txt local/persist-test/hello.txt
docker compose restart
mc ls local/persist-test
```

Expected: `hello.txt` is still listed after the restart.

## 4. Reset to a clean slate (validates FR-008, SC-004)

```sh
docker compose down -v
docker compose up -d
mc ls local
```

Expected: completes in under 30 seconds; no buckets are present — the `persist-test` bucket from step 3 is gone.

## 5. Port conflict behavior (validates FR-014)

With the service already running, start something else bound to the same host port, then attempt:

```sh
docker compose up -d
```

Expected: Docker Compose fails fast with a clear "port is already allocated" error; it does not silently start on a different port.

## 6. Stop the service

```sh
docker compose stop
```

Expected: endpoint becomes unreachable; previously stored data (from step 2 onward, minus anything explicitly deleted) is retained for the next `docker compose up -d`.
