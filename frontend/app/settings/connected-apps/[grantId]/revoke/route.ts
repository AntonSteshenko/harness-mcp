import { NextRequest, NextResponse } from "next/server";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { appendAuditLine, getRecord, putRecord } from "@/lib/oauth/store";
import type { AuditLogEntry, AuthorizationGrant, RegisteredClient } from "@/lib/oauth/types";

/** Owner-initiated revocation of one connected client's grant (FR-007, FR-008, FR-011). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "No active owner session" },
      { status: 401 },
    );
  }

  const { grantId } = await params;
  const grant = await getRecord<AuthorizationGrant>(`grants/${grantId}`);

  if (grant && grant.status === "active") {
    await putRecord<AuthorizationGrant>(`grants/${grantId}`, {
      ...grant,
      status: "revoked",
      revokedAt: new Date().toISOString(),
    });

    const client = await getRecord<RegisteredClient>(`clients/${grant.clientId}`);
    await appendAuditLine(
      JSON.stringify({
        at: new Date().toISOString(),
        event: "grant_revoked",
        clientId: grant.clientId,
        clientName: client?.clientName ?? grant.clientId,
      } satisfies AuditLogEntry),
    );
  }

  return NextResponse.redirect(new URL("/settings/connected-apps", request.url), { status: 303 });
}
