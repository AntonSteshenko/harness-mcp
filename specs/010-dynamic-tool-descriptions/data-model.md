# Phase 1 Data Model: Dynamic Tool Descriptions from a Single Bootstrap File

This feature introduces no persisted schema or database entity — it reads one existing Markdown file (already a plain object in the existing S3-compatible bucket, spec 001/007) and holds a small amount of derived state in memory. The "entities" below are in-process TypeScript shapes, not storage records.

## BootstrapMarkers

The result of parsing the bootstrap file's content (research.md §2).

| Field      | Type       | Notes                                                                 |
|------------|------------|------------------------------------------------------------------------|
| `context`  | `string \| undefined`   | From `<!-- mcp-context: ... -->`; absent if the marker is missing or the file couldn't be read. |
| `triggers` | `string[] \| undefined` | From `<!-- mcp-triggers: ... -->`, split on `,` and trimmed; absent if the marker is missing. Never an array containing only empty strings — those are filtered out (spec.md Edge Cases: "trigger list is present but empty"). |

**Validation rules**: None enforced beyond regex extraction — any text between the marker's `:` and the closing `-->` is accepted verbatim (trimmed). This is intentionally permissive: the bootstrap file is owner-authored content, not user input crossing a trust boundary, and the fallback behavior (data-model §CachedFraming, research.md §4) already guarantees a malformed or absent marker degrades safely rather than needing rejection.

**State transitions**: N/A — recomputed fresh from file content on every cache miss (research.md §3); no lifecycle beyond "parsed now" or "not available now."

## CachedFraming

The module-level cache entry inside `lib/mcp-tools/bootstrap.ts` (research.md §3).

| Field       | Type                        | Notes                                                            |
|-------------|-----------------------------|-------------------------------------------------------------------|
| `value`     | `BootstrapMarkers \| null`  | `null` represents "no framing available" (unset path, unreadable file, or file with neither marker) — the single fallback signal every tool-description builder checks for. |
| `readAt`    | `number` (epoch ms)          | When `value` was last computed.                                  |

**Validation rules**: A cache entry older than the TTL (45s, research.md §3) is treated as stale and triggers a fresh read; this is the only rule governing this entity's lifecycle.

## ToolDescription (derived, not stored)

Not a stored entity — the final `description` string `registerTools()` passes into each `registerTool()` call, computed at request time as `framing(entry|write) + " " + originalDescription`, or just `originalDescription` when `CachedFraming.value` is `null` or contributes nothing usable. See [contracts/tool-description-framing.md](contracts/tool-description-framing.md) for the exact templates and precedence rules (research.md §5).

## Configuration value

| Name                 | Type     | Required | Notes |
|----------------------|----------|----------|-------|
| `MCP_BOOTSTRAP_PATH` | `string` | No       | Storage-relative path to the bootstrap file (e.g. `assistant/AGENTS.md`). Unset ⇒ `CachedFraming.value` is always `null` (FR-009). The only new `.env` entry this feature adds. |
