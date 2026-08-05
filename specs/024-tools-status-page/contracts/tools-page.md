# Contract: `/tools` Page

**Input**: [spec.md](../spec.md), [research.md](../research.md), [data-model.md](../data-model.md)

Follows the same contract style as [specs/009-editor-login-gate/contracts/protected-routes.md](../../009-editor-login-gate/contracts/protected-routes.md) — this route's authorization behavior, not a JSON API shape (it's an HTML page).

## `GET /tools`

| Session state | Behavior |
|---|---|
| No active owner session | `302` redirect to `/oauth/login?continue=%2Ftools` — no tool name, group, or status is rendered anywhere in the response |
| Active owner session | Renders the tools status page: one row per entry in `TOOL_CATALOG` (`frontend/lib/mcp-tools/catalog.ts`), each showing its name, group, and current status (`enabled` / `disabled`) per `isToolEnabled` (`frontend/lib/mcp-tools/toolGate.ts`, spec 023) |

**Guarantee (FR-003, SC-003)**: in the unauthenticated case, the response body contains no tool information at all — only the redirect.

**Guarantee (FR-006, SC-002)**: every entry in `TOOL_CATALOG` appears in the authenticated response exactly once, regardless of its status — a disabled tool is rendered with a `disabled` status, never omitted.

**Guarantee (FR-005, SC-004)**: the response is never served from a static/build-time cache — each authenticated request re-evaluates `isToolEnabled` against the server process's current environment, so a status change (followed by a server restart, per spec 023 FR-008) is visible on the very next request.

## Rendered content shape

Not a machine-readable contract (this is an HTML page for a human, not an API), but the information present in the authenticated render is fully described by [data-model.md](../data-model.md)'s Tool Status Entry: for each of the 17 catalog entries, its `name`, `group`, and `enabled` boolean — nothing else about server configuration is exposed (no env var values, no file paths, no other tools' internal details).

## Unaffected routes (explicitly out of scope)

Every existing route is unchanged by this feature — `/tools` is additive. In particular, `/mcp` itself (the actual MCP server endpoint, spec 002/008) is not modified: this page only *reads* the same `MCP_DISABLED_TOOLS` configuration and the same tool catalog information that already determines `/mcp`'s behavior, via spec 023's existing `isToolEnabled`.
