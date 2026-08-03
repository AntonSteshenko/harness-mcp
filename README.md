# harness-mcp

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AntonSteshenko/harness-mcp&root-directory=frontend)

An autonomous, serverless system for running an AI-based Company OS. It can be deployed to serverless platforms like Vercel (or similar) or run locally on Node.js, and requires an external S3-compatible object storage backend — either your own, or a local self-hosted MinIO instance for development.

This repo pairs that local MinIO setup with the Next.js app that uses it. See [specs/001-s3-self-hosted-storage/quickstart.md](specs/001-s3-self-hosted-storage/quickstart.md) for a full end-to-end validation walkthrough.

The Next.js app (web editor + MCP server) lives entirely in [`frontend/`](frontend/) — that's the folder to point a future Vercel project's Root Directory setting at (see [specs/006-frontend-folder-structure](specs/006-frontend-folder-structure/spec.md)). Everything else at the repo root (`docker-compose.yml`, `data/`, `scripts/`) is local-dev infrastructure that isn't deployed.

## Technical Overview

- **App**: [`frontend/`](frontend/) is a single Next.js 16 (App Router) application in TypeScript, serving both the web editor UI and the MCP server from one deployable unit — no separate backend service.
- **MCP server**: built on `@modelcontextprotocol/sdk` + `mcp-handler`, exposed as a Streamable HTTP endpoint at `/mcp` (see [S3 Storage MCP Server](#s3-storage-mcp-server) below).
- **Storage**: all persisted state — files/directories exposed via MCP and the editor, plus OAuth clients/sessions and personal access tokens — lives in a single S3-compatible bucket, accessed via `@aws-sdk/client-s3`. No database is used; the bucket *is* the datastore.
- **Auth**: two independent ways to authenticate to the MCP server — full OAuth 2.0 (for hosted AI assistants like ChatGPT/Claude adding it as a connector, spec [008-mcp-oauth](specs/008-mcp-oauth/)) and owner-generated, non-expiring personal access tokens (for scripts/CLI tools/`.mcp.json`, spec [013-mcp-token-auth](specs/013-mcp-token-auth/)). The web editor at `/files` is gated by the same owner credential (spec [009-editor-login-gate](specs/009-editor-login-gate/)).
- **Statelessness**: because all state lives in the S3 bucket rather than on local disk or in-memory, the app is safe to run as ephemeral serverless functions (e.g. on Vercel) — any instance can serve any request.
- **No code changes to switch storage backend**: any S3-compatible provider works (self-hosted MinIO, AWS S3, or another compatible service) — swap it via environment variables only; see below.

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

The configured bucket (`S3_BUCKET`) **must already exist**. The app validates the connection at startup and logs a clear warning if required settings are missing, the endpoint is unreachable, credentials are rejected, or the bucket doesn't exist — but it no longer refuses to start over this (spec 014-os-init-page superseding spec 007's original fail-fast behavior): every request is instead sent to [`/init`](#connecting-storage-from-the-app-init) until storage is reachable, so the app is always up to guide you through fixing it. For the local MinIO instance, create the bucket once via the web console (`http://localhost:9001`) or any S3-compatible CLI before starting the app — see [specs/007-s3-storage-config/quickstart.md](specs/007-s3-storage-config/quickstart.md) for the full walkthrough.

## Connecting storage from the app (`/init`)

If storage isn't connected yet (missing configuration, unreachable endpoint, rejected credentials, or a missing bucket) — including a completely fresh clone or deploy with no configuration at all — every page redirects to `/init`, which shows a setup helper covering everything the app needs to run in one place: the storage connection, the owner sign-in credential, and an optional system name. Fill it in and it generates one ready-to-paste configuration snippet, plus plain instructions for applying it either locally (`frontend/.env.local`) or on a hosting provider (e.g. Vercel: Project → Settings → Environment Variables → paste). Nothing typed into this helper is ever sent to the server; apply the snippet yourself and restart/redeploy.

Once storage is connected and signed in as the owner (see below), `/init` also bootstraps a fresh Company OS skeleton on an empty bucket — one confirmation click, no questions asked — creating `os/`, `data/`, a root `AGENTS.md`, and `os/skills/init.md`. Either right after that or on any later visit once the structure already exists, `/init` shows the MCP server URL and OAuth instructions for connecting Claude or ChatGPT as a connector, plus a link to `/files` — connecting an assistant is the actual next step, since it's the assistant (reading `os/skills/init.md`) that interviews you and fills in the business's own details (`os/identity.md` and everything else), not this app. See [specs/014-os-init-page](specs/014-os-init-page/spec.md) for the full spec.

## Running with external storage (no local MinIO)

The repo-root `docker-compose.yml`/MinIO setup above is only for local development convenience — it is not a dependency of the app itself. `frontend/` runs against **any** S3-compatible bucket, so you can skip `docker compose` entirely and point it at storage you already have (AWS S3, or any other S3-compatible provider/self-hosted instance reachable from where the app runs).

**Locally, against external storage:**

1. `cp frontend/.env.example frontend/.env.local`
2. Fill in `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` for your external provider (set `S3_FORCE_PATH_STYLE=false` if it needs virtual-hosted-style addressing — most providers other than self-hosted MinIO do), and set `OAUTH_OWNER_USERNAME`/`OAUTH_OWNER_PASSWORD`.
3. Make sure the bucket already exists (it's never created automatically).
4. `cd frontend && npm install && npm run dev` — no `docker compose up` needed.

**Deployed serverless (e.g. Vercel):**

1. Import the repo and set the project's **Root Directory** to `frontend/` (see [specs/006-frontend-folder-structure](specs/006-frontend-folder-structure/spec.md)) — this repo has no root-level `package.json`, only `frontend/` is a deployable Next.js app.
2. In the platform's environment variables UI (not a `.env` file — those aren't deployed), set the same variables listed in [`frontend/.env.example`](frontend/.env.example): `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `OAUTH_OWNER_USERNAME`, `OAUTH_OWNER_PASSWORD`, and optionally `MCP_BOOTSTRAP_PATH`/`OS_NAME`.
3. Deploy. Because all app state (files, OAuth clients, personal access tokens) lives in the external bucket rather than on local disk, the deployment is stateless and safe to run as ephemeral serverless functions — no persistent volume or database needed.
4. Once live, `/mcp` and `/files` work exactly as in local dev, just at your deployment URL instead of `http://localhost:3000`.

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

### Dynamic tool descriptions from a bootstrap file

Optionally set `MCP_BOOTSTRAP_PATH` in `frontend/.env.local` (e.g. `MCP_BOOTSTRAP_PATH=assistant/AGENTS.md`) to a Markdown file already in storage. When set, every tool's description shown to a connecting client is prepended with guidance generated from that file's optional `<!-- mcp-context: ... -->` and `<!-- mcp-triggers: ... -->` HTML-comment markers — telling the client what the storage is for, when to use it, and to read the bootstrap file first. Edits to the file are picked up within about a minute, with no restart or redeploy. If the variable is unset, the file is missing, or neither marker is present, every tool simply falls back to its plain original description — see [specs/010-dynamic-tool-descriptions/quickstart.md](specs/010-dynamic-tool-descriptions/quickstart.md) for a runnable walkthrough.

### Connecting AI assistants (ChatGPT, Claude, etc.) via OAuth

The MCP server requires OAuth (spec 008-mcp-oauth) before any tool call is allowed — this is what lets you add it as a remote connector in hosted AI assistants. One-time setup, in addition to the storage setup above:

1. Set an owner sign-in credential in `frontend/.env.local` (separate from the S3/MinIO credentials above — this one gates who can approve AI assistants, not storage access):
   ```
   OAUTH_OWNER_USERNAME=owner
   OAUTH_OWNER_PASSWORD=<choose a password>
   ```
2. Start the server (`npm run dev`) — it logs a clear warning at startup if these are missing (same as the storage settings above), but still starts; sign-in simply fails until they're set.

To add the server as a connector: in ChatGPT or Claude's "add connector"/"add MCP server" flow, point it at `http://localhost:3000/mcp` (or your deployed URL). The assistant discovers the OAuth flow automatically; you'll be prompted to sign in with the credential from step 1 and approve the connection. See [specs/008-mcp-oauth/quickstart.md](specs/008-mcp-oauth/quickstart.md) for the full walkthrough, including reviewing and revoking connected assistants at `/settings/connected-apps`.

## Web File Explorer & Markdown Editor

A browser UI at `/files` (same app/dependencies as the MCP server above — `docker compose up -d` then `npm run dev` must both be running) lets you browse the `MCP_STORAGE_BUCKET` folder/file tree and edit *existing* files directly: `.md` files open in a split view (raw Markdown left, live-rendered preview right); everything else opens in a plain-text editor. Binary files are detected and shown with a clear "can't be edited here" message instead. Saves are explicit (no autosave) — unsaved changes are indicated, and you're warned before navigating away or closing the tab with changes pending. A file's path is part of the URL itself (e.g. `/files/notes/todo.md`), so any file can be opened directly via a bookmarked or shared link (spec [018-editor-file-deep-link](specs/018-editor-file-deep-link/)); the previous `/editor` URL still works and redirects here. See [specs/003-web-file-editor/contracts/api-routes.md](specs/003-web-file-editor/contracts/api-routes.md) for the underlying API and [specs/003-web-file-editor/quickstart.md](specs/003-web-file-editor/quickstart.md) for a full walkthrough.

`/files` requires signing in first, with the same owner credential used for the MCP connector flow above — a signed-out visit redirects to the sign-in screen, and a session started from either entry point covers both. See [specs/009-editor-login-gate/quickstart.md](specs/009-editor-login-gate/quickstart.md) for the full walkthrough.

Open it at: `http://localhost:3000/files`

## License

Licensed under the [PolyForm Internal Use License 1.0.0](LICENSE) — free to use, run, and modify for your own or your company's internal operations; distribution (including selling or offering a product/service based on it) requires a separate agreement with the copyright holder.
