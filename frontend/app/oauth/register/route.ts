import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { putRecord } from "@/lib/oauth/store";
import type { RegisteredClient } from "@/lib/oauth/types";

/** Dynamic Client Registration (RFC 7591) — public, no owner sign-in required (FR-002). */
const RegisterSchema = z.object({
  client_name: z.string().min(1),
  redirect_uris: z.array(z.string().url()).min(1),
  token_endpoint_auth_method: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: parsed.error.issues.map((issue) => issue.message).join("; "),
      },
      { status: 400 },
    );
  }

  const clientId = randomBytes(16).toString("hex");
  const client: RegisteredClient = {
    clientId,
    clientName: parsed.data.client_name,
    redirectUris: parsed.data.redirect_uris,
    clientSecretHash: null, // public/PKCE-only client (research.md §1)
    registeredAt: new Date().toISOString(),
  };
  await putRecord<RegisteredClient>(`clients/${clientId}`, client);

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
    },
    { status: 201 },
  );
}
