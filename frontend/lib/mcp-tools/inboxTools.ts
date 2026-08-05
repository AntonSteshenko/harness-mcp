import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "@/lib/storage/files";
import { buildEntryDescription, getBootstrapFraming } from "./bootstrap";
import { errorResult, ok } from "./result";
import { registerGatedTool } from "./toolGate";

const INBOX_PATH = "data/inbox.md";

/** Registers the get_inbox MCP tool (spec 020) — a fixed-path shortcut over read_file. */
export async function registerInboxTools(server: McpServer): Promise<void> {
  const framing = await getBootstrapFraming();

  registerGatedTool(
    server,
    "get_inbox",
    {
      title: "Get Inbox",
      description: buildEntryDescription(
        "Returns the full current content of the quick-capture inbox (data/inbox.md) — " +
          "the owner's one-line-with-date capture log, read during workflows like daily-plan " +
          "and weekly-review.",
        framing,
      ),
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await readFile(INBOX_PATH));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
