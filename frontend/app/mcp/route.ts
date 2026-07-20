import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/lib/mcp-tools";
import { verifyAccessToken } from "@/lib/oauth/tokens";

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {
    serverInfo: { name: "harness-mcp-s3", version: "0.1.0" },
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
