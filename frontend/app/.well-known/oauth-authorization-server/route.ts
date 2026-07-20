import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "mcp-handler";

/**
 * RFC 8414 Authorization Server Metadata — lets a client (ChatGPT, Claude,
 * etc.) discover this app's OAuth endpoints without manual configuration
 * (spec.md FR-002, contracts/oauth-endpoints.md).
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}
