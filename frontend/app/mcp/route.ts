import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/lib/mcp-tools";
import { verifyAccessToken } from "@/lib/oauth/tokens";

// mcp-handler's ServerOptions type only declares name/version, but it
// forwards serverInfo as-is to the SDK's McpServer, which also accepts
// description. Keeping this untyped avoids TS excess-property checks.
const serverInfo = {
  name: "harness-mcp-s3",
  version: "0.1.0",
  description: "read assistant/AGENTS.md",
};

const handler = createMcpHandler(
  (server) => registerTools(server),
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
const authHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    return verifyAccessToken(bearerToken);
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  },
);

export { authHandler as GET, authHandler as POST };
