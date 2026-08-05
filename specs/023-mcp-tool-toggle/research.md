# Research: MCP Tool Toggle

**Input**: [spec.md](spec.md)

All decisions below were settled either directly with the user before spec.md was written, or by reading the existing MCP tool layer (`frontend/lib/mcp-tools/`) and the installed `@modelcontextprotocol/sdk` package itself.

## 1. How to make a disabled tool indistinguishable from an unknown one (FR-004)

**Decision**: Never call `server.registerTool()` for a deny-listed name — skip registration entirely — rather than registering every tool and calling the SDK's own per-tool `disable()`.

**Rationale**: Reading `frontend/node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js` directly shows the SDK already has built-in per-tool enable/disable state: `registerTool()` returns a handle with `.disable()`/`.enable()`, `tools/list` already filters on `tool.enabled` (line 72: `.filter(([, tool]) => tool.enabled)`), and calling a tool throws `McpError(InvalidParams, "Tool ${name} disabled")` when `!tool.enabled` (lines 109–110). Both approaches equally satisfy FR-003 (omitted from `tools/list`), but they diverge on the call-attempt error: a genuinely unregistered name throws `McpError(InvalidParams, "Tool ${name} not found")` (line 107), while a registered-then-`.disable()`'d tool throws the distinct `"...disabled"` message. spec.md FR-004 requires the exact same failure as an unrecognized name, so only "never register it" satisfies that requirement.

**Alternatives considered**: Registering every tool and calling `registeredTool.disable()` for deny-listed names — rejected because it produces a distinguishable error message, violating FR-004, even though it would satisfy the `tools/list` omission on its own.

## 2. Where the gating check lives

**Decision**: One new module, `frontend/lib/mcp-tools/toolGate.ts`, exporting:
- `isToolEnabled(name: string): boolean`
- `registerGatedTool<T extends Parameters<McpServer["registerTool"]>>(server: McpServer, ...args: T): void` — a thin pass-through wrapper that only forwards to `server.registerTool(...args)` when `isToolEnabled(args[0])` is true.

Every one of the 5 existing registration modules (`index.ts`, `engineTools.ts`, `messagingTools.ts`, `inboxTools.ts`, `treeTools.ts`) calls `registerGatedTool(server, ...)` instead of `server.registerTool(...)` directly, at all 17 existing call sites (including the `for` loop over `ENGINE_TOOLS` in `engineTools.ts`).

**Rationale**: The same guard is needed identically at 17 call sites across 5 files; a shared helper avoids repeating `if (isToolEnabled("x")) { ... }` around every call and the risk of a future tool forgetting the guard. `registerTool` has a single generic signature (not an overload union — confirmed in `mcp.d.ts`), so a tuple-generic pass-through (`<T extends Parameters<McpServer["registerTool"]>>(...args: T)`) preserves full type inference for each call site's specific config/handler pair without needing to name the SDK's internal `ZodRawShapeCompat`/`AnySchema` types directly. This pattern must be confirmed against `tsc`/`next build` during implementation (tasks.md), since generic rest-parameter forwarding is the one place this plan takes on any real technical risk.

**Alternatives considered**:
- An inline `if` guard duplicated before each of the 17 `server.registerTool(...)` calls — rejected: more repetition, and each future tool addition has to remember it independently.
- A wrapper around each `register*Tools(server)` function itself (group-level gating) — rejected: too coarse; spec.md requires per-tool granularity (a group can still be fully disabled by listing every tool in it, per spec.md User Story 2).

## 3. How `MCP_DISABLED_TOOLS` is parsed

**Decision**: Split on commas, trim each entry, drop empty strings, compare case-sensitively (exact match) against each tool's literal registered name. Read fresh from `process.env` on every `isToolEnabled` call — no caching.

**Rationale**: Matches the parsing style this repo already uses for its one other comma-separated env-sourced list — `bootstrap.ts`'s `mcp-triggers` marker parsing (`frontend/lib/mcp-tools/bootstrap.ts:21-24`, also split/trim/filter). Case-sensitive exact match keeps behavior unsurprising: every existing tool name is already lowercase `snake_case` (spec.md Edge Cases), so no case-normalization step is needed. No caching is required — unlike `bootstrap.ts`'s `getBootstrapFraming()`, which caches because it performs an async storage read — because reading `process.env` is synchronous and free; this mirrors `lib/messaging/config.ts`'s `readMessagingConfig()`, which also re-reads `process.env` on every call with no cache.

**Alternatives considered**: Case-insensitive matching — rejected: adds a normalization step for a mismatch scenario that can't occur under the project's existing naming convention, and spec.md Edge Cases explicitly documents case-sensitive matching as the intended behavior.

## 4. Where the env var is documented

**Decision**: `frontend/.env.example`, in a new section next to the other MCP-tool-specific var (`MCP_BOOTSTRAP_PATH`), with the comment listing all 17 disable-able tool names.

**Rationale**: Next.js only loads `.env` files from its own project root (`frontend/`) — every tool-affecting env var already lives there, not in the repo-root `.env.example` (which only configures the local MinIO container; see that file's own comment explaining the split, spec 007-s3-storage-config).

## 5. Testing approach

**Decision**: No new automated test framework is introduced. Verification follows the same convention every prior spec in this repo uses: a runnable `quickstart.md` (manual MCP tool calls with expected outcomes).

**Rationale**: Confirmed (again, as in spec 022's research.md §7) there is no test runner in this repo — `frontend/package.json` only has `dev`/`build`/`start`/`lint` scripts, and there are zero `*.test.*`/`*.spec.*` files anywhere in the tree. This feature has no new tool contract to test against (it changes registration behavior, not tool input/output shapes), so `quickstart.md` covers it via `tools/list` inspection instead of a `contracts/*.md` tool-shape doc.

**Alternatives considered**: Introducing Vitest/Jest for this feature only — rejected as scope creep and inconsistent with every other feature in the repo.
