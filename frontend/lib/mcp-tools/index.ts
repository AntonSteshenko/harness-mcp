import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createDirectory, deleteDirectory, listDirectory } from "@/lib/storage/directories";
import { createFile, deleteFile, readFile, updateFile } from "@/lib/storage/files";
import { move } from "@/lib/storage/move";
import { errorResult, ok } from "./result";

/**
 * Registers every MCP tool this server exposes (contracts/mcp-tools.md) onto
 * the given server instance. Tools are added here incrementally per user
 * story (US1: create_file/read_file/delete_file, US2: directory tools,
 * US3: update_file/move).
 */
export function registerTools(server: McpServer): void {
  server.registerTool(
    "create_file",
    {
      title: "Create File",
      description:
        "Creates a file at path with content, overwriting it if a file already exists there. " +
        "Fails with already_exists if a directory exists at path.",
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
      description: "Reads the full current content of the file at path.",
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
      description: "Deletes the file at path.",
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
      description:
        "Creates a directory at path. Idempotent if it already exists. Fails with " +
        "already_exists if a file exists at path.",
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
      description:
        "Lists the direct children (files and subdirectories) of the directory at path. " +
        "Does not recurse into subdirectories. Use \"\" for the root.",
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
      description: "Deletes the directory at path and everything inside it, recursively.",
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
      description:
        "Replaces the full content of an existing file at path (whole-file overwrite only). " +
        "Fails with not_found if the file does not already exist.",
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
      description:
        "Moves/renames a file or directory (and everything inside it, for a directory) from " +
        "sourcePath to destinationPath. Fails with already_exists if destinationPath is occupied.",
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
