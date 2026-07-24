import { NextRequest, NextResponse } from "next/server";
import { revokePersonalAccessToken } from "@/lib/oauth/personalAccessTokens";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { appendAuditLine, getRecord } from "@/lib/oauth/store";
import type { AuditLogEntry, PersonalAccessToken } from "@/lib/oauth/types";

/** Owner-initiated revocation of one personal access token (FR-006, FR-007, FR-009). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "No active owner session" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const record = await getRecord<PersonalAccessToken>(`pats/${id}`);

  if (record && !record.revoked) {
    await revokePersonalAccessToken(id);

    await appendAuditLine(
      JSON.stringify({
        at: new Date().toISOString(),
        event: "pat_revoked",
        clientId: record.id,
        clientName: record.name,
      } satisfies AuditLogEntry),
    );
  }

  return NextResponse.redirect(new URL("/settings/personal-access-tokens", request.url), { status: 303 });
}
