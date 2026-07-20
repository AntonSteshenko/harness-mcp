import { NextRequest, NextResponse } from "next/server";
import { oauthErrorResponse } from "@/lib/oauth/httpErrors";
import { verifyPkce } from "@/lib/oauth/pkce";
import { getRecord, putRecord } from "@/lib/oauth/store";
import { getUsableRefreshToken, issueTokenPair, revokeTokenPair } from "@/lib/oauth/tokens";
import type { AuthorizationCode, AuthorizationGrant } from "@/lib/oauth/types";

function tokenResponse(pair: { accessToken: string; refreshToken: string; expiresIn: number }) {
  return NextResponse.json({
    access_token: pair.accessToken,
    refresh_token: pair.refreshToken,
    token_type: "Bearer",
    expires_in: pair.expiresIn,
  });
}

/** Token exchange (RFC 6749 §4.1.3, §6) — public, authenticated via PKCE/the client's own credentials (FR-005). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const grantType = form.get("grant_type")?.toString();

  if (grantType === "authorization_code") {
    const code = form.get("code")?.toString();
    const redirectUri = form.get("redirect_uri")?.toString();
    const clientId = form.get("client_id")?.toString();
    const codeVerifier = form.get("code_verifier")?.toString();

    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return oauthErrorResponse("invalid_request", "code, redirect_uri, client_id, and code_verifier are required");
    }

    const authCode = await getRecord<AuthorizationCode>(`codes/${code}`);
    if (!authCode || authCode.clientId !== clientId) {
      return oauthErrorResponse("invalid_grant", "Unknown authorization code");
    }

    if (authCode.consumedAt) {
      // Reuse of an already-exchanged code: invalidate everything issued from
      // it, per spec.md Edge Cases / RFC 6749 §10.5.
      const grant = await getRecord<AuthorizationGrant>(`grants/${authCode.grantId}`);
      if (grant && grant.status === "active") {
        await putRecord<AuthorizationGrant>(`grants/${authCode.grantId}`, {
          ...grant,
          status: "revoked",
          revokedAt: new Date().toISOString(),
        });
      }
      return oauthErrorResponse("invalid_grant", "Authorization code already used");
    }

    if (new Date(authCode.expiresAt).getTime() <= Date.now()) {
      return oauthErrorResponse("invalid_grant", "Authorization code expired");
    }
    if (authCode.redirectUri !== redirectUri) {
      return oauthErrorResponse("invalid_grant", "redirect_uri does not match the authorization request");
    }
    if (!(await verifyPkce(codeVerifier, authCode.codeChallenge))) {
      return oauthErrorResponse("invalid_grant", "PKCE verification failed");
    }

    await putRecord<AuthorizationCode>(`codes/${code}`, { ...authCode, consumedAt: new Date().toISOString() });

    const pair = await issueTokenPair(authCode.grantId, clientId);
    return tokenResponse(pair);
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token")?.toString();
    const clientId = form.get("client_id")?.toString();

    if (!refreshToken || !clientId) {
      return oauthErrorResponse("invalid_request", "refresh_token and client_id are required");
    }

    const record = await getUsableRefreshToken(refreshToken);
    if (!record || record.clientId !== clientId) {
      return oauthErrorResponse("invalid_grant", "Invalid, expired, or revoked refresh token");
    }

    // Rotate: the old pair is revoked and a new one issued, without
    // re-prompting the owner (FR-005).
    await revokeTokenPair(refreshToken);
    const pair = await issueTokenPair(record.grantId, clientId);
    return tokenResponse(pair);
  }

  return oauthErrorResponse("unsupported_grant_type", `Unsupported grant_type: ${grantType ?? "(missing)"}`);
}
