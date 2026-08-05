# Phase 0 Research: Root Dashboard Page

All items below were resolved by reading the existing codebase (`frontend/app/**`, `frontend/lib/i18n/**`, `frontend/middleware.ts`) — no external research was needed. The spec's Assumptions section already captured the product-level defaults; this document captures the technical decisions that implement them.

## 1. Where does `/` currently resolve, and why does it 404?

- **Decision**: Add `frontend/app/page.tsx`. No such file currently exists.
- **Rationale**: In Next.js App Router, a route segment renders only if a `page.tsx` exists at that path. `frontend/app/` has no `page.tsx`, only subdirectories (`tools/`, `settings/`, `files/`, `editor/`, `init/`, `oauth/`, `mcp/`, `api/`, `.well-known/`). `middleware.ts` only redirects `/` → `/init` when storage is *unconfigured*; once configured, requests to `/` fall through to Next.js's default 404.
- **Alternatives considered**: Redirecting `/` to an existing page (e.g., `/files`) instead of building a dashboard — rejected, it doesn't satisfy the explicit request for a links-to-everything landing page (FR-002).

## 2. What are the actual top-level, user-navigable pages?

- **Decision**: Files (`/files`), Tools (`/tools`), Settings › Connected Apps (`/settings/connected-apps`), Settings › Personal Access Tokens (`/settings/personal-access-tokens`).
- **Rationale**: Enumerated every `page.tsx` under `frontend/app/`. Excluded: `/init` (onboarding/recovery page reached only via the storage-unconfigured redirect, not a destination a configured user chooses — confirmed by `middleware.ts`); `/oauth/login`, `/oauth/authorize` (auth flow steps, not destinations); `/tools/[name]/confirm` (a confirmation step reached only from the Tools page, not a standalone destination); `/editor/[[...path]]` (confirmed by reading `app/editor/[[...path]]/page.tsx` — it is a redirect-only shim to `/files`, kept solely so old bookmarks from before spec 018 still work; it renders nothing of its own).
- **Alternatives considered**: Including `/editor` as a separate dashboard entry — rejected once its source confirmed it is not a distinct page; that would have shipped a dashboard with a dead-weight duplicate link to `/files`.

## 3. Should the dashboard page itself require an owner session?

- **Decision**: No. The dashboard renders unconditionally (once storage is configured) and simply lists links; each link's destination continues to run its own existing `hasActiveOwnerSession()` check and its own `redirect(...)` to `/oauth/login?continue=...` exactly as it does today when visited directly.
- **Rationale**: Every existing protected page already redirects unauthenticated visitors to login with the correct `continue` target. Gating the dashboard itself would duplicate that logic for no behavioral benefit, and would contradict the spec's explicit assumption ("The dashboard does not introduce any new authentication or authorization gate of its own").
- **Alternatives considered**: Requiring sign-in to view the dashboard — rejected as unnecessary duplication; a signed-out visitor still lands safely on login when they click any protected link.

## 4. How should the dashboard stay in sync with the actual page set (FR-007)?

- **Decision**: A single, small, centrally-maintained array of `{ href, labelKey }` entries defined directly in `frontend/app/page.tsx` (or a co-located `frontend/app/dashboardLinks.ts` if the list grows). No automatic route-scanning.
- **Rationale**: Next.js App Router has no runtime API to enumerate registered page routes (unlike the old Pages Router's file-system-based routing manifest, which also wasn't introspectable at runtime either). Every other cross-page reference in this codebase (e.g., login `continue` targets, the `/tools/[name]/confirm` back-link) is likewise a hand-written literal path, not derived. A single, obviously-named array in one file is the smallest unit a future page-adding change would need to touch — consistent with how spec 018 already required updating the editor→files redirect by hand when routes changed.
- **Alternatives considered**: A build-time script that scans `app/**/page.tsx` and generates the list — rejected as disproportionate tooling for four links, and it would still need a hand-maintained allowlist/denylist to exclude flow-only routes (confirm, oauth, init), which is the same manual-maintenance burden without the simplicity.

## 5. Text and styling conventions to follow

- **Decision**: Reuse the pattern from `app/tools/page.tsx` and `app/settings/*/page.tsx`: a Server Component, inline `CSSProperties` objects (no CSS framework in this repo), text sourced via `getDictionary(await resolveLanguage())`, a `<main>` wrapper with `maxWidth`/`margin`/`fontFamily` matching existing pages.
- **Rationale**: Keeps the new page visually and structurally consistent with the rest of the product (spec's Assumptions: "no new visual design system"). Every reviewed existing page follows this exact shape.
- **Alternatives considered**: A new shared `<Nav>`/layout component reused across all pages — out of scope; no existing page currently shares such a component, and retrofitting one is a larger refactor than this feature calls for.
