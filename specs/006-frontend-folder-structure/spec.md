# Feature Specification: Dedicated Frontend Folder for Vercel Readiness

**Feature Branch**: `006-frontend-folder-structure`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "in futuro la parte frontend nextjs sarà caricata su vercel, sarebbe giusto di mettere frontend in una cartella dedicata?" (In the future the Next.js frontend part will be deployed on Vercel — would it be right to put the frontend in a dedicated folder?)

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
-->

### User Story 1 - Deploy the Next.js app to Vercel from a subfolder (Priority: P1)

As the project maintainer, I want the entire Next.js application (pages, API routes, and the embedded MCP server route) to live inside one dedicated folder in the repository, so that when I connect the repo to Vercel I can point its "Root Directory" setting at that folder and deploy only the app, without Vercel trying to build or interpret repo-root files (spec-kit artifacts, docker-compose config, local storage data) that have nothing to do with the deployed site.

**Why this priority**: This is the entire motivation for the change — without it, there is no Vercel-deployable unit isolated from local-only infrastructure.

**Independent Test**: Can be fully tested by moving the app source into the dedicated folder, confirming `npm run dev`/`npm run build` succeed when run with that folder as the working directory, and confirming a Vercel project configured with that folder as its Root Directory builds successfully.

**Acceptance Scenarios**:

1. **Given** the repository after the reorganization, **When** the maintainer inspects the repo root, **Then** all Next.js application source (`app/`, `lib/`, `next.config.ts`, `package.json`, etc.) is contained within a single dedicated subfolder rather than scattered at the repo root.
2. **Given** the dedicated folder as the configured project root, **When** a build is run against it in isolation (as Vercel would), **Then** the build succeeds without requiring any file located outside that folder.

---

### User Story 2 - Keep local development workflow working after the move (Priority: P2)

As a developer working on this project day-to-day, I want to still be able to start the app and its local S3-compatible storage (MinIO via `docker compose`) with the same familiar commands after the reorganization, so that the restructuring for Vercel doesn't break or complicate my local dev loop.

**Why this priority**: The reorganization must not regress the existing local development experience described in prior feature plans (specs 001-005); breaking it would block ongoing feature work.

**Independent Test**: Can be fully tested by running the documented local dev startup sequence (`docker compose up` for MinIO, then the app's dev command) after the move and confirming the editor UI at `/editor` and the MCP route still work exactly as before.

**Acceptance Scenarios**:

1. **Given** the reorganized repository, **When** the developer runs `docker compose up` from the repo root, **Then** MinIO starts and is reachable exactly as it was before the move.
2. **Given** the reorganized repository, **When** the developer starts the Next.js dev server using the documented command, **Then** the app serves the file editor UI and MCP endpoint exactly as before, reading/writing to the same local storage.

---

### User Story 3 - Understand where new code belongs (Priority: P3)

As a contributor picking up a future feature (per this project's spec-driven workflow), I want the repo layout to make it obvious which files are "the deployable Next.js app" versus "local-only infrastructure and project process files" (specs, constitution, docker-compose, storage data), so future plans reference correct paths without ambiguity.

**Why this priority**: Nice-to-have clarity that reduces friction in future spec/plan authoring, but the project remains functional even if this understanding takes a moment to absorb.

**Independent Test**: Can be tested by writing a trivial follow-up change and confirming a contributor (or the spec-planning process itself) can state, without guessing, whether a given file belongs inside or outside the dedicated app folder.

**Acceptance Scenarios**:

1. **Given** the new layout, **When** a contributor is asked "does this file ship to Vercel?", **Then** the answer is determinable purely from whether the file sits inside the dedicated app folder.

### Edge Cases

- What happens to repository-root files that are neither app source nor local-dev infra (e.g. `specs/`, `.specify/`, `CLAUDE.md`, `README.md`)? They are project-process/documentation files, not deployable app code, and remain at the repo root.
- What happens to `docker-compose.yml` and the `data/minio` bind mount, which back local development storage but are irrelevant to a Vercel deployment? They stay outside the dedicated app folder since Vercel never runs them.
- What happens to `scripts/reset-storage.sh`, which operates on the local storage bind mount? It stays alongside the other local-dev infra outside the dedicated app folder, since it targets `data/minio`, not app source.
- How does the app locate its storage configuration (S3 endpoint/bucket) once nested in a subfolder? Existing environment-variable-based configuration continues to work unchanged; only the filesystem location of the source moves, not how configuration is supplied.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST place all Next.js application source currently at the repo root (`app/`, `lib/`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `node_modules`) inside one dedicated subfolder.
- **FR-002**: The dedicated subfolder MUST be independently buildable and runnable using only its own contents plus standard Node.js tooling (`npm install`, `npm run build`, `npm run dev`) — it MUST NOT require any file from outside the subfolder to build or run.
- **FR-003**: Local-development-only infrastructure that is not deployed to Vercel (`docker-compose.yml`, `data/` storage bind mount, `scripts/reset-storage.sh`) MUST remain at the repository root, outside the dedicated app folder.
- **FR-004**: Project process and documentation files (`specs/`, `.specify/`, `CLAUDE.md`, `README.md`) MUST remain at the repository root, outside the dedicated app folder.
- **FR-005**: After the move, the documented local development workflow (starting MinIO via `docker compose`, then starting the Next.js dev server) MUST continue to work end-to-end with no functional regression to the file editor UI or the MCP server route.
- **FR-006**: The reorganization MUST be a pure file/folder move (and the minimal path/config updates it requires, e.g. `docker-compose.yml` bind-mount paths if applicable) — it MUST NOT change any application behavior, UI, or API contract established by specs 001-005.
- **FR-007**: The repository MUST document (e.g. in the top-level `README.md` or `CLAUDE.md`) which folder is the Vercel-deployable app root, so that configuring a Vercel project's Root Directory setting is unambiguous.

### Key Entities

- **App folder**: The single dedicated directory containing the entire Next.js application (UI, API routes, embedded MCP server route, and its own `package.json`/lockfile) — the unit that will eventually be pointed to by Vercel's Root Directory setting.
- **Local-dev infrastructure**: Repo-root files/directories (`docker-compose.yml`, `data/`, `scripts/`) that support running the app's storage backend locally but are never deployed to Vercel.
- **Project-process files**: Repo-root files/directories (`specs/`, `.specify/`, `CLAUDE.md`, `README.md`) that document and drive the spec-kit workflow itself, unrelated to the deployable app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Vercel project can be configured to build and deploy the app by setting its Root Directory to a single folder, with zero additional per-file configuration.
- **SC-002**: Running the existing local dev workflow (MinIO via `docker compose`, then the app dev command) after the move produces an editor UI and MCP endpoint that behave identically to before the move, with zero regressions.
- **SC-003**: 100% of the Next.js application's own source files are located inside the dedicated folder; 0% of local-dev-infra or project-process files are located inside it.
- **SC-004**: A build run using only the dedicated folder's contents (simulating Vercel's isolated build) succeeds without referencing any path outside that folder.

## Assumptions

- "Frontend" in the request refers to the entire existing Next.js application as it stands today — including its UI (`app/editor`), its Route Handlers (`app/api/*`), and its embedded MCP server route (`app/mcp/route.ts`) — since today these all ship as one inseparable Next.js build artifact; there is no existing separate non-Next.js backend to leave behind.
- The dedicated folder is named `frontend/` at the repository root, matching the exact term used in the request; this is a plain rename/move and not a switch to a managed monorepo tool (no Turborepo/Nx workspace config is introduced) unless a future feature calls for one.
- `docker-compose.yml`'s MinIO service and the `data/minio` bind mount remain at the repository root and continue to be reachable via the same host ports; only application source moves, not the local storage backend or its data.
- No change to hosting of the local MinIO storage backend is in scope — this feature only prepares the repository layout for a future Vercel deployment of the Next.js app; actually creating a Vercel project, wiring production storage credentials, or replacing local MinIO with a hosted S3-compatible service for production is out of scope and left to a future feature.
- Existing import paths inside the app (e.g. `lib/storage/*`, `lib/mcp-tools/*` imports from `app/*`) are updated only insofar as their relative structure requires (i.e., they keep working unchanged since the whole tree moves together); no internal refactor of the app's module structure is performed as part of this move.
