# Phase 0 Research: Dedicated Frontend Folder for Vercel Readiness

## 1. What exactly counts as "the app" that moves

**Decision**: Everything that Next.js itself needs to build and run moves together, as one unit, into `frontend/`: `app/`, `lib/`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `node_modules/`. This includes the embedded MCP server route (`app/mcp/route.ts`) and every existing API route — none of it is split out.

**Rationale**: Confirmed by reading `lib/mcp-tools/index.ts` and `app/mcp/route.ts` (via `mcp-handler`) that the MCP server is not a separate process — it's a Route Handler inside the same Next.js app, built and deployed by the same `next build`/Vercel pipeline as the editor UI. There is no existing seam between "frontend" and "backend" to split along; the only real seam in the repo is between *this Next.js app* and *local-only infra* (MinIO/docker-compose) that Vercel never touches. Splitting the MCP server into an independently deployed service would be a materially larger change than what was asked and is out of scope (recorded in spec.md Assumptions).

**Alternatives considered**: Splitting into `frontend/` (UI + API routes) and a separate `mcp-server/` package — rejected because it would require standing up a second runtime/deployment target and reworking how the UI talks to storage, which is not implied by "put the frontend in a dedicated folder" and would need its own spec.

## 2. Folder name and monorepo tooling

**Decision**: Name the folder `frontend/`. Do not introduce npm workspaces, Turborepo, or Nx — this repo has exactly one buildable package before and after the move, so workspace tooling would add configuration surface with no present benefit.

**Rationale**: `frontend/` matches the exact term the user used and requires no new tooling decisions. Vercel's "Root Directory" project setting works against a plain subfolder without any workspace manifest; workspace tooling is a solution to a multi-package problem this repo doesn't have.

**Alternatives considered**: `web/` or `apps/web/` (the latter implying a monorepo convention) — rejected in favor of the simplest name matching the request; can be revisited if a second deployable package is ever added.

## 3. Local-dev infra placement (`docker-compose.yml`, `data/`, `scripts/`)

**Decision**: `docker-compose.yml`, `data/` (MinIO bind mount), and `scripts/reset-storage.sh` all stay at the repository root, untouched.

**Rationale**: None of these are built or served by Next.js/Vercel — `docker-compose.yml` only starts the local MinIO container, and `scripts/reset-storage.sh` only operates on `./data/minio`. Moving them would serve no Vercel-readiness purpose and would break the exact commands documented in `README.md` (`docker compose up -d`, `./scripts/reset-storage.sh`) for no benefit.

**Alternatives considered**: Moving infra into `frontend/` alongside the app — rejected; it would conflate "things Vercel needs" with "things only a local machine needs," the opposite of this feature's goal.

## 4. Environment variable configuration across the move

**Decision**: `.env.example` (and any real `.env`/`.env.local` a developer creates) stays at the repository root, documenting the values shared by `docker-compose.yml` and the app. No `.env` file is introduced by this feature.

**Rationale**: Checked `lib/storage/client.ts` — every env var it reads (`MINIO_API_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MCP_STORAGE_BUCKET`) has a hard-coded fallback that already matches `docker-compose.yml`'s hard-coded defaults (`minioadmin`/`minioadmin`, bucket `mcp-storage`). This means the documented quickstart workflow works today with **zero** `.env` file present, and will keep working identically after the move — satisfying FR-005 without any env-loading change.

**Known limitation (documented, not fixed by this feature)**: Next.js only auto-loads `.env*` files from its own project root. If a developer later creates a root-level `.env.local` to override e.g. `MINIO_API_PORT` for `docker compose`, the Next.js app in `frontend/` will *not* automatically see that same override once it's nested (it isn't Next's project root). This is called out as a documentation note (FR-007) rather than solved with new tooling, since introducing cross-directory env loading is out of scope for a pure structural move (FR-006).

**Alternatives considered**: Duplicating `.env.example` inside `frontend/` — rejected; two files documenting the same shared values would drift out of sync, which is worse than one documented caveat.

## 5. Preserving git history through the move

**Decision**: Use `git mv` for every relocated path (not delete+recreate), so `git log --follow` continues to work on moved files.

**Rationale**: Standard practice for pure structural moves; costs nothing and keeps `git blame`/history usable for all the app code carried over from specs 001-005.

**Alternatives considered**: None — this is a strict improvement with no tradeoff.

## 6. Validating the "Vercel-style isolated build" success criterion (SC-004)

**Decision**: Validate by copying only `frontend/`'s contents to a throwaway directory outside the repo and running `npm install && npm run build` there — if it succeeds with zero references to anything under the original repo root, the folder is genuinely self-contained.

**Rationale**: This mirrors what Vercel actually does when Root Directory is set to a subfolder (it uploads only that subtree). Cheaper and more direct than actually creating a Vercel project for validation, and doesn't require external account setup.

**Alternatives considered**: Creating a real Vercel project/deployment for validation — unnecessary for verifying repo layout correctness and out of scope for this feature (per spec.md Assumptions, actually deploying to Vercel is a future feature).
