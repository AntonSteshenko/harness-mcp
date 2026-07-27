import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * English-only, code-bundled engine content (spec 016) — never written into
 * the bucket, never reachable via list_directory/read_file (SC-003). Read
 * once at module load, with every path spelled out literally (mirrors
 * lib/os/init.ts's SKELETON_TEMPLATES) so Vercel's build-time file tracing
 * (`@vercel/nft`) bundles all three files.
 */
const ENGINE_DIR = join(process.cwd(), "lib/os/engine");

const ENGINE_CONTENT = {
  engine: readFileSync(join(ENGINE_DIR, "engine.md"), "utf-8"),
  "os-upgrade": readFileSync(join(ENGINE_DIR, "os-upgrade.md"), "utf-8"),
  init: readFileSync(join(ENGINE_DIR, "init.md"), "utf-8"),
} as const;

interface EngineResourceDefinition {
  name: keyof typeof ENGINE_CONTENT;
  uri: string;
  title: string;
  description: string;
}

const ENGINE_RESOURCES: EngineResourceDefinition[] = [
  {
    name: "engine",
    uri: "os-engine://engine",
    title: "Company OS Engine",
    description:
      "How to build/repair AGENTS.md: Rule Zero, write-semantics rules, the confirm-before-change " +
      "gate, the current os-engine-version, and the changelog. Invoked automatically whenever " +
      "AGENTS.md needs to be created or repaired — not something an owner asks for by name.",
  },
  {
    name: "os-upgrade",
    uri: "os-engine://os-upgrade",
    title: "Company OS Upgrade Check",
    description:
      "Compares AGENTS.md's recorded os-engine-version against the engine resource's current " +
      "version and, if behind, describes the change in the owner's confirmed language before " +
      "rebuilding. Use when the owner explicitly asks to check for an OS upgrade.",
  },
  {
    name: "init",
    uri: "os-engine://init",
    title: "Company OS Business Setup",
    description:
      "The business-setup interview, activity-type decision table, and write instructions for " +
      "data/*, os/identity.md, os/policies/*, domain skills, and os/routing.md. Use for " +
      "\"init\"/\"initialize\"/\"setup os\"/\"create the structure\", or when data/ is found missing.",
  },
];

/** Registers every MCP resource this server exposes (spec 016, contracts/mcp-resources.md). */
export async function registerResources(server: McpServer): Promise<void> {
  for (const resource of ENGINE_RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      { title: resource.title, description: resource.description, mimeType: "text/markdown" },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: ENGINE_CONTENT[resource.name] }],
      }),
    );
  }
}
