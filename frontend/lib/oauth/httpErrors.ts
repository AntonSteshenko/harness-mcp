import { NextResponse } from "next/server";
import type { OAuthErrorCode } from "./errors";

/** Standard OAuth error response shape (RFC 6749 §5.2) for the AS endpoints. */
export function oauthErrorResponse(code: OAuthErrorCode, description: string, status = 400) {
  return NextResponse.json({ error: code, error_description: description }, { status });
}
