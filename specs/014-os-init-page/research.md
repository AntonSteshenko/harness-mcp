# Research: Company OS Init Page

**Input**: [spec.md](spec.md), existing `frontend/lib/storage/*` and `frontend/lib/oauth/*` modules (specs 001, 002, 007, 008, 009).

## §1. Owner-session gate vs. the "storage not connected" state (spec correction)

**Decision**: The owner sign-in gate (spec 009) applies only once storage is connected. When storage is not connected, `/init` shows the connection instructions to anyone, without requiring sign-in first. This is now reflected in spec.md FR-012.

**Rationale**: `hasActiveOwnerSession()` (`lib/oauth/session.ts`) looks up the session record via `getRecord()` (`lib/oauth/store.ts`), which issues an S3 `GetObject` call — it depends on a reachable storage backend. `createOwnerSession()` (used by `/oauth/login/submit`) likewise depends on storage (`putRecord()` → `PutObject`). If storage is down, both checking *and establishing* an owner session are impossible — gating the connection-instructions state behind sign-in would strand a first-time owner who cannot sign in until storage works, but cannot see how to connect storage until they sign in. There is also nothing sensitive to protect in this state: no bucket is reachable, so no data exists to leak.

**Alternatives considered**:
- Require sign-in unconditionally, and let the storage-dependent session check surface as an unhandled error when storage is down → rejected: produces exactly the confusing broken-page experience US2 exists to avoid (spec.md SC-003).
- Add a storage-independent "bootstrap password" just for this one page → rejected: introduces a second credential mechanism for a single edge case; out of proportion, and not something the user asked for.

## §2. Detecting "storage not connected"

**Decision**: Reuse `verifyStorageConnection()` (`lib/storage/client.ts`) exactly as spec 007's startup check does, called at the top of `/init`'s page component (and again defensively in the submit route). It already performs the full check this feature needs — config completeness, endpoint reachability, credential validity, bucket existence — and already throws the typed `StorageConfigError` (`missing_config` | `invalid_config` | `endpoint_unreachable` | `credentials_rejected` | `bucket_not_found`) the page needs to distinguish "not connected" from any other, unexpected error.

**Rationale**: This is the exact validation spec.md's Assumptions already commit to reusing ("same validation the app already performs at startup elsewhere, spec 007"). No new connectivity-check logic is needed. Catching `StorageConfigError` specifically (vs. letting other exceptions propagate to Next.js's default error boundary) keeps the distinction between "expected, show instructions" and "genuinely unexpected, let it fail loudly" that spec 007 already established.

**Alternatives considered**: A lighter-weight, page-specific check (e.g. just `HeadBucketCommand`) → rejected: would duplicate `verifyStorageConnection()`'s error-classification logic (connectivity vs. credentials vs. missing bucket) for no benefit.

## §3. Detecting "already initialized" / "empty" / "partial"

**Decision**: Once storage is confirmed connected, call `hasAnyObjectWithPrefix("os/")` and `hasAnyObjectWithPrefix("data/")` (`lib/storage/paths.ts`, already used by every existing directory-existence check in this codebase) and branch on the pair of booleans:

| `os/` exists | `data/` exists | State |
|---|---|---|
| no | no | empty → show setup form |
| yes | yes | already initialized → show link to `/editor` |
| yes | no / no / yes | partial → show the distinct "unexpected state" message (FR-013) |

**Rationale**: This is the same primitive `lib/storage/directories.ts`'s own `createDirectory()` uses to check for existing content, and the same one `statPath()` composes from — no new storage primitive, per spec.md's Assumptions ("folder" = key-prefix convention, spec 001/002).

## §4. Creating the structure without corrupting an existing system (FR-011, SC-004, concurrent-submission edge case)

**Decision**: `initializeCompanyOs()` (new, `lib/os/init.ts`) re-runs the §3 existence check as its first step and returns an "already initialized, nothing done" result instead of writing anything if either `os/` or `data/` already exists by the time it runs — not just relying on the page's own pre-render check. Then it creates, in order: `os/` (`createDirectory`), `data/` (`createDirectory`), `AGENTS.md` (`createFile`), `os/skills/init.md` (`createFile`). **Revised 2026-07-25**: no longer takes any arguments or creates `os/identity.md` — the confirmation action has no form fields to pass in (spec.md FR-004/FR-007, US1).

**Rationale**: The page's state check (§3) and the confirmation action are two separate requests, so a double-submit or two near-simultaneous first-time visits create a race between "check" and "act." Re-checking inside `initializeCompanyOs()` narrows that window to the check-then-write sequence itself rather than the much larger check-then-user-clicks-confirm window, and guarantees a second concurrent call is a no-op rather than a silent overwrite — meeting SC-004 ("0% of confirmations against an already-initialized... bucket result in existing content being overwritten") for the realistic single-owner traffic this app serves. A distributed lock is not warranted at this app's scale (spec.md Assumptions/Scale).

**Alternatives considered**: Optimistic-locking via S3 conditional writes (`If-None-Match`) → rejected: not supported by MinIO/most S3-compatible backends this app targets (spec 007's whole premise is broad S3-compatible support, not just AWS S3); unnecessary complexity for a single-owner, one-time action.

## §5. Where the fixed template content lives

**Decision**: The `AGENTS.md` and `os/skills/init.md` template text live as plain Markdown files, `frontend/lib/os/templates/AGENTS.md` and `frontend/lib/os/templates/init.md`, read once at module load via `fs.readFileSync(path.join(process.cwd(), "lib/os/templates/<name>"), "utf-8")` and exported as the same `AGENTS_MD_TEMPLATE`/`INIT_SKILL_MD_TEMPLATE` constants `lib/os/init.ts` already exposed. No substitution ever happens — both are written verbatim (2026-07-25: this app no longer writes `os/identity.md` or any other business-specific file at all; that's entirely the connected AI assistant's job, driven by `init.md`'s own interview).

**Revised 2026-07-25** (user request): originally these were inline template-literal string constants directly in `lib/os/init.ts`. Moved to standalone `.md` files in the same folder so they can be edited as plain Markdown (with editor syntax highlighting/preview) instead of escaped strings inside TypeScript. `process.cwd()` is reliably the Next.js project root (`frontend/`) in both `next dev` and a deployed Vercel serverless function, and a literal, statically-analyzable `fs.readFileSync(path.join(process.cwd(), "literal/path"), ...)` call is exactly the pattern Next.js's/Vercel's build-time file tracing (`@vercel/nft`) is designed to pick up and bundle — no extra Next.js config needed.

**Rationale**: Both files are explicitly "fixed, product-provided" per spec.md (FR-008, FR-009, Assumptions) — no per-business customization, no reason to read them from S3 or a database. Keeping them as files that ship with the app source (rather than TS string literals) makes them easy to review/edit as Markdown while still being bundled with the deployment like any other source file — no extra moving part, no new runtime dependency on storage.

**Alternatives considered**: Read them from S3 (e.g. a reserved prefix analogous to `.oauth/`) → rejected: these are product templates, not user data — they shouldn't require storage to already be reachable (bootstrapping problem) or be editable/deletable by the same tools that manage business content.

## §6. Reusing the post-confirmation view as the "already exists"/MCP-connection view

**Decision**: On successful confirmation, `/init/submit`'s `POST` handler redirects (`303`) back to `/init` rather than rendering a bespoke confirmation page. Immediately after redirect, `/init`'s own state check (§3) now finds both `os/` and `data/` present and renders the same `McpConnectManual` view FR-003/US3 already defines — which already satisfies FR-010's "same MCP-connection guidance."

**Rationale**: Avoids a fourth, one-off page state that would duplicate almost all of the "already exists" view's content. This is even truer since the 2026-07-25 revision (spec.md Clarifications) than it was originally: both states now show the *exact same* MCP-connection instructions — the only difference is a `justCreated` flag on `McpConnectManual` (`?created=1`) that adds one confirmation sentence ("the starting structure has been created") above otherwise-identical content, rather than two different messages as in the original design.

**Alternatives considered**: A dedicated success page/banner distinct from the "already exists" view → rejected as unnecessary duplication; the `?created=1` query param (unchanged mechanism from the original design) is enough to distinguish the two without a new state or route.

## §7. Setup helper: client-side-only template generation, all required env vars, one snippet

**Decision**: `EnvSetupHelper.tsx` (new `"use client"` component, renamed from an earlier `ConnectionHelper.tsx` — see "Revised 2026-07-25" below for why the scope grew) holds every field the app needs in local component state — the six S3 connection fields (endpoint, region, access key ID, secret access key, bucket, path-style flag), the owner sign-in credential (username, password), and an optional system name — and derives **one** output snippet (`NAME=value` lines, matching `frontend/.env.example`'s exact variable names) with plain string templating on every keystroke (a `useMemo` over the field state). One "copy" button using the browser's Clipboard API (`navigator.clipboard.writeText`), plus plain-text instructions for applying that same snippet on a hosting provider. No `fetch`/`XMLHttpRequest` call is made anywhere in this component, and no value it holds is ever passed to a Server Action, Route Handler, or `console.log`.

**Rationale**: This is explicitly required by FR-015 — the whole point of the helper is that the app never touches the visitor's credentials server-side. Keeping it a pure, self-contained client component (no server round-trip at all) is both the simplest implementation and the only way to make FR-015's "never transmitted" guarantee structurally true rather than a policy the server-side code has to remember to honor.

**Revised 2026-07-25** (user feedback after trying the first version): the original design generated *two* snippets — one `.env.local`-formatted, one for a hosting provider's UI — but both used the exact same `NAME=value` format, so the second block was pure duplication with no actual formatting difference. Collapsed to one generated snippet plus prose instructions for where to paste it (locally vs. on a host). Scope was also widened from S3-only to every required var (adding the owner credential and optional system name, FR-014) — the original narrower version only solved half the "fresh install, nothing configured" problem: after fixing storage alone, the owner would immediately hit the separate, still-unset `OAUTH_OWNER_*` requirement and be stuck again with no guidance. Bundling both in the same pass avoids that second dead end.

**Field-name mapping** (client-side constant, mirrors `frontend/.env.example` verbatim): `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `OAUTH_OWNER_USERNAME`, `OAUTH_OWNER_PASSWORD`, `OS_NAME` (omitted from the snippet if left blank, since it's optional and the app already defaults it). `MCP_BOOTSTRAP_PATH` (spec 010) is deliberately excluded — advanced/optional, and it names a file that doesn't exist until after setup.

**Alternatives considered**:
- Generate the snippet server-side (a Route Handler the client posts field values to, returning formatted text) → rejected outright: this is exactly the network transmission FR-015 forbids, for zero benefit — string templating needs no server.
- Also let the helper write directly to `frontend/.env.local` on the machine running `next dev` (detecting "local" vs. "hosted" somehow) → rejected per the earlier feasibility discussion: even in the best case (local dev) this requires a server round-trip (violates FR-015) and a process restart to take effect, which the copy-paste flow already requires anyway from the visitor — no net benefit for the added risk of the app holding filesystem-write access tied to a secret-bearing request.
- Keep two snippets but visually de-duplicate (e.g. one block, two labels) → rejected: still two `useMemo`s and two `<pre>` blocks producing byte-identical output; simpler to just have one.

## §8. Making `/init` actually reachable when storage was never configured (spec correction, found during implementation)

**Decision**: `frontend/instrumentation.ts`'s two startup checks (`verifyStorageConnection()`, spec 007; `verifyOwnerCredentialConfig()`, spec 008) no longer call `process.exit(1)` on failure — they log a warning and let the server finish starting regardless. A new `frontend/middleware.ts` then redirects every request (except `/init` itself and Next.js's static assets) to `/init` whenever the required `S3_*` env vars are entirely absent, using a cheap presence check (`process.env[name]`), not a live connectivity call.

**Rationale**: Verified live during this feature's own implementation (2026-07-25): with `frontend/.env.local` removed entirely to exercise the "storage not connected" state, `next dev` printed the old fatal error and exited before Next.js ever started serving requests — `/init` was completely unreachable. The original fail-fast design (spec 007 FR-004/FR-005, spec 008 FR-009) predates this feature and made sense in isolation (crash loudly rather than serve a broken app) but is incompatible with this feature's entire premise: a page that's supposed to be the one thing that *does* work when storage isn't configured can't do that if the process exits before it can be reached. The redirect-via-middleware half is needed because relaxing the exit alone would just leave every other route to throw its own unhandled error on first storage access — a middleware makes `/init` the actual landing point, matching the original ask ("l'app comunque deve avviarsi ma indirizzare subito").

**Why a cheap presence check, not the full `verifyStorageConnection()`, in middleware**: the fully authoritative check involves a network round trip (`HeadBucketCommand`); running it on *every* request to *every* route would add that latency universally, for the sole benefit of catching a narrower set of failure modes (unreachable endpoint, rejected credentials, missing bucket) that a presence check doesn't. Those narrower cases remain diagnosable — the visitor just needs to reach `/init` directly (which they will, on the first route that breaks and links back, or from bookmarking `/init` after the first presence-triggered redirect) to get the full check `/init`'s own page already performs (research.md §2). Given this app's established single-owner, low-volume scale (plan.md Scale/Scope), this tradeoff favors the simpler, zero-network-cost middleware.

**Alternatives considered**:
- Run the full `verifyStorageConnection()` check inside middleware too → rejected: per-request network cost on every route for comparatively little marginal benefit over the presence check, at this app's scale.
- Leave `instrumentation.ts` fail-fast as-is and instead just document that `/init` is only useful for *reconfiguring* an already-once-working install, not for a from-scratch setup → rejected: this directly contradicts the feature's own spec (FR-002/US2) and the original request that motivated it.

## §9. Testing approach

**Decision**: No automated test suite (consistent with specs 001-013) — validated via `quickstart.md`'s manual scenario walkthrough against a running `next dev` instance, toggling storage connectivity and bucket contents between scenarios.

## §10. Dropping the business-questions form and `os/identity.md`, showing MCP-connection guidance instead (spec correction, user request)

**Decision**: `initializeCompanyOs()` no longer takes any arguments and no longer creates `os/identity.md` — it only creates `os/`, `data/`, `AGENTS.md`, and `os/skills/init.md` (§4, §5 above). `frontend/app/init/InitForm.tsx` is removed entirely; the "empty" state is now a single no-field `<form method="POST" action="/init/submit"><button>` in `page.tsx` directly. The "already initialized" state (and the confirmation shown right after creating the skeleton) now renders a new `McpConnectManual` component: the MCP server URL (built from the request's `host`/`x-forwarded-proto` headers), a note that OAuth discovery/sign-in happens automatically once added as a connector in Claude/ChatGPT, a pointer to `/settings/connected-apps`, a link to `/editor`, and — when reached right after creation (`?created=1`) — one extra confirmation sentence.

**Rationale**: The user manually replaced the placeholder `frontend/lib/os/templates/init.md` with a much more sophisticated skill (a full "Fase 1 — Intervista" conversational interview covering business name/activity/pricing/tone/etc., which itself writes `os/identity.md` as part of "Fase 3 — Scrivi"). At that point, `/init`'s own two-question form asking a thinner version of the same information was redundant, and had no way to stay in sync with what the real skill actually produces. The genuinely useful next step after creating (or finding) the skeleton isn't a web form at all — it's connecting an AI assistant so it can run that real interview, which requires knowing the MCP URL and that OAuth is automatic. Showing that guidance directly closes the loop from "skeleton created" to "assistant connected and running its own setup" without a dead-end confirmation screen in between.

**MCP URL construction**: read via `headers()` (`next/headers`) inside the server component — `host` header for the domain, `x-forwarded-proto` for the scheme (falling back to `http` for a `localhost` host, `https` otherwise) — so the shown URL is correct whether running locally or deployed, without needing a dedicated "public URL" env var.

**Alternatives considered**:
- Keep the two-question form but make its answers optional/pre-fill from what the skill might ask → rejected: still redundant with, and liable to drift from, the skill's own richer interview; simpler to remove entirely and let the skill be the single source of truth for business content.
- Have the app read/mirror the skill's own interview questions dynamically to build the form → rejected: far more complex (parsing skill content to derive a UI) for a feature whose whole premise (research.md §5) is that skill content is opaque, fixed, and none of this app's business to interpret.
