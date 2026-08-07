import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createFile, readFile } from "@/lib/storage/files";
import { invalidContent, tooLarge, unsupportedType } from "@/lib/storage/errors";
import { isAllowedExtension, MAX_UPLOAD_BYTES, mimeTypeForPath } from "@/lib/storage/fileTypes";
import { buildEntryDescription, buildWriteDescription, getBootstrapFraming } from "./bootstrap";
import { errorResult, ok } from "./result";
import { registerGatedTool } from "./toolGate";

/** Strict base64 check — Node's `Buffer.from(str, "base64")` is lenient and
 * silently drops invalid characters instead of throwing, which would let a
 * malformed call through as a corrupted file rather than a clean rejection
 * (spec 029 research.md §2, FR-003). */
function isValidBase64(content: string): boolean {
  return content.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(content);
}

function extensionOf(path: string): string {
  return path.split(".").pop() ?? "";
}

/**
 * Registers the MCP tools for binary file content (spec 029): create_binary_file
 * (this file) writes base64-encoded content as raw bytes; read_binary_file
 * reads a file's raw bytes back as base64 — the round-trip counterpart to
 * create_file/read_file, which only ever handle UTF-8 text.
 */
export async function registerBinaryFileTools(server: McpServer, disabledTools: ReadonlySet<string>): Promise<void> {
  const framing = await getBootstrapFraming();

  registerGatedTool(
    server,
    disabledTools,
    "create_binary_file",
    {
      title: "Create Binary File",
      description: buildWriteDescription(
        "Creates a binary file at path from base64-encoded content, overwriting it if a file already exists there. " +
          "Fails with already_exists if a directory exists at path, unsupported_type if path's extension isn't " +
          "an allowed document/image/spreadsheet/diagram/markup type, too_large if the decoded content exceeds " +
          "25 MB, or invalid_content if content isn't valid base64. Use this instead of create_file for any " +
          "non-text file (PDF, images, Office documents, etc.) — create_file would corrupt binary content.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style path, e.g. "reports/summary.pdf"'),
        content: z.string().describe("Base64-encoded file content"),
      },
    },
    async ({ path, content }) => {
      if (!isValidBase64(content)) {
        return errorResult(invalidContent(path, "content is not valid base64"));
      }
      if (!isAllowedExtension(path)) {
        return errorResult(unsupportedType(path, extensionOf(path)));
      }

      const buffer = Buffer.from(content, "base64");
      if (buffer.byteLength > MAX_UPLOAD_BYTES) {
        return errorResult(tooLarge(path, MAX_UPLOAD_BYTES));
      }

      try {
        return ok(await createFile(path, buffer, mimeTypeForPath(path)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "read_binary_file",
    {
      title: "Read Binary File",
      description: buildEntryDescription(
        "Reads the full current content of the file at path, returned as base64-encoded bytes. Works for any " +
          "stored file, text or binary — use this instead of read_file when you need the file's exact original " +
          "bytes (e.g. to relay a PDF or image elsewhere), or whenever read_file fails with invalid_content " +
          "because the file is binary.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style path, e.g. "reports/summary.pdf"'),
      },
    },
    async ({ path }) => {
      try {
        const result = await readFile(path);
        return ok({
          path: result.path,
          content: result.content.toString("base64"),
          size: result.size,
          lastModified: result.lastModified,
          etag: result.etag,
          contentType: result.contentType,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
