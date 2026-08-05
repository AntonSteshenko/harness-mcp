# Data Model: Manage Tools From The Page

**Input**: [spec.md](spec.md), [research.md](research.md)

## Tool Status Record

The single persisted record this feature introduces — spec.md's "Tool Status Record" Key Entity.

| Field | Type | Notes |
|---|---|---|
| `disabledTools` | `string[]` | Names of every currently-disabled tool. Absence of a name means active — mirrors `MCP_DISABLED_TOOLS`'s own "listed = disabled, everything else active" semantics (spec 023), just persisted instead of read from `process.env`. |

**Location**: `.mcp-tools/status.json` under the app's configured S3 bucket (reserved prefix `.mcp-tools/`, research.md §3) — excluded from `list_directory`/`list_directory_tree`/`find_files_by_name`/`search_file_content` the same way `.oauth/` already is (research.md §3).

**Default**: If the object doesn't exist yet (first use, or a fresh deployment), it's treated as `{ disabledTools: [] }` — every tool active (spec.md FR-011). Not seeded from any prior `MCP_DISABLED_TOOLS` value (spec.md Assumptions).

**Read by**:
- `frontend/app/mcp/route.ts`'s `initializeServer` callback, once per `/mcp` request (research.md §1, §2), threaded into all 5 `register*Tools(server, disabledTools)` calls.
- `frontend/app/tools/page.tsx`, once per page load, to compute each row's displayed status.

**Written by**: `POST /tools/[name]/status` (contracts/manage-tools-routes.md) — a full read-modify-write of the record (add or remove one name from `disabledTools`), non-atomic (research.md §2, accepted tradeoff mirroring `lib/messaging/rateLimit.ts`'s own accepted non-atomicity).

## State / Lifecycle

A tool has exactly two states, `active` and `disabled`, toggled only by a confirmed change from `/tools` (spec.md FR-001, FR-002). There is no third "pending"/"in progress" state persisted anywhere — the two-step confirm flow (research.md §4) exists only in the page/route layer; by the time `POST /tools/[name]/status` runs, the change is final and applied in one write.
