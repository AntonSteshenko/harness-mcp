import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "@/lib/storage/files";
import { buildSnippet, matchesName, walkTree } from "@/lib/storage/tree";
import { buildEntryDescription, getBootstrapFraming } from "./bootstrap";
import { errorResult, ok } from "./result";
import { registerGatedTool } from "./toolGate";

/** Registers the MCP tree-search tools (spec 022): list_directory_tree, find_files_by_name, search_file_content. */
export async function registerTreeTools(server: McpServer, disabledTools: ReadonlySet<string>): Promise<void> {
  const framing = await getBootstrapFraming();

  registerGatedTool(
    server,
    disabledTools,
    "list_directory_tree",
    {
      title: "List Directory Tree",
      description: buildEntryDescription(
        "Returns the complete nested contents of the directory at path — every descendant " +
          "file and directory, at every depth — in a single call, instead of one list_directory " +
          "call per level. Excludes Trash. Truncates (truncated: true) if the subtree is very large.",
        framing,
      ),
      inputSchema: {
        path: z.string().describe('Filesystem-style directory path, e.g. "os/", or "" for the root'),
      },
    },
    async ({ path }) => {
      try {
        const { entries, truncated } = await walkTree(path);
        return ok({ path, entries, truncated });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "find_files_by_name",
    {
      title: "Find Files By Name",
      description: buildEntryDescription(
        "Searches for files and directories whose own name (not full path) contains query " +
          "(case-insensitive), across the whole tree or the subtree rooted at path. Use this " +
          "instead of guessing a parent path and calling list_directory repeatedly.",
        framing,
      ),
      inputSchema: {
        query: z.string().trim().min(1).describe("Name or partial name to search for"),
        path: z
          .string()
          .optional()
          .describe('Directory path to scope the search to, e.g. "os/skills/". Defaults to the root.'),
      },
    },
    async ({ query, path }) => {
      try {
        const { entries, truncated } = await walkTree(path ?? "");
        const matches = entries.filter((entry) => matchesName(entry, query));
        return ok({ query, matches, truncated });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    disabledTools,
    "search_file_content",
    {
      title: "Search File Content",
      description: buildEntryDescription(
        "Searches the content of Markdown files for query (case-insensitive), across the whole " +
          "tree or the subtree rooted at path, returning each matching file's path and a short " +
          "snippet of context. Only Markdown files are inspected.",
        framing,
      ),
      inputSchema: {
        query: z.string().trim().min(1).describe("Word or phrase to search for in file content"),
        path: z
          .string()
          .optional()
          .describe('Directory path to scope the search to, e.g. "os/skills/". Defaults to the root.'),
      },
    },
    async ({ query, path }) => {
      try {
        const { entries, truncated } = await walkTree(path ?? "");
        const markdownFiles = entries.filter(
          (entry) => entry.kind === "file" && entry.path.toLowerCase().endsWith(".md"),
        );

        const matches: Array<{ path: string; snippet: string }> = [];
        for (const file of markdownFiles) {
          let content: string;
          try {
            content = (await readFile(file.path)).content;
          } catch {
            continue; // skip files that can't be read/decoded (FR-007) rather than failing the whole search
          }

          if (content.toLowerCase().includes(query.toLowerCase())) {
            matches.push({ path: file.path, snippet: buildSnippet(content, query) });
          }
        }

        return ok({ query, matches, truncated });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
