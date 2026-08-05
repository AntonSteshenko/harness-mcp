import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AnySchema, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Forwards to server.registerTool(name, config, cb) only when `name` is not
 * in `disabledTools` — otherwise it is never registered at all, so it's
 * absent from tools/list and a call to it fails exactly like an
 * unrecognized tool name (not the SDK's own distinguishable "Tool X
 * disabled" error, which only applies to tools that were registered and
 * then disabled).
 *
 * `disabledTools` is fetched once per /mcp request by the caller
 * (lib/mcp-tools/store.ts's getDisabledTools(), spec 025 research.md §6)
 * and threaded through every register*Tools(server, disabledTools) call —
 * not re-read here per tool, since that would mean one S3 read per tool per
 * request instead of one per request (research.md §2). Supersedes spec
 * 023's MCP_DISABLED_TOOLS env-var read (spec 025 FR-007/FR-011).
 *
 * Mirrors McpServer.registerTool's own generic signature (mcp.d.ts) rather
 * than a `Parameters<McpServer["registerTool"]>` pass-through — the latter
 * collapses to `never` because indexed access on a generic method loses its
 * type parameters, which TypeScript can't be told to re-infer from a rest
 * parameter.
 */
export function registerGatedTool<
  OutputArgs extends ZodRawShapeCompat | AnySchema,
  InputArgs extends undefined | ZodRawShapeCompat | AnySchema = undefined,
>(
  server: McpServer,
  disabledTools: ReadonlySet<string>,
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: InputArgs;
    outputSchema?: OutputArgs;
    annotations?: ToolAnnotations;
    _meta?: Record<string, unknown>;
  },
  cb: ToolCallback<InputArgs>,
): void {
  if (!disabledTools.has(name)) {
    server.registerTool(name, config, cb);
  }
}
