import { createMcpHandler } from "mcp-handler";
import { registerTools } from "@/lib/mcp-tools";

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

export { handler as GET, handler as POST };
