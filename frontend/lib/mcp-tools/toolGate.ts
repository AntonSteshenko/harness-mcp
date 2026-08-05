import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AnySchema, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Whether `name` is allowed to be registered, per MCP_DISABLED_TOOLS (spec
 * 023-mcp-tool-toggle). Read fresh from process.env on every call — no
 * caching needed, mirrors lib/messaging/config.ts's readMessagingConfig().
 * Case-sensitive exact match; every existing tool name is already lowercase
 * snake_case, so no normalization is needed.
 */
export function isToolEnabled(name: string): boolean {
  const disabled = new Set(
    (process.env.MCP_DISABLED_TOOLS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  return !disabled.has(name);
}

/**
 * Forwards to server.registerTool(name, config, cb) only when the tool's
 * name is enabled — otherwise it is never registered at all, so it's absent
 * from tools/list and a call to it fails exactly like an unrecognized tool
 * name (not the SDK's own distinguishable "Tool X disabled" error, which
 * only applies to tools that were registered and then disabled).
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
  if (isToolEnabled(name)) {
    server.registerTool(name, config, cb);
  }
}
