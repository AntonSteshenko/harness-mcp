import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createDirectory, deleteDirectory, listDirectory } from "@/lib/storage/directories";
import { createFile, deleteFile, readFile, updateFile } from "@/lib/storage/files";
import { move } from "@/lib/storage/move";
import { buildEntryDescription, buildWriteDescription, getBootstrapFraming } from "./bootstrap";
import { errorResult, ok } from "./result";

/**
 * Registers every MCP tool this server exposes (contracts/mcp-tools.md) onto
 * the given server instance. Tools are added here incrementally per user
 * story (US1: create_file/read_file/delete_file, US2: directory tools,
 * US3: update_file/move).
 */
export async function registerTools(server: McpServer): Promise<void> {
  const framing = await getBootstrapFraming();

  server.registerTool(
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
        return ok(await createFile(path, content));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "read_file",
    {
      title: "Read File",
      description: buildEntryDescription(
        "Reads the full current content of the file at path.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style path, e.g. "notes/todo.txt"'),
      },
    },
    async ({ path }) => {
      try {
        return ok(await readFile(path));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
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

  server.registerTool(
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

  server.registerTool(
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

  server.registerTool(
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

  server.registerTool(
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
        return ok(await updateFile(path, content));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
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
