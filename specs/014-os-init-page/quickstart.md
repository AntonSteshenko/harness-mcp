# Quickstart: Validate the Company OS Init Page

Manual validation guide (this project has no automated test suite — research.md §9). Run these scenarios against a running `next dev` instance after implementation.

## Prerequisites

- `frontend`: `npm install`.
- Owner credentials configured (`OAUTH_OWNER_USERNAME`/`OAUTH_OWNER_PASSWORD`, spec 008).
- Ability to point `frontend/.env.local`'s `S3_*` variables at a bucket you can freely empty/recreate, and to start/stop that storage backend (e.g. `docker compose stop`/`up -d` for local MinIO) to simulate "not connected."

## Scenario 0 — App starts and self-redirects with zero configuration (US2, FR-016, FR-017)

1. Remove or rename `frontend/.env.local` entirely (no `S3_*` or `OAUTH_OWNER_*` vars set at all).
2. Start `frontend` (`npm run dev`).
3. **Expect**: the server starts successfully (no fatal error, no exit) — it logs a warning about the missing storage/owner-credential config to the console, but keeps running.
4. Visit any route at all — `/`, `/editor`, `/settings/connected-apps`, etc.
5. **Expect**: every one of them redirects to `/init` (FR-017), landing on the setup helper (Scenario 1, below) without needing to know to go there manually.
6. Restore `frontend/.env.local` and restart, to continue with the scenarios below.

## Scenario 1 — Storage not connected: setup helper (US2, FR-002, FR-012, FR-014, FR-015)

1. Stop the storage backend (e.g. `docker compose stop` at the repo root) or point `S3_ENDPOINT` at an unreachable address (leaving the rest of `frontend/.env.local` in place — a narrower case than Scenario 0's "nothing set at all").
2. Start `frontend` (`npm run dev`) and visit `http://localhost:3000/init` directly **without** signing in.
3. **Expect**: the setup helper is shown, grouped into "Storage connection" (endpoint, region, access key ID, secret access key, bucket, path-style), "Owner sign-in" (username, password), and "System name" (optional) — no setup form, no error page, no redirect to sign-in.
4. Open the browser's network tab, then fill in every field.
5. **Expect**: a single text block updates live with one `NAME=value` line per field (omitting `OS_NAME` if left blank), with a working "copy" button, and plain-text instructions below it for applying the same snippet on Vercel; the network tab shows **zero** new requests as you type (FR-015, SC-006).
6. Copy the snippet, paste it into `frontend/.env.local`, restart the storage backend (`docker compose up -d`) and `next dev`.
7. Reload `/init`.
8. **Expect**: the page no longer shows the setup helper (moves on to Scenario 2 or 3 below, per current bucket contents).

## Scenario 2 — First-time setup on an empty bucket (US1, FR-004 through FR-010)

1. With storage connected and reachable, ensure the configured bucket has neither `os/` nor `data/` (a freshly created bucket, or after `./scripts/reset-storage.sh` + recreating the bucket).
2. Visit `/init`. If not signed in, sign in via the redirect to `/oauth/login`.
3. **Expect**: a form with two questions — "What is your business called?" and "What does your business do?".
4. Submit with both fields blank.
5. **Expect**: submission is rejected with a clear message; nothing is created (verify via `/editor` that the bucket is still empty).
6. Submit again with a business name and description filled in.
7. **Expect**: redirected back to `/init`, now showing a confirmation with a link to `/editor`.
8. Open `/editor` and verify: `os/identity.md` exists and contains the name/description entered; `data/` exists (empty); `AGENTS.md` exists at the bucket root and references `os/skills/init.md`; `os/skills/init.md` exists.

## Scenario 3 — Already initialized (US3, FR-003, FR-011, SC-002)

1. Using the bucket from Scenario 2 (already containing `os/` and `data/`), visit `/init` again.
2. **Expect**: the page states a Company OS already exists and shows a link to `/editor` — no setup form, no way to re-run initialization.
3. Attempt `POST /init/submit` directly (e.g. via `curl` with a valid owner session cookie) with different form values.
4. **Expect**: no change to `os/identity.md`'s existing content — the submission is a no-op (research.md §4).

## Scenario 4 — Partial/interrupted state (Edge Case, FR-013)

1. Against an otherwise-empty bucket, manually create just one of the two markers (e.g. via `/editor` or the MCP server, create a `data/` folder but not `os/`).
2. Visit `/init`.
3. **Expect**: neither the setup form nor the "already exists" confirmation — a distinct message indicating the storage is in an unexpected state, with no write action offered.

## Scenario 5 — Sign-in gate (FR-012)

1. With storage connected and either an empty or already-initialized bucket, visit `/init` in a browser with no active owner session.
2. **Expect**: redirected to `/oauth/login?continue=%2Finit`.
3. Sign in.
4. **Expect**: redirected back to `/init`, now showing the appropriate state (form or "already exists").
