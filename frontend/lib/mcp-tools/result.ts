import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StorageError, wrapStorageError } from "@/lib/storage/errors";

/** Wraps a successful tool result as MCP text content (contracts/mcp-tools.md). */
export function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/**
 * Wraps a failure as an MCP `isError` result whose text content is the
 * structured `{ code, message }` shape defined in contracts/mcp-tools.md's
 * "Common error shape" — not just a bare message — so callers can branch on
 * `code` (not_found / type_mismatch / already_exists / storage_unreachable).
 */
export function errorResult(err: unknown): CallToolResult {
  const storageError = err instanceof StorageError ? err : wrapStorageError(err, "handling tool call");
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ code: storageError.code, message: storageError.message }) }],
  };
}
