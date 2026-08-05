# Research: Tools Status Page

**Input**: [spec.md](spec.md)

All decisions below were resolved by reading the existing codebase — the sign-in gate (spec 009/021), the tool-toggle mechanism this page displays (spec 023), and the i18n system (spec 015) — rather than by asking the user; this feature composes three already-established patterns, it doesn't invent new ones.

## 1. Where the list of "every tool" comes from

**Decision**: A new static catalog, `frontend/lib/mcp-tools/catalog.ts`, exporting `TOOL_CATALOG: { name: string; group: string }[]` — all 17 tool names, each labeled with which of the 5 registration modules it belongs to. Manually kept in sync with the `register*Tools` functions; the file's own comment says so and points at spec 023's contract table as the canonical list.

**Rationale**: Spec 023's whole design is that a disabled tool is **never registered** with the live `McpServer` (spec 023 research.md §1) — that's what makes a disabled tool indistinguishable from an unknown one to a connected MCP client. That same property means a live server instance can never be introspected for the *full* catalog: whatever is currently disabled is, by design, absent from it. Listing "every tool, including disabled ones" (spec.md FR-006) therefore requires a list that exists independently of live registration.

**Alternatives considered**:
- Instantiate a throwaway `McpServer` and call the 5 `register*Tools` functions while bypassing the gate (e.g. a second, ungated code path) purely to enumerate names — rejected: this means the tool-registration modules would need a second entry point that ignores `MCP_DISABLED_TOOLS`, adding real complexity (and a second way to register tools with different semantics) just to avoid one small static array.
- Parse the 5 registration files' source at build time to auto-generate the catalog — rejected: no codegen step exists anywhere in this repo, and introducing one for a 17-line list is disproportionate.

## 2. How a tool's status is computed

**Decision**: Reuse `isToolEnabled(name)` from `frontend/lib/mcp-tools/toolGate.ts` (spec 023) as-is — no new logic.

**Rationale**: This is the exact function that already decides whether a tool gets registered on the real MCP server. Using anything else risks the status page disagreeing with the server it's describing.

## 3. Page location, access gate, and freshness

**Decision**: `frontend/app/tools/page.tsx`, an `async` Server Component that starts with the same two lines every owner-only page in this app already starts with:

```ts
const signedIn = await hasActiveOwnerSession();
if (!signedIn) redirect(`/oauth/login?continue=${encodeURIComponent("/tools")}`);
```

(mirrors `frontend/app/settings/connected-apps/page.tsx:13-16` exactly, spec 009/021). No client-side JavaScript, no layout split, no new component library — a single server-rendered page, styled with the same inline-`style` convention `connected-apps/page.tsx` already uses.

**Rationale**: `hasActiveOwnerSession()` reads the session cookie, which already opts this route out of Next.js static generation/caching (the same reason `settings/connected-apps/page.tsx` needs no `export const dynamic = "force-dynamic"` today) — satisfying spec.md FR-005/SC-004 (status must reflect the *current* configuration on every load) for free, by construction, not by adding a new caching directive. `/files` uses a `layout.tsx` + client component split specifically to preserve `FileTree`'s expand/collapse state across navigation (spec 018 research.md §7) — that reason doesn't apply here (this page has no client-side state to preserve), so the simpler single-`page.tsx` pattern `/settings/*` already uses is the right fit, not `/files`'s.

**Alternatives considered**: A shared "admin/owner page" layout wrapping both `/settings/*` and `/tools` — rejected as unrequested scope; `/settings/*` today has no such shared layout either (each page repeats the same two-line gate), so adding one now would be an unrelated refactor of existing, working pages.

## 4. Multilingual support

**Decision**: Add a new top-level `tools` section to the `Dictionary` interface (`frontend/lib/i18n/dictionaries/types.ts`), populated in all 6 supported language files (`en`, `it`, `de`, `es`, `fr`, `ru`), following the exact shape and tone of the existing `settings.connectedApps`/`settings.pat` sections (title, table column labels, `active`/`disabled` status words, `signOut`).

**Rationale**: Spec 015-multilingual-support already requires every user-facing string in this app to go through the dictionary system; `/settings/connected-apps` and `/settings/personal-access-tokens` are the closest precedent (owner-only pages rendering a status table) and already show the exact pattern to copy (`pat`'s `active`/`revoked` status words map directly to this feature's `active`/`disabled`).

## 5. Table content beyond name + status

**Decision**: Also show each tool's group (which of the 5 registration modules it belongs to — "File & Directory", "Engine", "Messaging", "Inbox", "Tree Search"), sourced from `TOOL_CATALOG`'s `group` field.

**Rationale**: spec.md Assumptions explicitly leaves grouping/ordering as a presentation detail for planning. With 17 rows, an unstructured flat list is harder to scan than one grouped by area — grouping costs nothing extra (the catalog already needs a `group` field to describe where each tool lives, for the same maintenance-sync reason as its name) and directly serves spec.md SC-001 ("determine status within a few seconds").

## 6. Testing approach

**Decision**: No automated test framework introduced. Verification is a `quickstart.md` manual walkthrough, consistent with every prior feature in this repo.

**Rationale**: Same reasoning as spec 022 research.md §7 and spec 023 research.md §5 — confirmed again that `frontend/package.json` still has no test runner and no `*.test.*`/`*.spec.*` files exist anywhere in the tree.
