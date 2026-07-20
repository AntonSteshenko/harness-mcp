# Data Model: Dedicated Frontend Folder for Vercel Readiness

This feature moves files rather than modeling data. The "entities" from spec.md map to this concrete before/after path table.

## Path mapping

| Repo-root path today | New location | Entity (spec.md) |
|---|---|---|
| `app/` | `frontend/app/` | App folder |
| `lib/` | `frontend/lib/` | App folder |
| `next.config.ts` | `frontend/next.config.ts` | App folder |
| `next-env.d.ts` | `frontend/next-env.d.ts` | App folder |
| `tsconfig.json` | `frontend/tsconfig.json` | App folder |
| `tsconfig.tsbuildinfo` | `frontend/tsconfig.tsbuildinfo` | App folder (build artifact; already git-ignored) |
| `package.json` | `frontend/package.json` | App folder |
| `package-lock.json` | `frontend/package-lock.json` | App folder |
| `node_modules/` | `frontend/node_modules/` | App folder (git-ignored; reinstalled via `npm install`, not moved by hand) |
| `docker-compose.yml` | *(unchanged)* `docker-compose.yml` | Local-dev infrastructure |
| `data/` (MinIO bind mount) | *(unchanged)* `data/` | Local-dev infrastructure |
| `scripts/reset-storage.sh` | *(unchanged)* `scripts/reset-storage.sh` | Local-dev infrastructure |
| `.env.example` | *(unchanged)* `.env.example` | Local-dev infrastructure (shared config, research.md §4) |
| `specs/` | *(unchanged)* `specs/` | Project-process files |
| `.specify/` | *(unchanged)* `.specify/` | Project-process files |
| `CLAUDE.md` | *(unchanged)* `CLAUDE.md` | Project-process files |
| `README.md` | *(unchanged)* `README.md` | Project-process files |
| `.gitignore` | *(unchanged)* `.gitignore` (rules for `frontend/node_modules` etc. still match via directory-agnostic patterns already in place, e.g. `node_modules/`, `.next/`) | Project-process files |

## Invariants

- No path outside `frontend/` is required to run `npm install`, `npm run build`, `npm run dev`, or `npm run lint` inside `frontend/` (FR-002).
- No path inside `frontend/` is required by `docker compose up`, `docker compose stop`, or `scripts/reset-storage.sh` run from the repo root (FR-003, unchanged behavior).
- Every file's relative position *within* the app is unchanged — only the whole subtree's parent changes (repo root → `frontend/`) — so no import path inside the app needs editing (research.md §1).
