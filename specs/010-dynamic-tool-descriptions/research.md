# Phase 0 Research: Dynamic Tool Descriptions from a Single Bootstrap File

No `NEEDS CLARIFICATION` markers remain in the Technical Context. Research here confirms how the existing codebase's request lifecycle and tool-registration code let this feature work without any new infrastructure, rather than evaluating new technology choices.

## §1. How `tools/list` requests actually reach `registerTools()`, and why re-reading the bootstrap file "per `tools/list`" is straightforward

**Decision**: Generate the framing text inside the existing `registerTools(server)` function (`frontend/lib/mcp-tools/index.ts`), by calling a new `bootstrap.ts` helper once at the top of the function, before the 8 `registerTool()` calls.

**Rationale**: Inspecting `mcp-handler`'s POST handler (`frontend/node_modules/mcp-handler/dist/index.js`) shows that every incoming MCP HTTP request constructs a brand-new `McpServer` instance and calls the `initializeServer` callback — which is exactly `(server) => { registerTools(server); }`, set up in `app/mcp/route.ts` — before connecting it to a fresh transport for that single request:

```js
const transport = new webStandardStreamableHttp_js.WebStandardStreamableHTTPServerTransport({ sessionIdGenerator });
const server = new mcp_js.McpServer(serverInfo, mcpServerOptions);
yield initializeServer(server);   // this is our (server) => registerTools(server)
yield server.connect(transport);
```

This means `registerTools()` (and therefore any code placed at its top) already re-runs on every single JSON-RPC call the client makes, including every `tools/list` request — there is no long-lived server object whose tool descriptions get "baked in" once at startup. Reading the bootstrap file inside `registerTools()` satisfies spec.md's requirement to reflect edits without a redeploy for free, with no new request hook or middleware needed.

**Alternatives considered**:
- *Reading the bootstrap file at module load time (top of `index.ts`, outside the function)*: rejected — module-level code in a serverless Node process only runs once per cold start, so an edit to the bootstrap file would not be reflected until the next cold start, contradicting User Story 2 ("without needing a code change or redeploy").
- *Hooking a lower-level `server.setRequestHandler("tools/list", ...)` override to intercept only `tools/list` specifically*: rejected as unnecessary — `registerTools()` already runs fresh per request regardless of which method the client is calling, so there is no need to special-case the `tools/list` method; generating the framing unconditionally at the top of `registerTools()` is simpler and has negligible cost (the file read is cached, per §3) even on requests that end up being e.g. a tool call rather than a list.

## §2. Marker format and parsing

**Decision**: Parse two independent, optional HTML comments anywhere in the bootstrap file's text, using simple regexes:

- `/<!--\s*mcp-context:\s*([^>]*?)\s*-->/`  → `context: string`
- `/<!--\s*mcp-triggers:\s*([^>]*?)\s*-->/` → split the captured text on `,`, trim each piece, drop empty pieces → `triggers: string[]`

If a regex does not match, that piece is simply absent (`undefined` / empty array) — it is not an error condition.

**Rationale**: The feature request specifies this exact comment syntax (`<!-- mcp-context: ... -->`, `<!-- mcp-triggers: ... -->`) precisely so the markers don't disturb the file's normal Markdown rendering. A small tolerant regex (rather than a Markdown/HTML parser dependency) is proportionate: the bootstrap file is plain text read as a string, and no new dependency is justified for extracting two single-line comment values.

**Alternatives considered**:
- *A full HTML comment parser or Markdown AST library (e.g. `remark`, already a dependency for a different purpose)*: rejected as disproportionate — the two markers have a fixed, simple shape, and a regex is easy to reason about and test; introducing an AST pass for two string extractions adds complexity with no benefit.
- *YAML frontmatter instead of HTML comments*: rejected — not what the feature request specifies, and frontmatter would visibly appear at the top of the rendered document in common Markdown viewers, defeating the "doesn't disturb rendering" goal the request already solved by choosing HTML comments.

## §3. Avoiding a storage read on every single request

**Decision**: Cache the parsed `{ context?, triggers? }` result (or `null`) in a module-level variable inside `bootstrap.ts`, alongside the timestamp it was read, with a 45-second TTL. A request that arrives after the TTL expires triggers a fresh read; requests within the TTL window reuse the cached value.

**Rationale**: Because a fresh `McpServer` (and thus a fresh call to `registerTools()`) is created per HTTP request (§1), without a cache every single MCP request — including tool *calls*, not just `tools/list` — would trigger an S3 read of the bootstrap file. A short TTL cache at module scope survives across requests within the same warm serverless function instance (the same pattern already implicitly relied on by `lib/storage/client.ts`'s singleton `s3Client`), keeping the added cost low while still reflecting bootstrap-file edits within about a minute, matching spec.md's SC-001.

**Alternatives considered**:
- *No caching at all*: acceptable per spec.md ("a light cache... is not obligatory"), but rejected as the default here since it's a few extra lines and meaningfully reduces S3 calls with no downside, given the TTL still satisfies the "within about a minute" success criterion.
- *A longer TTL (e.g. 5+ minutes) or process-lifetime caching*: rejected — would make User Story 2 ("see the update... within about one minute") unreliable on a warm instance that keeps serving requests without a cold start.

## §4. Fallback and error handling

**Decision**: `bootstrap.ts` wraps the entire read-and-parse sequence in a single `try/catch`. `MCP_BOOTSTRAP_PATH` unset, `readFile()` throwing (e.g. the `StorageError` with code `not_found` that `lib/storage/files.ts` already throws for a missing key, or `storage_unreachable`), or any parse error all resolve to the same outcome: the cached/returned value is `null`. Tool-description building functions treat `null` (or a value with both `context` and `triggers` empty) identically to "no framing" and return the tool's original, unmodified description untouched.

**Rationale**: This directly implements the spec's non-negotiable safety requirement (User Story 3, FR-009) — a bootstrap-file problem must never surface as an error to the MCP client or remove a tool from the list. Centralizing the catch in one place in `bootstrap.ts` (rather than in `index.ts`'s 8 call sites) means `registerTools()` only ever sees a plain, already-safe value.

**Alternatives considered**:
- *Letting `readFile()`'s `StorageError` propagate and catching it in `index.ts`*: rejected — would require the same try/catch repeated at the one call site anyway, but placing it inside `bootstrap.ts` keeps the "this never throws" guarantee co-located with the code that reads the file, matching this codebase's existing convention of storage-adjacent code owning its own error translation (e.g. `lib/storage/errors.ts`'s `wrapStorageError`).

## §5. Partial markers (one present, one absent)

**Decision**: The description-building functions accept `context?: string` and `triggers?: string[]` independently. The long (entry-tool) template degrades gracefully:
- Both present: `Access to {context}: a Markdown store. Use it when the user wants: {triggers}. IMPORTANT: before acting, first read "{bootstrap_path}" and follow it.`
- Only `context` present: the `Use it when the user wants: ...` clause is omitted.
- Only `triggers` present: the sentence uses a generic noun ("this storage") in place of `{context}`.
- Neither present: falls back to the tool's original description only (same as §4's full-fallback case).

The short (write-tool) template only ever needs `context`; when `context` is absent it falls back similarly to a generic phrase, or to the original description alone if that reads awkwardly. The bootstrap-path instruction itself only depends on `MCP_BOOTSTRAP_PATH` being configured, independent of whether either marker parsed.

**Rationale**: Directly satisfies FR-010 ("best-effort guidance sentence when only one of the two pieces of information is present") and spec.md's Edge Cases ("bootstrap file contains only one of the two pieces of information").

**Alternatives considered**:
- *Treating "only one marker present" the same as "no markers" (full fallback)*: rejected — spec.md's User Story 3 acceptance scenario 4 explicitly requires a best-effort combination, not an all-or-nothing fallback.

## §6. `notifications/tools/list_changed`

**Decision**: Do not implement this notification in this feature.

**Rationale**: The feature request marks this as optional ("if trivially supported"). Per §1, each MCP HTTP request gets its own brand-new `McpServer` and transport that are torn down after that single request/response — there is no persistent connection between the moment a client last called `tools/list` and a later edit to the bootstrap file for the server to push a notification over. `mcp-handler`'s only long-lived-connection path (the SSE transport, and its Redis-backed pub/sub plumbing) requires a `REDIS_URL`/`KV_URL` environment variable that is not configured anywhere in this project (`frontend/.env.example` has no Redis entry), and provisioning that infrastructure solely to support an optional notification would be disproportionate. Clients are expected to call `tools/list` again on their own cadence (standard MCP client behavior), which is exactly what already picks up bootstrap-file edits per §1–§3.

**Alternatives considered**:
- *Standing up Redis/`REDIS_URL` to enable the SSE transport's pub/sub path and emit the notification*: rejected — a new piece of infrastructure and a new required env var, contradicting the feature request's own constraint that `MCP_BOOTSTRAP_PATH` should be the only new `.env` addition.
