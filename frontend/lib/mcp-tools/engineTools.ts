import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { registerGatedTool } from "./toolGate";

/**
 * English-only, code-bundled engine content (spec 016) — never written into
 * the bucket, never reachable via list_directory/read_file (SC-003). Read
 * once at module load, with every path spelled out literally (mirrors
 * lib/os/init.ts's SKELETON_TEMPLATES) so Vercel's build-time file tracing
 * (`@vercel/nft`) bundles all three files.
 *
 * Originally shipped as MCP *resources* (registerResource) — reverted after
 * live testing showed a connected assistant can reliably discover and call
 * MCP *tools* (it already used list_directory/read_file without issue) but
 * had no visibility into resources at all: it didn't know they existed and
 * guessed a completely unrelated, separately-connected MCP server might be
 * the "engine" AGENTS.md's stub vaguely pointed at. Tools are what's
 * actually supported consistently across MCP clients; the tradeoff (sharing
 * a namespace with create_file/read_file/etc.) is worth that reliability.
 */
const ENGINE_DIR = join(process.cwd(), "lib/os/engine");

const ENGINE_CONTENT = {
  engine: readFileSync(join(ENGINE_DIR, "engine.md"), "utf-8"),
  "os-upgrade": readFileSync(join(ENGINE_DIR, "os-upgrade.md"), "utf-8"),
  init: readFileSync(join(ENGINE_DIR, "init.md"), "utf-8"),
} as const;

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

interface EngineToolDefinition {
  name: string;
  content: keyof typeof ENGINE_CONTENT;
  title: string;
  description: string;
}

const ENGINE_TOOLS: EngineToolDefinition[] = [
  {
    name: "get_os_engine",
    content: "engine",
    title: "Get Company OS Engine",
    description:
      "Returns the instructions for building/repairing AGENTS.md: Rule Zero, write-semantics " +
      "rules, the confirm-before-change gate, the current os-engine-version, and the changelog. " +
      "Call this whenever AGENTS.md needs to be created or repaired — including the first time " +
      "you connect to an empty or stub-only Company OS.",
  },
  {
    name: "get_os_upgrade",
    content: "os-upgrade",
    title: "Get Company OS Upgrade Check",
    description:
      "Returns the instructions for checking whether AGENTS.md's recorded os-engine-version is " +
      "behind the current one and, if so, describing the change before rebuilding. Call this when " +
      "the owner explicitly asks to check for an OS upgrade.",
  },
  {
    name: "get_os_init",
    content: "init",
    title: "Get Company OS Business Setup",
    description:
      "Returns the business-setup interview, activity-type decision table, and write instructions " +
      "for data/*, os/identity.md, os/policies/*, domain skills, and os/routing.md. Call this for " +
      "\"init\"/\"initialize\"/\"setup os\"/\"create the structure\", or whenever data/ turns out to " +
      "be missing or empty.",
  },
];

/** Registers every MCP tool that exposes engine/business-setup content (spec 016). */
export async function registerEngineTools(server: McpServer, disabledTools: ReadonlySet<string>): Promise<void> {
  for (const tool of ENGINE_TOOLS) {
    registerGatedTool(
      server,
      disabledTools,
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: {} },
      async () => textResult(ENGINE_CONTENT[tool.content]),
    );
  }
}
