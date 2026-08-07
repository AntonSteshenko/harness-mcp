import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/lib/mcp-tools";
import { registerBinaryFileTools } from "@/lib/mcp-tools/binaryFileTools";
import { registerEngineTools } from "@/lib/mcp-tools/engineTools";
import { registerInboxTools } from "@/lib/mcp-tools/inboxTools";
import { registerMessagingTools } from "@/lib/mcp-tools/messagingTools";
import { getDisabledTools } from "@/lib/mcp-tools/store";
import { registerTreeTools } from "@/lib/mcp-tools/treeTools";
import { verifyPersonalAccessToken } from "@/lib/oauth/personalAccessTokens";
import { verifyAccessToken } from "@/lib/oauth/tokens";

// mcp-handler's ServerOptions type only declares name/version, but it
// forwards serverInfo as-is to the SDK's McpServer, which also accepts
// description. Keeping this untyped avoids TS excess-property checks.
const serverInfo = {
  name: "harness-mcp-s3",
  version: "0.1.0",
  description: "read assistant/AGENTS.md; call get_os_engine/get_os_upgrade/get_os_init to set up or repair it (spec 016)",
};

const handler = createMcpHandler(
  async (server) => {
    const disabledTools = await getDisabledTools();
    await registerTools(server, disabledTools);
    await registerEngineTools(server, disabledTools);
    await registerMessagingTools(server, disabledTools);
    await registerInboxTools(server, disabledTools);
    await registerTreeTools(server, disabledTools);
    await registerBinaryFileTools(server, disabledTools);
  },
  {
    serverInfo,
  },
  {
    maxDuration: 60,
    verboseLogs: true,
  },
);

// spec 008-mcp-oauth, FR-001: every tool request must carry a valid,
// unexpired, unrevoked access token before any storage operation runs.
// spec 013-mcp-token-auth, FR-003/FR-004: a personal access token is an
// additional, independent way to authenticate — tried as a fallback so OAuth
// access tokens keep working exactly as before.
const authHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    return (await verifyAccessToken(bearerToken)) ?? (await verifyPersonalAccessToken(bearerToken));
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  },
);

export { authHandler as GET, authHandler as POST };
