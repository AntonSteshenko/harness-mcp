import { NextRequest, NextResponse } from "next/server";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { bumpGeneration } from "@/lib/oauth/sessionSecret";

const COOKIE_NAME = "oauth_owner_session";

/**
 * Owner-initiated sign-out (User Story 2, 021-fast-owner-session): bumps
 * the shared session generation so every previously issued session cookie
 * — on this device or any other — stops validating, without tracking
 * individual sessions (contracts/session-contract.md).
 */
export async function POST(request: NextRequest) {
  if (await hasActiveOwnerSession()) {
    await bumpGeneration();
  }

  const response = NextResponse.redirect(new URL("/oauth/login", request.url), { status: 303 });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
