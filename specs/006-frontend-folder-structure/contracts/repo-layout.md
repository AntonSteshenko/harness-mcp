# Contract: Repository Layout Boundary

This is not an API contract — it's the structural contract this feature establishes between "the Vercel-deployable app" and "everything else," which future specs/plans and Vercel project configuration both rely on.

## Contract

- **`frontend/`** is the single Vercel Root Directory candidate. Anything a `next build` run from inside `frontend/` needs MUST live inside `frontend/`. Nothing outside `frontend/` may be referenced by app source (no `../` imports reaching outside it, no config pointing at repo-root paths).
- **Repository root** holds only:
  - Local-dev infrastructure that never ships to Vercel: `docker-compose.yml`, `data/`, `scripts/`, `.env.example`.
  - Project-process files: `specs/`, `.specify/`, `CLAUDE.md`, `README.md`, `.gitignore`, `.git/`.
- A future Vercel project for this repo sets **Root Directory = `frontend`** and nothing else changes in Vercel's default Next.js build/output settings.

## Consumers of this contract

- **Vercel project configuration** (future feature, out of scope here): reads this layout to know what Root Directory to set.
- **`README.md` / `CLAUDE.md`** (updated by this feature, FR-007): must state that `frontend/` is the app root so a maintainer configuring Vercel doesn't have to reverse-engineer it.
- **Future spec plans**: should reference app source as `frontend/app/...`, `frontend/lib/...` from this point forward, per the mapping in `data-model.md`.

## Verification

Satisfied when (mirrors quickstart.md):

1. `frontend/` builds and runs standalone (copied out of the repo, per research.md §6) — proves no hidden dependency on repo-root files.
2. `docker compose up -d` from the repo root still works untouched — proves local-dev infra didn't move.
3. `README.md`/`CLAUDE.md` name `frontend/` explicitly as the app root.
