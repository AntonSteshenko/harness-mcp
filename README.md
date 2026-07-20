# harness-mcp

Local self-hosted S3-compatible object storage for development, powered by [MinIO](https://min.io/) and Docker Compose. See [specs/001-s3-self-hosted-storage/quickstart.md](specs/001-s3-self-hosted-storage/quickstart.md) for a full end-to-end validation walkthrough.

The Next.js app (web editor + MCP server) lives entirely in [`frontend/`](frontend/) — that's the folder to point a future Vercel project's Root Directory setting at (see [specs/006-frontend-folder-structure](specs/006-frontend-folder-structure/spec.md)). Everything else at the repo root (`docker-compose.yml`, `data/`, `scripts/`) is local-dev infrastructure that isn't deployed.

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

## Configuring the app's storage connection

The Next.js app (`frontend/`) connects to any S3-compatible storage backend — not only the local MinIO instance above — via environment variables it reads at startup (see [specs/007-s3-storage-config](specs/007-s3-storage-config/spec.md)). These are separate from the repo-root `.env.example` above, which only configures the local MinIO *container*: Next.js loads env files from its own project root, so the app's own settings belong in `frontend/.env.local`, copied from [`frontend/.env.example`](frontend/.env.example):

```sh
cp frontend/.env.example frontend/.env.local
```

The defaults match the local MinIO instance started above. To point the app at a different S3-compatible provider, edit `frontend/.env.local` (endpoint, region, access key, secret key, bucket, and path-style vs. virtual-hosted-style addressing) and restart the app — no code changes required.

The configured bucket (`S3_BUCKET`) **must already exist** — the app validates the connection at startup and fails fast with a clear error if required settings are missing, the endpoint is unreachable, credentials are rejected, or the bucket doesn't exist, rather than starting broken or failing later. For the local MinIO instance, create the bucket once via the web console (`http://localhost:9001`) or any S3-compatible CLI before starting the app — see [specs/007-s3-storage-config/quickstart.md](specs/007-s3-storage-config/quickstart.md) for the full walkthrough.

## S3 Storage MCP Server

An MCP server exposes the configured storage above as filesystem-like tools (create/read/update/delete files; create/list/delete directories, recursively; move/rename either) — see [specs/002-s3-mcp-server/contracts/mcp-tools.md](specs/002-s3-mcp-server/contracts/mcp-tools.md) for the full tool list, and [specs/002-s3-mcp-server/quickstart.md](specs/002-s3-mcp-server/quickstart.md) for a runnable walkthrough.

Prerequisites: the storage backend must be running and reachable (e.g. `docker compose up -d` for local MinIO), its bucket must already exist, and `frontend/.env.local` must be set up per the section above.

Install dependencies once:

```sh
cd frontend
npm install
```

Start the MCP server:

```sh
cd frontend
npm run dev
```

This exposes the MCP endpoint (Streamable HTTP) at `http://localhost:3000/mcp`. It operates against a single, configured bucket (`S3_BUCKET` in `frontend/.env.example`, default `mcp-storage`) on whichever S3-compatible backend `frontend/.env.local` points at — separate from any bucket you create manually via the local-MinIO section above.

### Connecting AI assistants (ChatGPT, Claude, etc.) via OAuth

The MCP server requires OAuth (spec 008-mcp-oauth) before any tool call is allowed — this is what lets you add it as a remote connector in hosted AI assistants. One-time setup, in addition to the storage setup above:

1. Generate an owner sign-in credential (separate from the S3/MinIO credentials — this one gates who can approve AI assistants, not storage access):
   ```sh
   cd frontend
   node scripts/hash-owner-password.mjs '<choose a password>'
   ```
2. Add the printed hash, plus a username, to `frontend/.env.local`:
   ```
   OAUTH_OWNER_USERNAME=owner
   OAUTH_OWNER_PASSWORD_HASH=<printed value>
   ```
3. Start the server (`npm run dev`) — it fails fast at startup if these are missing or malformed, same as the storage settings above.

To add the server as a connector: in ChatGPT or Claude's "add connector"/"add MCP server" flow, point it at `http://localhost:3000/mcp` (or your deployed URL). The assistant discovers the OAuth flow automatically; you'll be prompted to sign in with the credential from step 2 and approve the connection. See [specs/008-mcp-oauth/quickstart.md](specs/008-mcp-oauth/quickstart.md) for the full walkthrough, including reviewing and revoking connected assistants at `/settings/connected-apps`.

## Web File Explorer & Markdown Editor

A browser UI at `/editor` (same app/dependencies as the MCP server above — `docker compose up -d` then `npm run dev` must both be running) lets you browse the `MCP_STORAGE_BUCKET` folder/file tree and edit *existing* files directly: `.md` files open in a split view (raw Markdown left, live-rendered preview right); everything else opens in a plain-text editor. Binary files are detected and shown with a clear "can't be edited here" message instead. Saves are explicit (no autosave) — unsaved changes are indicated, and you're warned before navigating away or closing the tab with changes pending. See [specs/003-web-file-editor/contracts/api-routes.md](specs/003-web-file-editor/contracts/api-routes.md) for the underlying API and [specs/003-web-file-editor/quickstart.md](specs/003-web-file-editor/quickstart.md) for a full walkthrough.

Open it at: `http://localhost:3000/editor`
