# Quickstart: Validate Multilingual Company OS Setup

Manual validation guide (this project has no automated test suite — research.md §9). Run these scenarios against a running `next dev` instance after implementation, on top of an already-working storage connection (spec 007) and owner credentials (spec 008).

## Prerequisites

- `frontend`: `npm install`, `frontend/.env.local` with working `S3_*` and `OAUTH_OWNER_*` values.
- A way to empty/recreate the configured bucket between scenarios (e.g. `docker compose` MinIO + a reset script), consistent with spec 014's quickstart.
- A way to change your browser's preferred language per scenario (browser language settings, or setting the `Accept-Language` request header via `curl -H "Accept-Language: it-IT"` for a quick check without changing browser settings).

## Scenario 1 — Confirming each of the six languages on a fresh bucket (US1, FR-001 through FR-006, FR-009, FR-010)

For each of the six codes (`en`, `it`, `ru`, `fr`, `de`, `es`):

1. Empty the configured bucket (no `os/`, no `data/`).
2. Set your browser's (or `curl`'s `Accept-Language` header) preferred language to that code.
3. Visit `/init`, sign in if prompted.
4. **Expect**: the page shows that language pre-selected among all six (native names), plus the same explanation as before, with no OS content created yet.
5. Confirm without changing the selection.
6. **Expect**: `os/`, `data/`, `AGENTS.md`, `os/skills/init.md`, and `os/language` (containing exactly that code) all exist; `AGENTS.md`/`os/skills/init.md` content reads in that language.

## Scenario 2 — Overriding the detected suggestion (US1, FR-004)

1. Empty the bucket. Set the browser/header language to Italian.
2. Visit `/init`; **expect** Italian pre-selected.
3. Change the selection to Spanish before submitting.
4. **Expect**: `os/language` contains `es`, and `AGENTS.md`/`os/skills/init.md` are the Spanish variants — not Italian.

## Scenario 3 — Unsupported browser language falls back to English, not blocked (SC-005, edge case)

1. Empty the bucket. Set the browser/header language to something outside the six (e.g. `pt-BR` or `ja`).
2. Visit `/init`.
3. **Expect**: English is pre-selected, and all six remain pickable — setup is not blocked.

## Scenario 4 — The whole app follows the confirmed language, regardless of the visitor's own browser (US2, FR-008, SC-003)

1. Using a bucket confirmed as, say, French in Scenario 1.
2. Set your browser/header language to German (different from the confirmed French).
3. Visit `/editor`, `/settings/connected-apps`, `/settings/personal-access-tokens`, and (signed out, in a private window) `/oauth/login`.
4. **Expect**: every one of these pages renders in French — the Company OS's confirmed language — not German.

## Scenario 5 — Pages before any Company OS exists use live browser detection, not persisted (US1/US2 boundary, FR-014)

1. Point the app at a bucket with no `S3_*` reachable (storage-not-connected state) or an empty bucket not yet confirmed.
2. Visit `/init` with the browser/header set to Russian; **expect** the "storage not connected" helper (or the not-yet-confirmed empty-bucket page) in Russian.
3. Reload with the browser/header set to Spanish (same unconnected/unconfirmed state).
4. **Expect**: the same page now renders in Spanish — proving this is live per-request detection, not something already persisted (nothing has been confirmed yet).

## Scenario 6 — Folder/file names are identical across languages, only content differs (US3, FR-011, SC-004)

1. Initialize two separate buckets: one confirming English, one confirming any other of the six (e.g. Italian).
2. Compare the two `os/skills/init.md` files' prescribed structure (the Fase 2 table and Fase 3 write plan) side by side.
3. Connect an AI assistant to each and run the same setup interview (same answers) against both.
4. **Expect**: the two resulting `data/`/`os/` trees have byte-identical directory and file *names* (e.g. both have `data/clients/`, `os/skills/daily-plan.md`, `os/policies/communication.md` — never `os/skills/giornata.md`), while the *content* of each file differs only in language.

## Scenario 7 — Legacy Company OS (created before this feature) falls back to English, untouched (US2, FR-012, FR-013)

1. Using a bucket that already has `os/`+`data/` but no `os/language` file (simulate by deleting `os/language` from a bucket created in Scenario 1, or using a bucket from before this feature shipped).
2. Visit `/init`, `/editor`, `/settings/connected-apps` with the browser/header set to any non-English language.
3. **Expect**: every page renders in English (the fixed fallback) — no language prompt appears anywhere, and no new file is created or altered as a side effect of visiting.

## Scenario 8 — No language switcher exists (FR-007)

1. Using any already-confirmed bucket (e.g. from Scenario 1).
2. Look through `/settings/*` and `/init` for any control to change the Company OS's language.
3. **Expect**: none exists — the only way to get a different language is to set up a new Company OS from an empty bucket.
