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

This stops the service, clears its data, and starts it back up with no buckets present.

## Where the data lives

Storage data is bind-mounted to `./data/minio` on the host (not a Docker-managed volume), so bucket/object structure is visible outside Docker. Note that MinIO stores each object's content wrapped in its own binary `xl.meta` format (small objects are inlined directly into it) rather than as a plain file — so you can browse the bucket/key folder layout under `./data/minio`, but you can't open an object's content directly in a text editor from there. Use the S3 API (or the web console) to read/write actual content. This folder is git-ignored and owned by `root` on Linux hosts (MinIO's container runs as root); use `./scripts/reset-storage.sh` rather than a manual `rm -rf` to clear it without needing `sudo`.

## S3 Storage MCP Server

An MCP server exposes the local storage above as filesystem-like tools (create/read/update/delete files; create/list/delete directories, recursively; move/rename either) — see [specs/002-s3-mcp-server/contracts/mcp-tools.md](specs/002-s3-mcp-server/contracts/mcp-tools.md) for the full tool list, and [specs/002-s3-mcp-server/quickstart.md](specs/002-s3-mcp-server/quickstart.md) for a runnable walkthrough.

Prerequisites: the storage stack above must be running (`docker compose up -d`).

Install dependencies once:

```sh
npm install
```

Start the MCP server:

```sh
npm run dev
```

This exposes the MCP endpoint (Streamable HTTP) at `http://localhost:3000/mcp`. It operates against a single, dedicated bucket (`MCP_STORAGE_BUCKET` in `.env.example`, default `mcp-storage`), created automatically on first use — separate from any bucket you create manually via the section above.

## Web File Explorer & Markdown Editor

A browser UI at `/editor` (same app/dependencies as the MCP server above — `docker compose up -d` then `npm run dev` must both be running) lets you browse the `MCP_STORAGE_BUCKET` folder/file tree and edit *existing* files directly: `.md` files open in a split view (raw Markdown left, live-rendered preview right); everything else opens in a plain-text editor. Binary files are detected and shown with a clear "can't be edited here" message instead. Saves are explicit (no autosave) — unsaved changes are indicated, and you're warned before navigating away or closing the tab with changes pending. See [specs/003-web-file-editor/contracts/api-routes.md](specs/003-web-file-editor/contracts/api-routes.md) for the underlying API and [specs/003-web-file-editor/quickstart.md](specs/003-web-file-editor/quickstart.md) for a full walkthrough.

Open it at: `http://localhost:3000/editor`
