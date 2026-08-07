import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createDirectory, deleteDirectory, listDirectory } from "@/lib/storage/directories";
import { isConclusivelyBinaryExtension, looksBinaryContent } from "@/lib/storage/binaryDetection";
import { invalidContent } from "@/lib/storage/errors";
import { createFile, deleteFile, readFile, updateFile } from "@/lib/storage/files";
import { move } from "@/lib/storage/move";
import { buildEntryDescription, buildWriteDescription, getBootstrapFraming } from "./bootstrap";
import { errorResult, ok } from "./result";
import { registerGatedTool } from "./toolGate";

/**
 * Registers every MCP tool this server exposes (contracts/mcp-tools.md) onto
 * the given server instance. Tools are added here incrementally per user
 * story (US1: create_file/read_file/delete_file, US2: directory tools,
 * US3: update_file/move).
 */
export async function registerTools(server: McpServer, disabledTools: ReadonlySet<string>): Promise<void> {
  const framing = await getBootstrapFraming();

  registerGatedTool(
    server,
    disabledTools,
    "create_file",
    {
      title: "Create File",
      description: buildWriteDescription(
        "Creates a file at path with content, overwriting it if a file already exists there. " +
          "Fails with already_exists if a directory exists at path.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style path, e.g. "notes/todo.txt"'),
        content: z.string().describe("The full content to write"),
      },
    },
    async ({ path, content }) => {
      try {
        return ok(await createFile(path, Buffer.from(content, "utf-8")));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "read_file",
    {
      title: "Read File",
      description: buildEntryDescription(
        "Reads the full current content of the file at path. Fails with invalid_content if the file is " +
          "binary (e.g. PDF, image, Office document) — use read_binary_file for those instead.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style path, e.g. "notes/todo.txt"'),
      },
    },
    async ({ path }) => {
      // Extensions that conclusively indicate binary content are rejected
      // before ever fetching/decoding the object (spec 028 research.md §4,
      // spec 029 FR-010) — mirrors GET /api/file's guard exactly, via the
      // shared lib/storage/binaryDetection.ts.
      if (isConclusivelyBinaryExtension(path)) {
        return errorResult(invalidContent(path, "file is binary and can't be read as text — use read_binary_file instead"));
      }

      try {
        const result = await readFile(path);
        const content = result.content.toString("utf-8");
        // Extension didn't conclusively resolve it — fall back to content
        // sniffing (FR-009 in spec 028, reused here).
        if (looksBinaryContent(content)) {
          return errorResult(invalidContent(path, "file is binary and can't be read as text — use read_binary_file instead"));
        }
        return ok({ ...result, content });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "delete_file",
    {
      title: "Delete File",
      description: buildWriteDescription(
        "Deletes the file at path. If path is outside Trash, it is moved into Trash instead " +
          "of being destroyed (recoverable via the move tool). If path is already under Trash, " +
          "it is destroyed for real.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style path, e.g. "notes/todo.txt"'),
      },
    },
    async ({ path }) => {
      try {
        return ok(await deleteFile(path));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "create_directory",
    {
      title: "Create Directory",
      description: buildWriteDescription(
        "Creates a directory at path. Idempotent if it already exists. Fails with " +
          "already_exists if a file exists at path.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style directory path, e.g. "notes/"'),
      },
    },
    async ({ path }) => {
      try {
        return ok(await createDirectory(path));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "list_directory",
    {
      title: "List Directory",
      description: buildEntryDescription(
        "Lists the direct children (files and subdirectories) of the directory at path. " +
          "Does not recurse into subdirectories. Use \"\" for the root.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style directory path, e.g. "notes/", or "" for the root'),
      },
    },
    async ({ path }) => {
      try {
        return ok(await listDirectory(path));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "delete_directory",
    {
      title: "Delete Directory",
      description: buildWriteDescription(
        "Deletes the directory at path and everything inside it, recursively. If path is " +
          "outside Trash, the whole subtree is moved into Trash instead of being destroyed " +
          "(recoverable via the move tool). If path is already under Trash, it is destroyed for " +
          "real — calling this on \"Trash\" itself empties Trash permanently in one call.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style directory path, e.g. "notes/"'),
      },
    },
    async ({ path }) => {
      try {
        return ok(await deleteDirectory(path));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "update_file",
    {
      title: "Update File",
      description: buildWriteDescription(
        "Replaces the full content of an existing file at path (whole-file overwrite only). " +
          "Fails with not_found if the file does not already exist.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style path, e.g. "notes/todo.txt"'),
        content: z.string().describe("The full new content to write"),
      },
    },
    async ({ path, content }) => {
      try {
        return ok(await updateFile(path, Buffer.from(content, "utf-8")));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "move",
    {
      title: "Move / Rename",
      description: buildWriteDescription(
        "Moves/renames a file or directory (and everything inside it, for a directory) from " +
          "sourcePath to destinationPath. Fails with already_exists if destinationPath is occupied.",
        framing,
      ),
      inputSchema: {
        sourcePath: z.string().describe("The current path of the file or directory"),
        destinationPath: z.string().describe("The new path"),
      },
    },
    async ({ sourcePath, destinationPath }) => {
      try {
        return ok(await move(sourcePath, destinationPath));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
