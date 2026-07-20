import { NextRequest, NextResponse } from "next/server";
import { generateProtectedResourceMetadata, getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";

/**
 * RFC 9728 Protected Resource Metadata for the MCP route. This app is both
 * the Authorization Server and the Protected Resource (research.md §1), so
 * `authServerUrls` points back at this same origin rather than a hardcoded
 * third-party issuer — the origin is derived per-request (via
 * getPublicOrigin) so this works unchanged across local dev and any
 * deployment target.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [origin],
    resourceUrl: `${origin}/mcp`,
  });
  return NextResponse.json(metadata);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
