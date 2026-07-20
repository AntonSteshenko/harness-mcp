import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { appendAuditLine, getRecord, putRecord } from "@/lib/oauth/store";
import type { AuditLogEntry, AuthorizationCode, AuthorizationGrant, RegisteredClient } from "@/lib/oauth/types";

const CODE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/** The owner's approve/deny decision from the consent screen (FR-003, FR-004). */
export async function POST(request: NextRequest) {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "No active owner session" },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const clientId = form.get("client_id")?.toString();
  const redirectUri = form.get("redirect_uri")?.toString();
  const state = form.get("state")?.toString() ?? "";
  const codeChallenge = form.get("code_challenge")?.toString();
  const decision = form.get("decision")?.toString();

  if (!clientId || !redirectUri || !codeChallenge || (decision !== "approve" && decision !== "deny")) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required parameters" },
      { status: 400 },
    );
  }

  const client = await getRecord<RegisteredClient>(`clients/${clientId}`);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Unknown client or redirect_uri" },
      { status: 400 },
    );
  }

  const redirectTarget = new URL(redirectUri);
  const now = new Date();

  if (decision === "deny") {
    redirectTarget.searchParams.set("error", "access_denied");
    if (state) redirectTarget.searchParams.set("state", state);

    await appendAuditLine(
      JSON.stringify({
        at: now.toISOString(),
        event: "grant_denied",
        clientId,
        clientName: client.clientName,
      } satisfies AuditLogEntry),
    );

    return NextResponse.redirect(redirectTarget, { status: 303 });
  }

  const grantId = randomBytes(16).toString("hex");
  const grant: AuthorizationGrant = {
    grantId,
    clientId,
    status: "active",
    scope: "full_access",
    authorizedAt: now.toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };
  await putRecord(`grants/${grantId}`, grant);

  const code = randomBytes(32).toString("hex");
  const authCode: AuthorizationCode = {
    code,
    clientId,
    grantId,
    codeChallenge,
    redirectUri,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    consumedAt: null,
  };
  await putRecord(`codes/${code}`, authCode);

  await appendAuditLine(
    JSON.stringify({
      at: now.toISOString(),
      event: "grant_approved",
      clientId,
      clientName: client.clientName,
    } satisfies AuditLogEntry),
  );

  redirectTarget.searchParams.set("code", code);
  if (state) redirectTarget.searchParams.set("state", state);
  return NextResponse.redirect(redirectTarget, { status: 303 });
}
