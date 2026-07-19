# harness-mcp

Local self-hosted S3-compatible object storage for development, powered by [MinIO](https://min.io/) and Docker Compose. See [specs/001-s3-self-hosted-storage/quickstart.md](specs/001-s3-self-hosted-storage/quickstart.md) for a full end-to-end validation walkthrough.

## Getting Started

This project includes a self-hosted, S3-compatible object storage service (MinIO) for local development. It runs entirely on your machine — no cloud account or credentials required.

Start it:

```sh
docker compose up -d
```

The S3 API is available at `http://localhost:9000` and the web console at `http://localhost:9001` (default credentials: `minioadmin` / `minioadmin`). Override the ports via `MINIO_API_PORT` / `MINIO_CONSOLE_PORT` (see `.env.example`) if either default port is already in use on your machine — startup will otherwise fail fast with a clear "port already in use" error rather than silently picking a different port.

Stop it:

```sh
docker compose stop
```

Always use `docker compose` (not the legacy `docker-compose`).

## Buckets & Objects

No buckets are created automatically — create whatever buckets you need with any S3-compatible client (e.g. the [MinIO Client `mc`](https://min.io/docs/minio/linux/reference/minio-mc.html) or the AWS CLI) pointed at `http://localhost:9000` using the credentials above. See [quickstart.md](specs/001-s3-self-hosted-storage/quickstart.md) for a full walkthrough.

## Resetting local data

To permanently wipe all locally stored buckets/objects and start fresh:

```sh
./scripts/reset-storage.sh
```

This stops the service, removes its data volume, and starts it back up with no buckets present.
