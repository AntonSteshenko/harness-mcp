# Research: Manage Tools From The Page

**Input**: [spec.md](spec.md)

Resolved by reading the existing codebase — the storage layer's reserved-prefix pattern (spec 008/017), the `/tools` page this feature extends (spec 024), the `MCP_DISABLED_TOOLS` mechanism it supersedes (spec 023), and — critically — the actual runtime behavior of `mcp-handler`, the package that serves `/mcp` — not assumed from memory.

## 1. How often does the MCP server actually re-register its tools?

**Decision**: No special "propagate the change live" mechanism is needed — it already exists. `mcp-handler`'s Streamable HTTP POST handler (`node_modules/mcp-handler/dist/index.js`, `initializeMcpApiHandler`) creates a **brand-new `McpServer` and re-runs the whole `initializeServer` callback — i.e. all 5 `register*Tools(server)` calls — on every single POST request to `/mcp`**, not once at process startup. There is no session-scoped server reuse in this handler.

**Rationale**: This is why spec 023's env-var mechanism *felt* like it needed a restart even though the registration code itself already re-ran per request: `process.env` genuinely doesn't change without one. Once the source of truth moves to storage (this feature), the very next `/mcp` request after a change already gets a freshly-registered server reflecting it — no restart, no special cache-busting. This directly grounds spec.md FR-006/SC-003 ("without restarting the server") in what's actually true, and also grounds *why* User Story 2's warning is worded the way it is: an already-connected AI assistant isn't stale because the **server** is slow to pick up the change — it's stale because **the assistant itself** is holding on to a `tools/list` result it already fetched earlier in its session, and won't ask again until it reconnects or the host app refreshes it. The warning is about the client's behavior, not the server's.

## 2. Storage shape: one record or one file per tool

**Decision**: A single JSON record, `{ disabledTools: string[] }`, at one reserved key — not one file per tool.

**Rationale**: Because every `/mcp` POST re-registers all 17 tools (finding 1), the status must be read once per request and reused for all 17 gating checks, not read once per tool — that would be 17 S3 `GetObject` calls on the hot path of *every single MCP tool invocation*, not just at startup. A single record is one `GetObject` per request. The tradeoff is accepted non-atomicity: a read-modify-write toggle from the page could race with a concurrent toggle of a *different* tool and lose it. This repo already accepts the same class of tradeoff for `lib/messaging/rateLimit.ts`'s counter ("best effort, non-atomic read-check-then-write... acceptable") — the same judgment applies here for what is, in practice, a single-owner admin action performed interactively, not a high-concurrency write path. Spec.md's own edge case ("changed from two different browser tabs... last confirmed change wins") already accepts last-write-wins as the intended behavior for the same-tool case; this extends that same acceptance to the rarer cross-tool case rather than adding per-tool files (17× more GETs per request) or a locking scheme neither this app nor its actual usage pattern (one owner) needs.

**Alternatives considered**: One JSON file per tool under the reserved prefix, listed via the existing `listRecords()` pattern (spec 008's OAuth grants/clients) — rejected on request-latency grounds (finding 1 makes this a per-request cost, not a one-time cost) given the concurrency risk it would avoid is already low-stakes and already accepted elsewhere in this exact codebase.

## 3. Where the record lives

**Decision**: A new reserved prefix, `.mcp-tools/`, with its own tiny `frontend/lib/mcp-tools/store.ts` — `getRecord`/`putRecord` over `Key = ".mcp-tools/" + relativeKey + ".json"` — copying `frontend/lib/messaging/store.ts`'s own copy of the same pattern (which itself mirrors `frontend/lib/oauth/store.ts`'s `.oauth/` convention) rather than importing either.

**Rationale**: This repo already has this exact pattern duplicated per feature area (`.oauth/` for OAuth state, `.messaging/` for messaging state) instead of factored into one shared generic module — confirmed by reading both files, which are near-identical. Matching that established (if duplicative) convention is more consistent than introducing this feature's own generic abstraction. `frontend/lib/storage/directories.ts` currently excludes only `OAUTH_PREFIX` from `listDirectory` results (not `MESSAGING_PREFIX` — an existing gap, out of scope to fix here); this feature adds its own exclusion for `.mcp-tools/` so the status record never leaks into `list_directory`/`list_directory_tree`/`find_files_by_name`/`search_file_content` — those all compose `listDirectory` (`lib/storage/tree.ts`), so one filter there protects all of them.

## 4. The confirmation step

**Decision**: Two server-rendered pages/routes, no client-side JavaScript, extending the pattern `app/settings/connected-apps/[grantId]/revoke/route.ts` already uses for a mutating owner action (a plain `<form method="POST">`) with one addition this repo doesn't have precedent for yet — an explicit confirmation screen in between:

1. `GET /tools/[name]/confirm?to=active|disabled` — owner-gated, renders "You're about to set **{name}** to {to}" plus the not-yet-applied warning copy, with a `<form method="POST">` to the next route and a cancel link back to `/tools`. Pure read, no side effect — safe to reload or abandon (spec.md FR-003).
2. `POST /tools/[name]/status` — owner-gated, applies the change (mirrors the revoke route's shape), then redirects to `/tools?changed=<name>&to=<status>`.

**Rationale**: spec.md FR-002 requires a step "separate" from the control that displays current status — a single-page toggle (checkbox that submits itself) would still be "one click," which the spec explicitly rules out. A two-route GET-then-POST flow is the smallest change that satisfies "explicit, separate confirmation naming the specific tool and the change" without introducing a client-side modal/dialog (which would be the first client-side interactive component in this whole owner-pages area — `/settings/*` and `/tools` are all plain server components today).

## 5. Delivering the "not instant" warning every time (FR-005)

**Decision**: The warning is not stored anywhere — it's rendered by `/tools` itself whenever it's loaded with `?changed=<name>&to=<status>` in the URL (set by the POST route's redirect target), using the specific tool name and new status in the message.

**Rationale**: Driving it from the redirect's query string (rather than, say, a one-time flag written to storage) trivially satisfies "every time, not just the first" (spec.md FR-005/SC-004) — every successful change produces a fresh redirect with fresh query params, so the message can never be "already shown" from a prior visit.

## 6. What replaces `isToolEnabled`

**Decision**: `frontend/lib/mcp-tools/toolGate.ts` changes shape: the old synchronous, per-call `isToolEnabled(name)` (which read `process.env.MCP_DISABLED_TOOLS` fresh every call, spec 023) is replaced by an async `getDisabledTools(): Promise<ReadonlySet<string>>` (in the new `store.ts`, one read) plus `registerGatedTool(server, disabledTools, name, config, cb)` — now taking the pre-fetched set as a parameter instead of re-deriving it itself. `frontend/app/mcp/route.ts`'s `initializeServer` callback fetches `disabledTools` once and threads it into all 5 `register*Tools(server, disabledTools)` calls; each of those 17 `registerGatedTool` call sites is updated to pass it through.

**Rationale**: Finding 2 already established that the fetch must happen once per request, not once per tool — this is that decision applied at the call-site level. It also directly implements spec.md FR-007: the same `disabledTools` set is what both the live registration path and (via the analogous read in the page) the `/tools` display consult — one source of truth, not two.

## 7. What happens to `MCP_DISABLED_TOOLS`

**Decision**: The gating logic stops reading `process.env.MCP_DISABLED_TOOLS` entirely — per spec.md FR-011 (user's explicit choice), the new store starts empty (every tool active) and is never seeded from it. `frontend/.env.example` and `README.md`'s spec-023-added sections are updated to say the variable is no longer read, pointing at `/tools` instead, rather than silently leaving stale, misleading documentation.

**Rationale**: Direct implementation of the user's answered clarification (spec.md Assumptions) — documenting the change is necessary so an operator who still has the old variable set doesn't reasonably assume it's still doing something.

## 8. Testing approach

**Decision**: No automated test framework introduced; verification is `quickstart.md`, consistent with every prior feature in this repo (confirmed again: still no test runner or `*.test.*` files anywhere in `frontend/`).
