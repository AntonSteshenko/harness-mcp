# Contract: `/init` page, submit route, and the global redirect middleware

## Middleware (every route, `frontend/middleware.ts`)

| Condition | Behavior |
|---|---|
| Path is `/init`, `/_next/*`, or `/favicon.ico` | Passed through untouched. |
| Any required `S3_*` env var is entirely unset | `307` redirect to `/init`, regardless of which route was requested (FR-017). Cheap presence check only — no network call (research.md §8). |
| All required `S3_*` env vars are set (even if wrong) | Passed through untouched — that narrower case is diagnosed only by `GET /init`'s own live check, below, not by the middleware. |

`frontend/instrumentation.ts`'s two startup checks (storage, owner credential) no longer exit the process on failure (FR-016) — they only log. This is what makes the middleware row above reachable at all: previously the process never finished starting when storage was unconfigured.

## `GET /init`

State resolution order (research.md §1-§3), evaluated fresh on every load:

| Storage connected? | Signed in? | `os/` / `data/` | Response |
|---|---|---|---|
| No (`StorageConfigError`) | *(not checked — research.md §1)* | *(not checked)* | `200`, renders `EnvSetupHelper` (FR-002, FR-014, FR-015) — a client-side form (storage connection + owner credential + optional system name) that generates one copyable config snippet plus plain-text Vercel instructions from visitor input. No setup form, no sign-in required, no server call made by the helper itself. |
| Yes | No | *(not checked until signed in)* | `302` redirect to `/oauth/login?continue=%2Finit`, mirroring `/editor` (spec 009). |
| Yes | Yes | both present | `200`, renders `McpConnectManual` (FR-003, FR-010) — MCP server URL, OAuth connection notes for Claude/ChatGPT, a link to `/settings/connected-apps`, and a link to `/editor`. No form, no write action anywhere on the page. |
| Yes | Yes | neither present | `200`, renders a single no-field confirmation action (FR-004) — no text inputs. |
| Yes | Yes | exactly one present | `200`, renders a distinct "unexpected state" message (FR-013). No form, no write action. |

An optional `?created=1` query param (set by the submit route's redirect, below) sets `McpConnectManual`'s `justCreated` prop, adding one confirmation sentence above otherwise-identical content (research.md §6) — it does not change which of the five rows above applies.

**`EnvSetupHelper` has no server contract of its own** — it makes no requests. Its behavior (nine input fields → one derived text snippet → clipboard copy, plus static Vercel instructions) is entirely described by research.md §7 and data-model.md's "Setup template (ephemeral)."

**`McpConnectManual` also has no server contract of its own** beyond the `justCreated` prop above — it's static content plus a URL derived from request headers, described in data-model.md's "MCP-connection guidance."

## `POST /init/submit`

| Aspect | Behavior |
|---|---|
| Auth | Requires an active owner session — `401` JSON error otherwise (mirrors `/settings/personal-access-tokens/create`, spec 013). Storage must also be connected for this route to do anything meaningful; if it's not, the underlying storage call fails and surfaces as an unhandled error (no dedicated handling — reaching this route at all already implies storage was connected when `GET /init` rendered the confirmation action). |
| Request body | None — no form fields (2026-07-25 revision, research.md §10). A plain `<button type="submit">` POST. |
| Already initialized / partial | If `os/`/`data/` already exist (either fully or partially) by the time the handler runs, no write occurs — responds the same way as a successful call (`303` to `/init?created=1`), since the resulting page correctly reflects reality either way (research.md §4). This is a no-op, not an error. |
| Success | Creates `os/`, `data/`, `AGENTS.md`, `os/skills/init.md` (FR-006, FR-008, FR-009 — no `os/identity.md`), then `303` redirects to `/init?created=1`. |

## Other routes

`/editor`, `/settings/*`, `/oauth/*`, `/.well-known/*`, `/mcp`, and every existing `/api/*` file-editor route are functionally unchanged by this feature — except that the middleware above now intercepts requests to all of them (as it does every route) and redirects to `/init` while storage is entirely unconfigured, instead of letting them reach their own first storage call and fail on their own.
