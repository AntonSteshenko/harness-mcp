import { NextRequest, NextResponse } from "next/server";
import { revokeTokenPair } from "@/lib/oauth/tokens";

/**
 * Token revocation (RFC 7009). Public — a client revokes its own token; an
 * already-invalid/unknown token is still reported as success (RFC 7009 §2.2).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get("token")?.toString();

  if (token) {
    await revokeTokenPair(token);
  }

  return new NextResponse(null, { status: 200 });
}
