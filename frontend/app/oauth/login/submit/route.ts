import { NextRequest, NextResponse } from "next/server";
import { readOwnerCredentialConfig, verifyOwnerPassword } from "@/lib/oauth/config";
import { checkLoginLockout, recordLoginFailure, recordLoginSuccess } from "@/lib/oauth/rateLimit";
import { createOwnerSession } from "@/lib/oauth/session";

/**
 * Owner sign-in (FR-009), guarded by rate limiting (FR-013). Lives at
 * /oauth/login/submit rather than /oauth/login itself, since Next.js
 * forbids a route.ts and page.tsx at the same path (the GET form lives at
 * /oauth/login/page.tsx).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = form.get("username")?.toString() ?? "";
  const password = form.get("password")?.toString() ?? "";
  const continueUrl = form.get("continue")?.toString() || "/settings/connected-apps";

  const loginUrl = new URL("/oauth/login", request.url);
  loginUrl.searchParams.set("continue", continueUrl);

  const lockedUntil = await checkLoginLockout();
  if (lockedUntil) {
    loginUrl.searchParams.set("error", "locked_out");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const config = readOwnerCredentialConfig();
  const valid = username === config.username && verifyOwnerPassword(password, config.passwordHash);

  if (!valid) {
    await recordLoginFailure();
    loginUrl.searchParams.set("error", "invalid_credentials");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  await recordLoginSuccess();
  await createOwnerSession();

  return NextResponse.redirect(new URL(continueUrl, request.url), { status: 303 });
}
