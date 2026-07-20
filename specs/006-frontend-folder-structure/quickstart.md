# Quickstart: Validating the Dedicated Frontend Folder

Prerequisites: repo reorganized per `plan.md`/`tasks.md` (app source moved into `frontend/`, local-dev infra left at root).

## 1. Local dev still works end-to-end (SC-002, User Story 2)

```sh
# from repo root
docker compose up -d
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000/editor` — confirm the file tree, editor, create/delete/upload/download all work exactly as in specs 001-005. Confirm the MCP route still responds (per specs/002-s3-mcp-server/quickstart.md, adjusted to run from `frontend/`).

Stop it:

```sh
cd frontend && # Ctrl-C the dev server
cd .. && docker compose stop
```

## 2. `frontend/` is self-contained (SC-001, SC-003, SC-004, User Story 1)

```sh
# from repo root
rm -rf /tmp/frontend-isolated-check
cp -r frontend /tmp/frontend-isolated-check
cd /tmp/frontend-isolated-check
rm -rf node_modules .next
npm install
npm run build
```

Expected: the build succeeds with no error referencing a path outside `/tmp/frontend-isolated-check` — proving `frontend/` needs nothing from the rest of the repo, the way Vercel's isolated build (Root Directory = `frontend`) would run it.

## 3. Repo root contains only non-deployed files (SC-003)

```sh
ls /develop/harness-mcp
```

Expected top-level entries are limited to: `frontend/`, `docker-compose.yml`, `data/` (git-ignored, may not exist until MinIO first runs), `scripts/`, `.env.example`, `specs/`, `.specify/`, `CLAUDE.md`, `README.md`, `.gitignore`, `.git/`. No `app/`, `lib/`, `next.config.ts`, or `package.json` at the root.

## 4. Documentation names the app root (FR-007)

```sh
grep -n "frontend" README.md CLAUDE.md
```

Expected: at least one line in each stating `frontend/` is the Next.js app / the folder to point Vercel's Root Directory at.
