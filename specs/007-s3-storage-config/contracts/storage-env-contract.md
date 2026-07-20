# Contract: Storage Connection Environment Variables

**Input**: [spec.md](../spec.md), [research.md](../research.md), [data-model.md](../data-model.md)

This is the interface operators use to point the application at any S3-compatible storage backend. There is no traditional network API here — the "interface" is the set of environment variables the Next.js app (`frontend/`) reads once at startup, plus the documented startup failure behavior around them. This document fixes that contract; it does not define the S3 wire protocol itself, which is the standard S3 REST API already used by every S3-compatible provider.

## Environment variables (`frontend/.env.example`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `S3_ENDPOINT` | Yes | — | Full URL of the S3-compatible endpoint, including scheme (`http://` or `https://`). Determines TLS use (FR-011). |
| `S3_REGION` | No | `us-east-1` | Region name to send with signed requests. |
| `S3_ACCESS_KEY_ID` | Yes | — | Access key for the configured provider. Never logged (FR-008). |
| `S3_SECRET_ACCESS_KEY` | Yes | — | Secret key for the configured provider. Never logged (FR-008). |
| `S3_BUCKET` | Yes | — | Name of the bucket this app uses as its storage root. Must already exist (research.md §3). |
| `S3_FORCE_PATH_STYLE` | No | `true` | `"true"` for path-style addressing (e.g. required by most self-hosted MinIO setups), `"false"` for virtual-hosted-style (FR-012). |

These variables belong in `frontend/.env` (or `frontend/.env.local`), since Next.js only auto-loads env files from its own project root (research.md §1) — not the repo-root `.env.example`, which continues to configure only `docker-compose.yml`'s local MinIO container.

## Startup contract

| Condition | Behavior |
|---|---|
| All required variables present, endpoint reachable, credentials valid, bucket exists | Server starts normally; storage operations are available immediately. |
| One or more required variables missing | Server fails to start; error names every missing variable (FR-004). |
| Endpoint unreachable (network/DNS failure) | Server fails to start with a "storage endpoint unreachable" error (FR-005). |
| Credentials rejected by the provider | Server fails to start with a "credentials rejected" error (FR-005). |
| Configured bucket does not exist | Server fails to start with a "bucket not found" error — the bucket is never auto-created (research.md §3). |
| Any of the above | No secret value ever appears in the error message or logs — only variable names (FR-008). |

## Switching providers

Changing any of the above variables and restarting the server is the entire mechanism for pointing the app at a different S3-compatible provider (FR-002, FR-006). No code change, redeploy of application logic, or additional flags are required. The change has no effect until the process restarts — there is no live/hot reload (FR-010).

## Compatibility

Every existing MCP server tool (`specs/002-s3-mcp-server/contracts/mcp-tools.md`) and the web file explorer continue to behave identically regardless of which values are set here (FR-007) — this contract only changes where requests are sent, never their shape or meaning.
